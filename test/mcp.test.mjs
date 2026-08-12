import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.mjs";

test("MCP publishes the agent-first evidence vocabulary", async () => {
  const fake = { get: async (path) => path === "/v1/health" ? { ok: true } : [] };
  const server = createMcpServer(fake);
  const client = new Client({ name: "hexwitness-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    for (const expected of ["hexwitness_health", "hexwitness_search", "hexwitness_explain", "hexwitness_gap_report", "hexwitness_dump_guide", "hexwitness_contradictions"]) {
      assert.equal(names.has(expected), true, `missing ${expected}`);
    }
    const health = await client.callTool({ name: "hexwitness_health", arguments: {} });
    assert.match(health.content[0].text, /"ok": true/);
  } finally {
    await client.close();
    await server.close();
  }
});
