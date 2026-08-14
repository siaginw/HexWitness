import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { DaemonClient } from "./mcp-client.mjs";
import { VERSION } from "./constants.mjs";
import { NATIVE_SKILL_CLIENTS, readAgentGuidance } from "./agent-guidance.mjs";
import { localToolStatus, recordToolObservation, runLocalTool } from "./executor.mjs";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { addInvestigationItem, createInvestigation, recordFailedAttempt, recordInvestigationUsage, setInvestigationStatus, updateInvestigationItem } from "./investigations.mjs";

function content(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

export function createMcpServer(client = new DaemonClient()) {
  const agentClient = process.env.HEXWITNESS_AGENT_CLIENT ?? "generic";
  const agentGuide = readAgentGuidance(fileURLToPath(new URL("..", import.meta.url)), agentClient);
  const guidanceInstruction = NATIVE_SKILL_CLIENTS.includes(agentClient)
    ? `Use the installed native hexwitness skill when this workflow is relevant. The same client-tailored guide is available at hexwitness://agent-guide.`
    : `Apply this client-tailored workflow:\n\n${agentGuide}`;
  const server = new McpServer({ name: "hexwitness", version: VERSION }, {
    instructions: `HexWitness is durable evidence memory for AI-led reverse engineering. ${guidanceInstruction}`,
  });
  const readOnlyAnnotations = Object.freeze({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  const registerReadOnlyTool = (name, config, handler) => server.registerTool(name, {
    ...config,
    annotations: readOnlyAnnotations,
  }, handler);
  const mutationAnnotations = Object.freeze({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
  const withWritableDb = (callback) => {
    const db = openEvidenceDb(loadConfig().evidenceDb);
    try { return callback(db); } finally { db.close(); }
  };

  server.registerResource("hexwitness-agent-guide", "hexwitness://agent-guide", {
    title: `HexWitness workflow for ${agentClient}`,
    description: "Client-tailored evidence-first investigation workflow installed with HexWitness.",
    mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: agentGuide }] }));

  registerReadOnlyTool("hexwitness_health", {
    title: "HexWitness health",
    description: "Check daemon health, build inventory, and indexed evidence counts.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/health")));

  registerReadOnlyTool("hexwitness_contract", {
    title: "HexWitness public compatibility contract",
    description: "Read the stable 1.x CLI, REST, MCP, interchange, and database compatibility contract.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/contract")));

  registerReadOnlyTool("hexwitness_builds", {
    title: "List indexed builds",
    description: "List binary builds and provenance available for queries.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/builds")));

  registerReadOnlyTool("hexwitness_memory_status", {
    title: "Inspect durable evidence memory",
    description: "Show what HexWitness retains, database size and counts, latest ingest/capture, privacy-preserving activity, and the query-before-live-tool reuse policy.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/memory")));

  registerReadOnlyTool("hexwitness_search", {
    title: "Search binary entities",
    description: "Search functions, symbols, strings, types, classes, imports, and runtime objects.",
    inputSchema: {
      query: z.string().describe("Name, address fragment, stable key, or signature text"),
      build_id: z.string().optional(),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(250).optional(),
    },
  }, async ({ query, build_id, kind, limit }) => content(await client.get("/v1/search", { q: query, build_id, kind, limit })));

  registerReadOnlyTool("hexwitness_query", {
    title: "Query indexed analysis",
    description: "Structured cross-tool query over entities, optional edge kinds, evidence coverage, and runtime coverage. This is the safe generic replacement for arbitrary SQL.",
    inputSchema: {
      query: z.string().optional(), build_id: z.string().optional(), kinds: z.array(z.string()).optional(),
      edge_kinds: z.array(z.string()).optional(), has_evidence: z.boolean().optional(), has_runtime: z.boolean().optional(),
      limit: z.number().int().min(1).max(5000).optional(),
    },
  }, async ({ query, build_id, kinds, edge_kinds, has_evidence, has_runtime, limit }) => content(await client.get("/v1/query", {
    q: query, build_id, kinds: kinds?.join(","), edge_kinds: edge_kinds?.join(","), has_evidence, has_runtime, limit,
  })));

  registerReadOnlyTool("hexwitness_explain", {
    title: "Explain an entity",
    description: "Return one evidence dossier: identity, signature, decompilation when retained, callers, callees, references, runtime hits, claims, and provenance.",
    inputSchema: {
      build_id: z.string().optional(),
      address: z.string().optional().describe("Hex virtual address"),
      stable_key: z.string().optional(),
      entity_id: z.string().optional(),
    },
  }, async (args) => content(await client.get("/v1/explain", args)));

  registerReadOnlyTool("hexwitness_gap_report", {
    title: "Plan the next evidence dump",
    description: "Inspect one indexed entity and return the smallest missing static or runtime evidence needed for an investigation objective.",
    inputSchema: {
      build_id: z.string().optional(),
      address: z.string().optional(),
      stable_key: z.string().optional(),
      entity_id: z.string().optional(),
      objective: z.enum(["identity", "control_flow", "data_flow", "object_model", "protocol", "runtime", "behavior"]).optional(),
    },
  }, async (args) => content(await client.get("/v1/gaps", args)));

  registerReadOnlyTool("hexwitness_dump_guide", {
    title: "Get an evidence export checklist",
    description: "Return vendor-neutral fields, provenance, privacy boundaries, and preferred adapters for a reverse-engineering objective.",
    inputSchema: { objective: z.enum(["identity", "control_flow", "data_flow", "object_model", "protocol", "runtime", "behavior"]).optional() },
  }, async (args) => content(await client.get("/v1/guide/dump", args)));

  for (const [name, description] of [
    ["callers", "Find direct callers of a function."],
    ["callees", "Find direct callees of a function."],
    ["xrefs", "Find incoming and outgoing code/data references."],
  ]) {
    registerReadOnlyTool(`hexwitness_${name}`, {
      title: `HexWitness ${name}`,
      description,
      inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
    }, async (args) => content(await client.get(`/v1/${name}`, args)));
  }

  registerReadOnlyTool("hexwitness_reach", {
    title: "Traverse the analysis graph",
    description: "Bounded incoming or outgoing graph traversal for calls, references, ownership, or arbitrary edge kinds.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), direction: z.enum(["incoming", "outgoing"]).optional(), kind: z.string().optional(), depth: z.number().int().min(1).max(12).optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/reach", args)));

  registerReadOnlyTool("hexwitness_dataflow", {
    title: "Trace data flow",
    description: "Traverse structured reads, writes, loads, stores, definitions, uses, aliases, parameters, and return edges.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), direction: z.enum(["incoming", "outgoing", "both"]).optional(), depth: z.number().int().min(1).max(12).optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/dataflow", args)));

  registerReadOnlyTool("hexwitness_slices", {
    title: "Get analysis slices",
    description: "Return retained decompiler, IL, SSA, basic-block, codec, or manually bounded slices for one entity.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/slices", args)));

  registerReadOnlyTool("hexwitness_functions", {
    title: "List functions",
    description: "Inventory functions or methods for an exact build with optional name/signature filter.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), named: z.boolean().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async ({ build_id, query, named, limit }) => content(await client.get("/v1/functions", { build_id, q: query, named, limit })));

  registerReadOnlyTool("hexwitness_classes", {
    title: "Search object model",
    description: "Search classes, types, fields, methods, vtables, slots, and enums for an exact build.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), limit: z.number().int().min(1).max(1000).optional() },
  }, async ({ build_id, query, limit }) => content(await client.get("/v1/classes", { build_id, q: query, limit })));

  registerReadOnlyTool("hexwitness_class", {
    title: "Explain a class",
    description: "Return one class/type with its fields, methods, inheritance, interfaces, and vtable relationships.",
    inputSchema: { build_id: z.string().optional(), name: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/class", args)));

  registerReadOnlyTool("hexwitness_vtable", {
    title: "Explain a vtable",
    description: "Return one vtable or class and its slot-to-function relationships.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/vtable", args)));

  registerReadOnlyTool("hexwitness_uuid", {
    title: "Resolve a UUID",
    description: "Resolve a UUID/GUID across stable keys, names, and structured type metadata for an optional exact build.",
    inputSchema: { uuid: z.string(), build_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/uuid", args)));

  registerReadOnlyTool("hexwitness_types", {
    title: "Query type registry",
    description: "Query types, classes, enums, vtables, and slots exported by any supported analysis tool.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ build_id, query, kind, limit }) => content(await client.get("/v1/types", { build_id, q: query, kind, limit })));

  registerReadOnlyTool("hexwitness_offsets", {
    title: "Query field offsets",
    description: "Query exported field offsets by exact build, owner class/type, field name, or signature.",
    inputSchema: { build_id: z.string(), owner: z.string().optional(), query: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ build_id, owner, query, limit }) => content(await client.get("/v1/offsets", { build_id, owner, q: query, limit })));

  registerReadOnlyTool("hexwitness_metadata", {
    title: "Resolve hashes, assets, codecs, and metadata",
    description: "Generic metadata lookup for hashes, IDs, assets, resources, codecs, protocol fragments, or project-defined attributes without target-specific assumptions.",
    inputSchema: { query: z.string(), build_id: z.string().optional(), kinds: z.array(z.string()).optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ query, build_id, kinds, limit }) => content(await client.get("/v1/metadata", { q: query, build_id, kinds: kinds?.join(","), limit })));

  registerReadOnlyTool("hexwitness_decomp_search", {
    title: "Search decompiler and IL slices",
    description: "Search retained opt-in decompiler text and bounded IL/SSA/codec slices for an exact build.",
    inputSchema: { build_id: z.string(), query: z.string(), kind: z.string().optional(), limit: z.number().int().min(1).max(1000).optional() },
  }, async ({ build_id, query, kind, limit }) => content(await client.get("/v1/decomp/search", { build_id, q: query, kind, limit })));

  registerReadOnlyTool("hexwitness_path", {
    title: "Find the shortest graph path",
    description: "Find a bounded shortest path between two build-scoped entities using optional edge-kind filtering.",
    inputSchema: { build_id: z.string(), from_address: z.string().optional(), from_key: z.string().optional(), from_entity: z.string().optional(), to_address: z.string().optional(), to_key: z.string().optional(), to_entity: z.string().optional(), kind: z.string().optional(), direction: z.enum(["incoming", "outgoing"]).optional(), depth: z.number().int().min(1).max(20).optional() },
  }, async (args) => content(await client.get("/v1/path", args)));

  registerReadOnlyTool("hexwitness_edge_kinds", {
    title: "List graph edge kinds",
    description: "Inventory exported relationship kinds and source/target coverage for an optional build.",
    inputSchema: { build_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/edges/kinds", args)));

  registerReadOnlyTool("hexwitness_compare_builds", {
    title: "Compare binary builds",
    description: "Compare stable entities across two builds and report additions, removals, and identity/signature/address changes.",
    inputSchema: { left: z.string(), right: z.string(), limit: z.number().int().min(1).max(10000).optional() },
  }, async (args) => content(await client.get("/v1/builds/compare", args)));

  registerReadOnlyTool("hexwitness_evidence", {
    title: "List evidence",
    description: "List static, dynamic, capture, documentary, synthetic, or manually asserted evidence with provenance and confidence.",
    inputSchema: { build_id: z.string().optional(), source: z.string().optional(), classification: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/evidence", args)));

  registerReadOnlyTool("hexwitness_contradictions", {
    title: "Find contradictions",
    description: "Return claim groups where active evidence-backed assertions disagree.",
    inputSchema: { build_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/contradictions", args)));

  registerReadOnlyTool("hexwitness_coverage", {
    title: "Report evidence coverage",
    description: "Summarize naming, signature, decompilation, evidence, runtime, and capture coverage by build.",
    inputSchema: { build_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/coverage", args)));

  registerReadOnlyTool("hexwitness_worklist", {
    title: "List unresolved evidence gaps",
    description: "Return prioritized static/runtime evidence gaps without guessing missing behavior.",
    inputSchema: { build_id: z.string().optional(), capture_id: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/gaps/worklist", args)));

  registerReadOnlyTool("hexwitness_captures", {
    title: "List capture packs",
    description: "List indexed, build-bound controlled runtime capture packs and quality metadata.",
    inputSchema: { build_id: z.string().optional(), scenario: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/captures", args)));

  registerReadOnlyTool("hexwitness_capture_detail", {
    title: "Inspect a capture",
    description: "Return capture metadata, artifacts, markers, relationships, and event-family counts.",
    inputSchema: { capture_id: z.string() },
  }, async (args) => content(await client.get("/v1/captures/detail", args)));

  registerReadOnlyTool("hexwitness_capture_timeline", {
    title: "Read capture timeline",
    description: "Read a bounded normalized event timeline with source/kind/name filters.",
    inputSchema: { capture_id: z.string(), after: z.number().int().min(0).optional(), source: z.string().optional(), kind: z.string().optional(), name: z.string().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/captures/timeline", args)));

  registerReadOnlyTool("hexwitness_capture_search", {
    title: "Search capture evidence",
    description: "Search normalized capture names, summaries, and safe structured fields across one or all captures.",
    inputSchema: { query: z.string(), capture_id: z.string().optional(), direction: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ query, ...args }) => content(await client.get("/v1/captures/search", { ...args, q: query })));

  registerReadOnlyTool("hexwitness_capture_graph", {
    title: "Read capture relationship graph",
    description: "Return normalized runtime relationships such as request-to-response, actor-to-archetype, state-to-consumer, or marker-to-event.",
    inputSchema: { capture_id: z.string(), kind: z.string().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/captures/graph", args)));

  registerReadOnlyTool("hexwitness_capture_compare", {
    title: "Compare captures",
    description: "Compare normalized event families and report the first ordered divergence between two captures.",
    inputSchema: { left: z.string(), right: z.string() },
  }, async (args) => content(await client.get("/v1/captures/compare", args)));

  registerReadOnlyTool("hexwitness_activity_summary", {
    title: "Summarize retained tool usage",
    description: "Show operation counts, average latency, and failures. Arguments and result content are never retained.",
    inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  }, async (args) => content(await client.get("/v1/activity", args)));

  registerReadOnlyTool("hexwitness_adapter_diagnostics", {
    title: "Diagnose analysis adapters",
    description: "Report bundled adapter assets, locally visible runtimes, external-host requirements, capabilities, and exact missing setup without executing a target.",
    inputSchema: { adapter_id: z.string().optional() },
  }, async ({ adapter_id }) => content(await client.get("/v1/adapters/diagnostics", { id: adapter_id })));

  registerReadOnlyTool("hexwitness_playbooks", {
    title: "List evidence playbooks",
    description: "List deterministic binary, firmware, network, protocol, and runtime investigation playbooks. Playbooks define evidence gates, not LLM personas.",
    inputSchema: { playbook_id: z.string().optional() },
  }, async ({ playbook_id }) => content(await client.get(playbook_id ? "/v1/playbooks/detail" : "/v1/playbooks", playbook_id ? { id: playbook_id } : {})));

  registerReadOnlyTool("hexwitness_investigations", {
    title: "List durable investigations",
    description: "List persistent build-bound investigations with checklist progress, evidence links, gaps, stale state, and operation budget status.",
    inputSchema: { build_id: z.string().optional(), status: z.enum(["planned", "active", "blocked", "complete", "abandoned"]).optional(), playbook_id: z.string().optional(), stale_days: z.number().int().min(1).max(365).optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/investigations", args)));

  registerReadOnlyTool("hexwitness_investigation_detail", {
    title: "Read a durable investigation",
    description: "Return one investigation, ordered checklist and reference items, failed attempts, usage ledger, progress, completion blockers, and budget state.",
    inputSchema: { investigation_id: z.string() },
  }, async (args) => content(await client.get("/v1/investigations/detail", args)));

  registerReadOnlyTool("hexwitness_investigation_report", {
    title: "Report investigation progress",
    description: "Summarize active, blocked, stalled, complete, and completion-ready investigations for one build or the full local evidence database.",
    inputSchema: { build_id: z.string().optional(), stale_days: z.number().int().min(1).max(365).optional() },
  }, async (args) => content(await client.get("/v1/investigations/report", args)));

  server.registerTool("hexwitness_investigation_create", {
    title: "Create a durable investigation",
    description: "Create one exact-build investigation, optionally seeded by a deterministic playbook and explicit agent-operation budget.",
    inputSchema: { build_id: z.string(), title: z.string().min(1).max(500), question: z.string().max(4000).optional(), playbook_id: z.enum(["binary", "firmware", "network", "protocol", "runtime"]).optional(), priority: z.number().int().min(0).max(4).optional(), operation_budget: z.number().int().min(1).optional() },
    annotations: mutationAnnotations,
  }, async ({ build_id, title, question, playbook_id, priority, operation_budget }) => content(withWritableDb((db) => createInvestigation(db, { buildId: build_id, title, question, playbookId: playbook_id, priority, operationBudget: operation_budget }))));

  server.registerTool("hexwitness_investigation_add_item", {
    title: "Link investigation work or proof",
    description: "Add a checklist, decision, note, or exact evidence/entity/claim/gap/capture reference to a durable investigation.",
    inputSchema: { investigation_id: z.string(), kind: z.enum(["objective", "check", "decision", "note", "entity", "evidence", "claim", "gap", "capture", "attempt"]), title: z.string().min(1).max(1000), ref_id: z.string().optional(), required: z.boolean().optional(), status: z.enum(["pending", "in_progress", "done", "blocked", "skipped"]).optional(), details: z.record(z.unknown()).optional() },
    annotations: mutationAnnotations,
  }, async ({ investigation_id, kind, title, ref_id, required, status, details }) => content(withWritableDb((db) => addInvestigationItem(db, investigation_id, { kind, title, refId: ref_id, required, status, details }))));

  server.registerTool("hexwitness_investigation_update_item", {
    title: "Update investigation checklist state",
    description: "Set one investigation item to pending, in progress, done, blocked, or skipped. Required skipped items still block completion.",
    inputSchema: { investigation_id: z.string(), item_id: z.string(), status: z.enum(["pending", "in_progress", "done", "blocked", "skipped"]) },
    annotations: mutationAnnotations,
  }, async ({ investigation_id, item_id, status }) => content(withWritableDb((db) => updateInvestigationItem(db, investigation_id, item_id, { status }))));

  server.registerTool("hexwitness_investigation_set_status", {
    title: "Set investigation lifecycle state",
    description: "Set planned, active, blocked, complete, or abandoned. Completion fails unless required checks, proof links, and linked gaps satisfy the gate.",
    inputSchema: { investigation_id: z.string(), status: z.enum(["planned", "active", "blocked", "complete", "abandoned"]) },
    annotations: mutationAnnotations,
  }, async ({ investigation_id, status }) => content(withWritableDb((db) => setInvestigationStatus(db, investigation_id, status))));

  server.registerTool("hexwitness_investigation_record_usage", {
    title: "Record investigation operation usage",
    description: "Charge explicit agent-operation units against an investigation budget. Units are operator-defined operations, not provider tokens or money.",
    inputSchema: { investigation_id: z.string(), operation: z.string().min(1).max(500), units: z.number().int().min(1).optional(), note: z.string().max(2000).optional() },
    annotations: mutationAnnotations,
  }, async ({ investigation_id, operation, units, note }) => content(withWritableDb((db) => recordInvestigationUsage(db, investigation_id, { operation, units, note, source: "mcp" }))));

  registerReadOnlyTool("hexwitness_failed_attempts", {
    title: "Reuse failed-attempt memory",
    description: "List build-bound failed experiments with expected and actual outcomes, lessons, tools, versions, and linked evidence so agents do not repeat disproven work.",
    inputSchema: { investigation_id: z.string().optional(), build_id: z.string().optional(), subject: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/failed-attempts", args)));

  server.registerTool("hexwitness_failed_attempt_record", {
    title: "Record a disproven or failed method",
    description: "Persist one exact-build failed attempt with expected/actual outcome, lesson, tool identity, and optional evidence links so future agents do not repeat it blindly.",
    inputSchema: { investigation_id: z.string().optional(), build_id: z.string().optional(), subject: z.string().min(1).max(1000), method: z.string().min(1).max(4000), expected: z.string().min(1).max(4000), actual: z.string().min(1).max(4000), lesson: z.string().min(1).max(4000), tool: z.string().max(500).optional(), tool_version: z.string().max(500).optional(), evidence_ids: z.array(z.string()).max(100).optional(), metadata: z.record(z.unknown()).optional() },
    annotations: mutationAnnotations,
  }, async ({ investigation_id, build_id, subject, method, expected, actual, lesson, tool, tool_version, evidence_ids, metadata }) => content(withWritableDb((db) => recordFailedAttempt(db, { investigationId: investigation_id, buildId: build_id, subject, method, expected, actual, lesson, tool, toolVersion: tool_version, evidenceIds: evidence_ids, metadata }))));

  registerReadOnlyTool("hexwitness_evidence_challenge", {
    title: "Challenge an evidence claim set",
    description: "Deterministically gather supporting and opposing evidence, unsupported claims, contradictions, failed attempts, open gaps, and next actions. Never changes confidence or promotes a fact.",
    inputSchema: { investigation_id: z.string().optional(), build_id: z.string().optional(), subject: z.string().optional() },
  }, async (args) => content(await client.get("/v1/evidence/challenge", args)));

  registerReadOnlyTool("hexwitness_discover", {
    title: "Discover retained evidence",
    description: "Search the cross-record lexical retrieval index. Results are discovery-only candidates and include exact authoritative follow-up tools.",
    inputSchema: { query: z.string().min(2), build_id: z.string().optional(), kinds: z.array(z.enum(["entity", "evidence", "claim", "capture_event", "investigation", "failed_attempt"])).optional(), limit: z.number().int().min(1).max(250).optional() },
  }, async ({ query, build_id, kinds, limit }) => content(await client.get("/v1/discover", { q: query, build_id, kinds: kinds?.join(","), limit })));

  registerReadOnlyTool("hexwitness_discovery_context", {
    title: "Build discovery context",
    description: "Retrieve a bounded discovery-only context with provenance and exact-query follow-ups. It never promotes retrieved text into evidence or claims.",
    inputSchema: { query: z.string().min(2), build_id: z.string().optional(), kinds: z.array(z.string()).optional(), limit: z.number().int().min(1).max(250).optional(), max_chars: z.number().int().min(1000).max(50000).optional() },
  }, async ({ query, build_id, kinds, limit, max_chars }) => content(await client.get("/v1/discovery/context", { q: query, build_id, kinds: kinds?.join(","), limit, max_chars })));

  registerReadOnlyTool("hexwitness_local_tool_status", {
    title: "Inspect local analysis-tool execution policy",
    description: "Resolve agent-callable local reverse-engineering tools and show argv-only, workspace, timeout, output, and observation-authority policy.",
    inputSchema: { root: z.string().optional() },
  }, async ({ root }) => content(localToolStatus({ root: root ?? process.cwd() })));

  server.registerTool("hexwitness_run_local_tool", {
    title: "Run one bounded local analysis tool",
    description: "Run one allowlisted or project-local tool without a shell, with a root-bounded working directory and timeout/output caps. The process is not OS-sandboxed. Returns a reproducible receipt and observation-only output; optional recording creates build-bound tool-observation evidence, never a claim.",
    inputSchema: { executable: z.string().min(1), args: z.array(z.string()).max(256).optional(), root: z.string().optional(), cwd: z.string().optional(), timeout_ms: z.number().int().min(100).max(600000).optional(), record: z.boolean().optional(), build_id: z.string().optional(), summary: z.string().max(2000).optional() },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async ({ executable, args, root, cwd, timeout_ms, record, build_id, summary }) => {
    const receipt = await runLocalTool({ executable, args, cwd, timeoutMs: timeout_ms }, { root: root ?? process.cwd() });
    if (!record) return content({ receipt, observation: null });
    if (!build_id) throw new Error("build_id is required when record=true");
    const db = openEvidenceDb(loadConfig().evidenceDb);
    try { return content({ receipt, observation: recordToolObservation(db, build_id, receipt, summary) }); } finally { db.close(); }
  });

  server.registerPrompt("hexwitness_start_investigation", {
    title: "Start an evidence-first investigation",
    description: "Let the agent drive a complete memory-first investigation and escalate only proven gaps to a live viewer.",
    argsSchema: { question: z.string(), build_id: z.string().optional(), preferred_viewer: z.enum(["auto", "binary_ninja", "ida", "none"]).optional() },
  }, ({ question, build_id, preferred_viewer }) => ({ messages: [{ role: "user", content: { type: "text", text: `Investigate: ${question}\nBuild: ${build_id ?? "select the exact matching build first"}\nPreferred live viewer: ${preferred_viewer ?? "auto"}\n\nDrive the investigation without asking me to translate it into commands. Start with health, memory status, and builds. For multi-step work, resume a matching durable investigation or create one with the closest playbook, mark it active, inspect failed attempts, and charge explicit operation units as work proceeds. Use discovery only to find candidates, then resolve the exact source with search/query and read its dossier with explain. Use only the smallest focused graph, object-model, or capture queries. Run evidence_challenge before completion. If retained evidence is insufficient, use gap_report and dump_guide, choose the smallest read-only live Binary Ninja or IDA query that closes the gap, and promote only a bounded build-scoped result. Do not mutate the live analysis database without explicit authorization. Complete the investigation only when its proof gates pass. Report proven facts, strong inferences, contradictions, unknowns, and the next evidence action separately.` } }] }));

  server.registerPrompt("hexwitness_compare_runtime_behavior", {
    title: "Compare two runtime behaviors",
    description: "Find the first evidence-backed divergence between a working and failing capture, then trace it into static code.",
    argsSchema: { working_capture_id: z.string(), failing_capture_id: z.string(), question: z.string().optional() },
  }, ({ working_capture_id, failing_capture_id, question }) => ({ messages: [{ role: "user", content: { type: "text", text: `Compare working capture ${working_capture_id} with failing capture ${failing_capture_id}.\nQuestion: ${question ?? "identify the earliest meaningful divergence and its likely static consumer"}\n\nUse capture_detail for context, capture_compare for the first ordered divergence, then narrow capture_timeline/search/graph around that point. Resolve any addresses against the exact build and call explain before traversing callers, callees, xrefs, dataflow, or slices. Check evidence and contradictions. If the consumer is not retained, produce the smallest read-only live-viewer query and bounded export request needed to prove it.` } }] }));

  server.registerPrompt("hexwitness_promote_live_finding", {
    title: "Promote a live viewer finding",
    description: "Turn a transient Binary Ninja or IDA result into a minimal, build-scoped HexWitness evidence handoff.",
    argsSchema: { build_id: z.string(), viewer: z.enum(["binary_ninja", "ida", "other"]), finding: z.string(), objective: z.enum(["identity", "control_flow", "data_flow", "object_model", "protocol", "runtime", "behavior"]).optional() },
  }, ({ build_id, viewer, finding, objective }) => ({ messages: [{ role: "user", content: { type: "text", text: `Prepare a bounded promotion for this live finding.\nBuild: ${build_id}\nViewer: ${viewer}\nObjective: ${objective ?? "behavior"}\nFinding: ${finding}\n\nFirst query HexWitness to ensure the finding is not already retained. Use gap_report and dump_guide to identify the minimum records required. Return: the exact function/type/address scope, required calls/xrefs/fields/slices, provenance fields, whether decompiler text is necessary, the appropriate HexWitness exporter, and the ingest verification query. Do not request the whole database or proprietary binary bytes. Treat the finding as provisional until the exported JSONL is ingested and re-queried.` } }] }));

  server.registerPrompt("hexwitness_challenge_investigation", {
    title: "Challenge a durable investigation",
    description: "Audit one persistent investigation without allowing agent consensus to alter factual confidence.",
    argsSchema: { investigation_id: z.string() },
  }, ({ investigation_id }) => ({ messages: [{ role: "user", content: { type: "text", text: `Challenge durable investigation ${investigation_id}. Read investigation_detail, failed_attempts, and evidence_challenge. Separate supporting evidence, opposing evidence, contradictions, unsupported claims, open gaps, and repeated-failure risks. Do not alter confidence because agents agree. Recommend the smallest evidence action that changes the factual record.` } }] }));

  return server;
}

export async function startMcp() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  return server;
}
