import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.mjs";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";

test("MCP local execution can retain only explicit build-bound observation evidence", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-mcp-exec-"));
  const dbPath = join(root, "evidence.db");
  const previous = process.env.HEXWITNESS_DB;
  let server; let client;
  try {
    await ingestFile(dbPath, resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl"));
    process.env.HEXWITNESS_DB = dbPath;
    server = createMcpServer({ get: async () => ({}) });
    client = new Client({ name: "hexwitness-exec-test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({ name: "hexwitness_run_local_tool", arguments: { executable: "node", args: ["-e", "process.stdout.write('observed')"], root, record: true, build_id: "toy-v1", summary: "Bounded MCP observation" } });
    const body = JSON.parse(result.content[0].text);
    assert.equal(body.receipt.stdout, "observed");
    assert.equal(body.observation.claim_created, false);
    const db = openEvidenceDb(dbPath, { readOnly: true });
    try {
      const row = db.prepare("SELECT classification FROM evidence WHERE evidence_id=?").get(body.observation.evidence_id);
      assert.equal(row.classification, "tool-observation");
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM claims").get().count, 2);
    } finally { db.close(); }
  } finally {
    if (client) await client.close();
    if (server) await server.close();
    if (previous == null) delete process.env.HEXWITNESS_DB; else process.env.HEXWITNESS_DB = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
