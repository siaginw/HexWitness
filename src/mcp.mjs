import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DaemonClient } from "./mcp-client.mjs";
import { VERSION } from "./constants.mjs";

function content(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function createMcpServer(client = new DaemonClient()) {
  const server = new McpServer({ name: "hexwitness", version: VERSION }, {
    instructions: `HexWitness provides evidence-backed reverse-engineering queries. Start with hexwitness_health and hexwitness_builds. Resolve uncertain names with hexwitness_search before calling hexwitness_explain. Treat claims as hypotheses unless supported by evidence. Report contradictions rather than silently selecting one value.`,
  });

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

  server.registerTool("hexwitness_activity_summary", {
    title: "Summarize retained tool usage",
    description: "Show operation counts, average latency, and failures. Arguments and result content are never retained.",
    inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  }, async (args) => content(await client.get("/v1/activity", args)));

  server.registerPrompt("hexwitness_start_investigation", {
    title: "Start an evidence-first investigation",
    description: "Canonical agent workflow for a new binary question.",
    argsSchema: { question: z.string(), build_id: z.string().optional() },
  }, ({ question, build_id }) => ({ messages: [{ role: "user", content: { type: "text", text: `Investigate: ${question}\nBuild: ${build_id ?? "select the matching build first"}\n\nUse HexWitness in this order: health, builds, search, explain, focused callers/callees/xrefs, evidence, contradictions. Separate proven facts from hypotheses. Identify the smallest missing dump or runtime observation needed to close each gap.` } }] }));

  return server;
}

export async function startMcp() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
