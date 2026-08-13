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

const parse = (result) => JSON.parse(result.content[0].text);

test("an MCP-only agent can create, maintain, challenge, and complete a durable investigation", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-mcp-investigation-"));
  const dbPath = join(root, "evidence.db");
  const previous = process.env.HEXWITNESS_DB;
  let server; let client;
  try {
    await ingestFile(dbPath, resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl"));
    process.env.HEXWITNESS_DB = dbPath;
    server = createMcpServer({ get: async () => ({}) });
    client = new Client({ name: "investigator", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const created = parse(await client.callTool({ name: "hexwitness_investigation_create", arguments: { build_id: "toy-v1", title: "MCP-only proof", playbook_id: "binary", operation_budget: 10 } }));
    const id = created.investigation.investigation_id;
    parse(await client.callTool({ name: "hexwitness_investigation_set_status", arguments: { investigation_id: id, status: "active" } }));
    for (const item of created.items) parse(await client.callTool({ name: "hexwitness_investigation_update_item", arguments: { investigation_id: id, item_id: item.item_id, status: "done" } }));
    parse(await client.callTool({ name: "hexwitness_investigation_add_item", arguments: { investigation_id: id, kind: "evidence", title: "Dispatcher proof", ref_id: "evidence_static_dispatch" } }));
    const usage = parse(await client.callTool({ name: "hexwitness_investigation_record_usage", arguments: { investigation_id: id, operation: "explain", units: 1 } }));
    assert.equal(usage.budget.remaining, 9);
    const failed = parse(await client.callTool({ name: "hexwitness_failed_attempt_record", arguments: { investigation_id: id, subject: "fn:0x401120", method: "guess kind 9", expected: "decode", actual: "no evidence", lesson: "query first", evidence_ids: ["evidence_static_dispatch"] } }));
    assert.equal(failed.evidence.length, 1);
    const completed = parse(await client.callTool({ name: "hexwitness_investigation_set_status", arguments: { investigation_id: id, status: "complete" } }));
    assert.equal(completed.investigation.status, "complete");
    const db = openEvidenceDb(dbPath, { readOnly: true });
    try { assert.equal(db.prepare("SELECT COUNT(*) AS count FROM investigations WHERE investigation_id=?").get(id).count, 1); } finally { db.close(); }
  } finally {
    if (client) await client.close(); if (server) await server.close();
    if (previous == null) delete process.env.HEXWITNESS_DB; else process.env.HEXWITNESS_DB = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
