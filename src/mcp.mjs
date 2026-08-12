import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { DaemonClient } from "./mcp-client.mjs";
import { VERSION } from "./constants.mjs";
import { NATIVE_SKILL_CLIENTS, readAgentGuidance } from "./agent-guidance.mjs";

function content(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
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

  server.registerResource("hexwitness-agent-guide", "hexwitness://agent-guide", {
    title: `HexWitness workflow for ${agentClient}`,
    description: "Client-tailored evidence-first investigation workflow installed with HexWitness.",
    mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: agentGuide }] }));

  server.registerTool("hexwitness_health", {
    title: "HexWitness health",
    description: "Check daemon health, build inventory, and indexed evidence counts.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/health")));

  server.registerTool("hexwitness_builds", {
    title: "List indexed builds",
    description: "List binary builds and provenance available for queries.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/builds")));

  server.registerTool("hexwitness_memory_status", {
    title: "Inspect durable evidence memory",
    description: "Show what HexWitness retains, database size and counts, latest ingest/capture, privacy-preserving activity, and the query-before-live-tool reuse policy.",
    inputSchema: {},
  }, async () => content(await client.get("/v1/memory")));

  server.registerTool("hexwitness_search", {
    title: "Search binary entities",
    description: "Search functions, symbols, strings, types, classes, imports, and runtime objects.",
    inputSchema: {
      query: z.string().describe("Name, address fragment, stable key, or signature text"),
      build_id: z.string().optional(),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(250).optional(),
    },
  }, async ({ query, build_id, kind, limit }) => content(await client.get("/v1/search", { q: query, build_id, kind, limit })));

  server.registerTool("hexwitness_query", {
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

  server.registerTool("hexwitness_explain", {
    title: "Explain an entity",
    description: "Return one evidence dossier: identity, signature, decompilation when retained, callers, callees, references, runtime hits, claims, and provenance.",
    inputSchema: {
      build_id: z.string().optional(),
      address: z.string().optional().describe("Hex virtual address"),
      stable_key: z.string().optional(),
      entity_id: z.string().optional(),
    },
  }, async (args) => content(await client.get("/v1/explain", args)));

  server.registerTool("hexwitness_gap_report", {
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

  server.registerTool("hexwitness_dump_guide", {
    title: "Get an evidence export checklist",
    description: "Return vendor-neutral fields, provenance, privacy boundaries, and preferred adapters for a reverse-engineering objective.",
    inputSchema: { objective: z.enum(["identity", "control_flow", "data_flow", "object_model", "protocol", "runtime", "behavior"]).optional() },
  }, async (args) => content(await client.get("/v1/guide/dump", args)));

  for (const [name, description] of [
    ["callers", "Find direct callers of a function."],
    ["callees", "Find direct callees of a function."],
    ["xrefs", "Find incoming and outgoing code/data references."],
  ]) {
    server.registerTool(`hexwitness_${name}`, {
      title: `HexWitness ${name}`,
      description,
      inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
    }, async (args) => content(await client.get(`/v1/${name}`, args)));
  }

  server.registerTool("hexwitness_reach", {
    title: "Traverse the analysis graph",
    description: "Bounded incoming or outgoing graph traversal for calls, references, ownership, or arbitrary edge kinds.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), direction: z.enum(["incoming", "outgoing"]).optional(), kind: z.string().optional(), depth: z.number().int().min(1).max(12).optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/reach", args)));

  server.registerTool("hexwitness_dataflow", {
    title: "Trace data flow",
    description: "Traverse structured reads, writes, loads, stores, definitions, uses, aliases, parameters, and return edges.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), direction: z.enum(["incoming", "outgoing", "both"]).optional(), depth: z.number().int().min(1).max(12).optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/dataflow", args)));

  server.registerTool("hexwitness_slices", {
    title: "Get analysis slices",
    description: "Return retained decompiler, IL, SSA, basic-block, codec, or manually bounded slices for one entity.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/slices", args)));

  server.registerTool("hexwitness_functions", {
    title: "List functions",
    description: "Inventory functions or methods for an exact build with optional name/signature filter.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), named: z.boolean().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async ({ build_id, query, named, limit }) => content(await client.get("/v1/functions", { build_id, q: query, named, limit })));

  server.registerTool("hexwitness_classes", {
    title: "Search object model",
    description: "Search classes, types, fields, methods, vtables, slots, and enums for an exact build.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), limit: z.number().int().min(1).max(1000).optional() },
  }, async ({ build_id, query, limit }) => content(await client.get("/v1/classes", { build_id, q: query, limit })));

  server.registerTool("hexwitness_class", {
    title: "Explain a class",
    description: "Return one class/type with its fields, methods, inheritance, interfaces, and vtable relationships.",
    inputSchema: { build_id: z.string().optional(), name: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/class", args)));

  server.registerTool("hexwitness_vtable", {
    title: "Explain a vtable",
    description: "Return one vtable or class and its slot-to-function relationships.",
    inputSchema: { build_id: z.string().optional(), address: z.string().optional(), stable_key: z.string().optional(), entity_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/vtable", args)));

  server.registerTool("hexwitness_uuid", {
    title: "Resolve a UUID",
    description: "Resolve a UUID/GUID across stable keys, names, and structured type metadata for an optional exact build.",
    inputSchema: { uuid: z.string(), build_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/uuid", args)));

  server.registerTool("hexwitness_types", {
    title: "Query type registry",
    description: "Query types, classes, enums, vtables, and slots exported by any supported analysis tool.",
    inputSchema: { build_id: z.string(), query: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ build_id, query, kind, limit }) => content(await client.get("/v1/types", { build_id, q: query, kind, limit })));

  server.registerTool("hexwitness_offsets", {
    title: "Query field offsets",
    description: "Query exported field offsets by exact build, owner class/type, field name, or signature.",
    inputSchema: { build_id: z.string(), owner: z.string().optional(), query: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ build_id, owner, query, limit }) => content(await client.get("/v1/offsets", { build_id, owner, q: query, limit })));

  server.registerTool("hexwitness_metadata", {
    title: "Resolve hashes, assets, codecs, and metadata",
    description: "Generic metadata lookup for hashes, IDs, assets, resources, codecs, protocol fragments, or project-defined attributes without target-specific assumptions.",
    inputSchema: { query: z.string(), build_id: z.string().optional(), kinds: z.array(z.string()).optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ query, build_id, kinds, limit }) => content(await client.get("/v1/metadata", { q: query, build_id, kinds: kinds?.join(","), limit })));

  server.registerTool("hexwitness_decomp_search", {
    title: "Search decompiler and IL slices",
    description: "Search retained opt-in decompiler text and bounded IL/SSA/codec slices for an exact build.",
    inputSchema: { build_id: z.string(), query: z.string(), kind: z.string().optional(), limit: z.number().int().min(1).max(1000).optional() },
  }, async ({ build_id, query, kind, limit }) => content(await client.get("/v1/decomp/search", { build_id, q: query, kind, limit })));

  server.registerTool("hexwitness_path", {
    title: "Find the shortest graph path",
    description: "Find a bounded shortest path between two build-scoped entities using optional edge-kind filtering.",
    inputSchema: { build_id: z.string(), from_address: z.string().optional(), from_key: z.string().optional(), from_entity: z.string().optional(), to_address: z.string().optional(), to_key: z.string().optional(), to_entity: z.string().optional(), kind: z.string().optional(), direction: z.enum(["incoming", "outgoing"]).optional(), depth: z.number().int().min(1).max(20).optional() },
  }, async (args) => content(await client.get("/v1/path", args)));

  server.registerTool("hexwitness_edge_kinds", {
    title: "List graph edge kinds",
    description: "Inventory exported relationship kinds and source/target coverage for an optional build.",
    inputSchema: { build_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/edges/kinds", args)));

  server.registerTool("hexwitness_compare_builds", {
    title: "Compare binary builds",
    description: "Compare stable entities across two builds and report additions, removals, and identity/signature/address changes.",
    inputSchema: { left: z.string(), right: z.string(), limit: z.number().int().min(1).max(10000).optional() },
  }, async (args) => content(await client.get("/v1/builds/compare", args)));

  server.registerTool("hexwitness_evidence", {
    title: "List evidence",
    description: "List static, dynamic, capture, documentary, synthetic, or manually asserted evidence with provenance and confidence.",
    inputSchema: { build_id: z.string().optional(), source: z.string().optional(), classification: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/evidence", args)));

  server.registerTool("hexwitness_contradictions", {
    title: "Find contradictions",
    description: "Return claim groups where active evidence-backed assertions disagree.",
    inputSchema: { build_id: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/contradictions", args)));

  server.registerTool("hexwitness_coverage", {
    title: "Report evidence coverage",
    description: "Summarize naming, signature, decompilation, evidence, runtime, and capture coverage by build.",
    inputSchema: { build_id: z.string().optional() },
  }, async (args) => content(await client.get("/v1/coverage", args)));

  server.registerTool("hexwitness_worklist", {
    title: "List unresolved evidence gaps",
    description: "Return prioritized static/runtime evidence gaps without guessing missing behavior.",
    inputSchema: { build_id: z.string().optional(), capture_id: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/gaps/worklist", args)));

  server.registerTool("hexwitness_captures", {
    title: "List capture packs",
    description: "List indexed, build-bound controlled runtime capture packs and quality metadata.",
    inputSchema: { build_id: z.string().optional(), scenario: z.string().optional(), status: z.string().optional(), limit: z.number().int().min(1).max(500).optional() },
  }, async (args) => content(await client.get("/v1/captures", args)));

  server.registerTool("hexwitness_capture_detail", {
    title: "Inspect a capture",
    description: "Return capture metadata, artifacts, markers, relationships, and event-family counts.",
    inputSchema: { capture_id: z.string() },
  }, async (args) => content(await client.get("/v1/captures/detail", args)));

  server.registerTool("hexwitness_capture_timeline", {
    title: "Read capture timeline",
    description: "Read a bounded normalized event timeline with source/kind/name filters.",
    inputSchema: { capture_id: z.string(), after: z.number().int().min(0).optional(), source: z.string().optional(), kind: z.string().optional(), name: z.string().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/captures/timeline", args)));

  server.registerTool("hexwitness_capture_search", {
    title: "Search capture evidence",
    description: "Search normalized capture names, summaries, and safe structured fields across one or all captures.",
    inputSchema: { query: z.string(), capture_id: z.string().optional(), direction: z.string().optional(), kind: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() },
  }, async ({ query, ...args }) => content(await client.get("/v1/captures/search", { ...args, q: query })));

  server.registerTool("hexwitness_capture_graph", {
    title: "Read capture relationship graph",
    description: "Return normalized runtime relationships such as request-to-response, actor-to-archetype, state-to-consumer, or marker-to-event.",
    inputSchema: { capture_id: z.string(), kind: z.string().optional(), limit: z.number().int().min(1).max(5000).optional() },
  }, async (args) => content(await client.get("/v1/captures/graph", args)));

  server.registerTool("hexwitness_capture_compare", {
    title: "Compare captures",
    description: "Compare normalized event families and report the first ordered divergence between two captures.",
    inputSchema: { left: z.string(), right: z.string() },
  }, async (args) => content(await client.get("/v1/captures/compare", args)));

  server.registerTool("hexwitness_activity_summary", {
    title: "Summarize retained tool usage",
    description: "Show operation counts, average latency, and failures. Arguments and result content are never retained.",
    inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  }, async (args) => content(await client.get("/v1/activity", args)));

  server.registerPrompt("hexwitness_start_investigation", {
    title: "Start an evidence-first investigation",
    description: "Let the agent drive a complete memory-first investigation and escalate only proven gaps to a live viewer.",
    argsSchema: { question: z.string(), build_id: z.string().optional(), preferred_viewer: z.enum(["auto", "binary_ninja", "ida", "none"]).optional() },
  }, ({ question, build_id, preferred_viewer }) => ({ messages: [{ role: "user", content: { type: "text", text: `Investigate: ${question}\nBuild: ${build_id ?? "select the exact matching build first"}\nPreferred live viewer: ${preferred_viewer ?? "auto"}\n\nDrive the investigation without asking me to translate it into commands. Start with health, memory status, and builds. Resolve the target with search/query, read its dossier with explain, then use only the smallest focused graph, object-model, or capture queries. Inspect evidence and contradictions before drawing a conclusion. If retained evidence is insufficient, use gap_report and dump_guide, choose the smallest read-only live Binary Ninja or IDA query that closes the gap, and state the exact bounded export needed to promote that result into HexWitness. Do not mutate the live analysis database without explicit authorization. Report proven facts, strong inferences, contradictions, unknowns, and the next evidence action separately.` } }] }));

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

  return server;
}

export async function startMcp() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  return server;
}
