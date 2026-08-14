import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { ingestFile, ingestRecords } from "../src/ingest.mjs";
import { FORMAT } from "../src/constants.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { contradictions, explain, search, stats } from "../src/query.mjs";
import { canonicalAddress } from "../src/util.mjs";

test("canonical addresses preserve unsigned 64-bit values", () => {
  assert.equal(canonicalAddress("0xFFFFFFFFFFFFFFFF"), "0xffffffffffffffff");
  assert.equal(canonicalAddress(4198400), "0x401000");
  assert.throws(() => canonicalAddress(Number.MAX_VALUE), /unsafe numeric address/);
  assert.throws(() => canonicalAddress("00401120"), /requires 0x prefix/);
});

test("evidence upserts preserve existing provenance links", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-provenance-"));
  const dbPath = join(root, "evidence.db");
  const db = openEvidenceDb(dbPath);
  try {
    const base = (record, fields) => ({ format: FORMAT, record, ...fields });
    ingestRecords(db, [
      base("build", { build_id: "build", label: "Build" }),
      base("entity", { build_id: "build", kind: "function", stable_key: "fn:0x1", address: "0x1" }),
      base("evidence", { build_id: "build", evidence_id: "evidence", source: "static", source_ref: "fn:0x1", summary: "first", entities: ["fn:0x1"] }),
    ]);
    ingestRecords(db, [base("evidence", { build_id: "build", evidence_id: "evidence", source: "static", source_ref: "fn:0x1", summary: "updated" })]);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM entity_evidence WHERE evidence_id='evidence'").get().count, 1);
    assert.equal(db.prepare("SELECT summary FROM evidence WHERE evidence_id='evidence'").get().summary, "updated");
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test("demo ingestion is idempotent and explain returns a dossier", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-"));
  const dbPath = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  try {
    const first = await ingestFile(dbPath, fixture);
    const second = await ingestFile(dbPath, fixture);
    assert.equal(first.accepted, 15);
    assert.equal(first.memory_mode, "streaming-atomic");
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

test("streaming ingest rolls back the complete import on a late invalid record", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-atomic-"));
  const dbPath = join(root, "evidence.db");
  const input = join(root, "invalid.jsonl");
  try {
    writeFileSync(input, `${JSON.stringify({ format: FORMAT, record: "build", build_id: "atomic", label: "Atomic" })}\n${JSON.stringify({ format: FORMAT, record: "entity", build_id: "atomic", kind: "function", stable_key: "fn:0x1", address: "0x1" })}\n{"format":"hexwitness-jsonl-v1","record":"entity"}\n`);
    await assert.rejects(() => ingestFile(dbPath, input), /missing build_id/);
    const db = openEvidenceDb(dbPath, { readOnly: true });
    assert.equal(stats(db).builds, 0);
    assert.equal(stats(db).entities, 0);
    assert.equal(stats(db).imports, 1);
    assert.equal(db.prepare("SELECT status FROM import_runs").get().status, "failed");
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
