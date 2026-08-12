import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { contradictions, explain, search, stats } from "../src/query.mjs";
import { canonicalAddress } from "../src/util.mjs";

test("canonical addresses preserve unsigned 64-bit values", () => {
  assert.equal(canonicalAddress("0xFFFFFFFFFFFFFFFF"), "0xffffffffffffffff");
  assert.equal(canonicalAddress(4198400), "0x401000");
  assert.throws(() => canonicalAddress(Number.MAX_VALUE), /unsafe numeric address/);
});

test("demo ingestion is idempotent and explain returns a dossier", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-"));
  const dbPath = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  try {
    const first = await ingestFile(dbPath, fixture);
    const second = await ingestFile(dbPath, fixture);
    assert.equal(first.accepted, 15);
    assert.equal(second.accepted, 15);

    const db = openEvidenceDb(dbPath, { readOnly: true });
    const counts = stats(db);
    assert.equal(counts.builds, 1);
    assert.equal(counts.entities, 4);
    assert.equal(counts.edges, 3);
    assert.equal(counts.imports, 2);

    const found = search(db, { q: "dispatch", buildId: "toy-v1" });
    assert.equal(found[0].name, "dispatch_request");

    const dossier = explain(db, { buildId: "toy-v1", address: "0x401120" });
    assert.equal(dossier.entity.name, "dispatch_request");
    assert.equal(dossier.callers.length, 1);
    assert.equal(dossier.callees.length, 1);
    assert.equal(dossier.runtime.length, 1);
    assert.equal(dossier.claims.length, 2);

    const conflicts = contradictions(db, { buildId: "toy-v1" });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].claims.length, 2);
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("address lookup fails closed when more than one build matches", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-ambiguous-"));
  const dbPath = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  try {
    await ingestFile(dbPath, fixture);
    const db = openEvidenceDb(dbPath);
    db.prepare(`INSERT INTO builds(build_id,label,created_utc,metadata_json) VALUES(?,?,?,?)`).run("toy-v2", "Toy v2", new Date().toISOString(), "{}");
    db.prepare(`INSERT INTO entities(entity_id,build_id,kind,stable_key,name,address,metadata_json) VALUES(?,?,?,?,?,?,?)`).run(
      "entity_toy_v2_dispatch", "toy-v2", "function", "fn:0x401120", "dispatch_request", "0x401120", "{}",
    );
    assert.throws(() => explain(db, { address: "0x401120" }), /specify build_id/);
    assert.equal(explain(db, { buildId: "toy-v2", address: "0x401120" }).entity.build_id, "toy-v2");
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
