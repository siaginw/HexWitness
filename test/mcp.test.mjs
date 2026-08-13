import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.mjs";

test("MCP publishes the agent-first evidence vocabulary", async () => {
  const fake = { get: async (path) => path === "/v1/health" ? { ok: true } : path === "/v1/contract" ? { stability: "stable-1.x" } : [] };
  const server = createMcpServer(fake);
  const client = new Client({ name: "hexwitness-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    const mutationTools = new Set(["hexwitness_investigation_create", "hexwitness_investigation_add_item", "hexwitness_investigation_update_item", "hexwitness_investigation_set_status", "hexwitness_investigation_record_usage", "hexwitness_failed_attempt_record"]);
    for (const tool of listed.tools) {
      if (tool.name === "hexwitness_run_local_tool") {
        assert.deepEqual(tool.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true });
        continue;
      }
      if (mutationTools.has(tool.name)) {
        assert.deepEqual(tool.annotations, { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
        continue;
      }
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      }, `${tool.name} must advertise the read-only contract`);
    }
    for (const expected of ["hexwitness_health", "hexwitness_contract", "hexwitness_memory_status", "hexwitness_search", "hexwitness_query", "hexwitness_explain", "hexwitness_gap_report", "hexwitness_dump_guide", "hexwitness_contradictions", "hexwitness_class", "hexwitness_uuid", "hexwitness_types", "hexwitness_offsets", "hexwitness_metadata", "hexwitness_decomp_search", "hexwitness_path", "hexwitness_compare_builds", "hexwitness_dataflow", "hexwitness_capture_timeline", "hexwitness_capture_compare", "hexwitness_discover", "hexwitness_discovery_context", "hexwitness_local_tool_status", "hexwitness_run_local_tool", "hexwitness_evidence_challenge", ...mutationTools]) {
      assert.equal(names.has(expected), true, `missing ${expected}`);
    }
    const health = await client.callTool({ name: "hexwitness_health", arguments: {} });
    assert.match(health.content[0].text, /"ok": true/);
    const contract = await client.callTool({ name: "hexwitness_contract", arguments: {} });
    assert.match(contract.content[0].text, /stable-1.x/);

    const prompts = await client.listPrompts();
    const promptNames = new Set(prompts.prompts.map((prompt) => prompt.name));
    for (const expected of ["hexwitness_start_investigation", "hexwitness_compare_runtime_behavior", "hexwitness_promote_live_finding", "hexwitness_challenge_investigation"]) {
      assert.equal(promptNames.has(expected), true, `missing ${expected}`);
    }

    const investigation = await client.getPrompt({
      name: "hexwitness_start_investigation",
      arguments: { question: "What parses message 17?", build_id: "toy-v1", preferred_viewer: "binary_ninja" },
    });
    assert.match(investigation.messages[0].content.text, /Drive the investigation/);
    assert.match(investigation.messages[0].content.text, /gap_report/);
    assert.match(investigation.messages[0].content.text, /Do not mutate/);

    const resources = await client.listResources();
    assert.equal(resources.resources.some((resource) => resource.uri === "hexwitness://agent-guide"), true);
    const guide = await client.readResource({ uri: "hexwitness://agent-guide" });
    assert.match(guide.contents[0].text, /HexWitness agent instructions/);
  } finally {
    await client.close();
    await server.close();
  }
});
