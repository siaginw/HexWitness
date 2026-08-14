import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { backupEvidenceDb } from "../src/backup.mjs";
import { isSupportedNode, publicContract } from "../src/contract.mjs";
import { evidenceSchemaVersion, openEvidenceDb } from "../src/db.mjs";
import { ingestFile } from "../src/ingest.mjs";
import { stats } from "../src/query.mjs";
import { downgradeFixtureToSchema1, downgradeFixtureToSchema2 } from "../scripts/schema-v1-fixture.mjs";
import { SCHEMA_VERSION, VERSION } from "../src/constants.mjs";

test("public 1.x contract is machine-readable and explicit", () => {
  const contract = publicContract();
  assert.equal(contract.version, VERSION);
  assert.equal(contract.stability, "stable-1.x");
  assert.equal(contract.interchange.format, "hexwitness-jsonl-v1");
  assert.equal(contract.database.future_versions, "fail-closed");
  for (const command of ["agent", "adapters", "backup", "capture", "contract", "doctor"]) {
    assert.equal(contract.cli.commands.includes(command), true, `missing stable command ${command}`);
  }
});

test("Node compatibility enforces the exact 22.13 floor", () => {
  assert.equal(isSupportedNode("22.12.9"), false);
  assert.equal(isSupportedNode("22.13.0"), true);
  assert.equal(isSupportedNode("24.0.0"), true);
  assert.equal(isSupportedNode("invalid"), false);
});

test("schema migration retains evidence and future schemas fail closed", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-migration-"));
  const path = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  let db;
  try {
    await ingestFile(path, fixture);
    db = openEvidenceDb(path);
    downgradeFixtureToSchema1(db);
    db.close();

    db = openEvidenceDb(path);
    assert.equal(evidenceSchemaVersion(db), SCHEMA_VERSION);
    assert.equal(stats(db).entities, 4);
    assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name IN ('capture_artifacts','entities_fts','events_fts')").get().count, 3);
    db.prepare("UPDATE meta SET value='999' WHERE key='schema_version'").run();
    db.close();

    assert.throws(() => openEvidenceDb(path, { readOnly: true }), /newer than supported/);
    assert.throws(() => openEvidenceDb(path), /newer than supported/);
  } finally { try { db?.close(); } catch {} rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test("read-only access rejects a database that still needs migration", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-readonly-migration-"));
  const path = join(root, "evidence.db");
  try {
    const db = openEvidenceDb(path);
    downgradeFixtureToSchema1(db);
    db.close();
    assert.throws(
      () => openEvidenceDb(path, { readOnly: true }),
      /requires migration to schema 4/,
    );
  } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test("schema 2 migrates to durable investigations without disturbing evidence", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-migration-v2-"));
  const path = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  let db;
  try {
    await ingestFile(path, fixture);
    db = openEvidenceDb(path);
    downgradeFixtureToSchema2(db);
    db.close();
    assert.throws(() => openEvidenceDb(path, { readOnly: true }), /requires migration to schema 4/);
    db = openEvidenceDb(path);
    assert.equal(evidenceSchemaVersion(db), SCHEMA_VERSION);
    assert.equal(stats(db).entities, 4);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('investigations','investigation_items','failed_attempts','investigation_usage')").get().count, 4);
    db.close();
  } finally { try { db?.close(); } catch {} rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
});

test("backup creates an integrity-checked evidence snapshot without overwriting", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-backup-"));
  const source = join(root, "evidence.db");
  const output = join(root, "backups", "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  try {
    await ingestFile(source, fixture);
    const result = backupEvidenceDb(source, output);
    assert.equal(result.ok, true);
    assert.equal(result.integrity, "ok");
    assert.equal(result.sha256.length, 64);
    assert.equal(existsSync(output), true);
    const backup = openEvidenceDb(output, { readOnly: true });
    assert.equal(stats(backup).entities, 4);
    backup.close();
    assert.throws(() => backupEvidenceDb(source, output), /already exists/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
