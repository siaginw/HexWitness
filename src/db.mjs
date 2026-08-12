import { DatabaseSync } from "node:sqlite";
import { ACTIVITY_SCHEMA_SQL, EVIDENCE_SCHEMA_SQL } from "./schema.mjs";
import { ensureParent, nowUtc } from "./util.mjs";
import { MIN_READABLE_SCHEMA_VERSION, SCHEMA_VERSION } from "./constants.mjs";

function schemaVersion(db) {
  const hasMeta = db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='meta'").get()?.present === 1;
  if (!hasMeta) return null;
  const value = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value;
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`invalid evidence schema version: ${value}`);
  return parsed;
}

function assertReadableVersion(version, { readOnly = false } = {}) {
  if (version == null) {
    if (readOnly) throw new Error("evidence database is unversioned; open it once with a writable HexWitness 1.x command to migrate it");
    return;
  }
  if (version > SCHEMA_VERSION) throw new Error(`evidence schema ${version} is newer than supported schema ${SCHEMA_VERSION}; upgrade HexWitness`);
  if (version < MIN_READABLE_SCHEMA_VERSION) throw new Error(`evidence schema ${version} is older than minimum readable schema ${MIN_READABLE_SCHEMA_VERSION}`);
  if (readOnly && version < SCHEMA_VERSION) {
    throw new Error(`evidence schema ${version} requires migration to schema ${SCHEMA_VERSION}; run a writable HexWitness 1.x command first`);
  }
}

export function openEvidenceDb(path, { readOnly = false } = {}) {
  if (!readOnly) ensureParent(path);
  const db = new DatabaseSync(path, { readOnly });
  try {
    const existingVersion = schemaVersion(db);
    assertReadableVersion(existingVersion, { readOnly });
    if (!readOnly) {
      db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
      db.exec(EVIDENCE_SCHEMA_SQL);
      const ftsReady = db.prepare("SELECT value FROM meta WHERE key='fts_backfill_v1'").get()?.value === "complete";
      if (!ftsReady) {
        db.exec(`DELETE FROM entities_fts;
          INSERT INTO entities_fts(entity_id,build_id,kind,name,stable_key,signature,decompiler,metadata)
          SELECT entity_id,build_id,kind,name,stable_key,signature,decompiler,metadata_json FROM entities;
          DELETE FROM events_fts;
          INSERT INTO events_fts(event_id,capture_id,source,kind,direction,name,summary,fields)
          SELECT event_id,capture_id,source,kind,direction,name,summary,fields_json FROM events;`);
        db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("fts_backfill_v1", "complete");
      }
      db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("schema_version", String(SCHEMA_VERSION));
      db.exec(`PRAGMA user_version=${SCHEMA_VERSION};`);
      db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)").run("created_utc", nowUtc());
    }
    return db;
  } catch (error) {
    try { db.close(); } catch {}
    throw error;
  }
}

export function evidenceSchemaVersion(db) {
  return schemaVersion(db);
}

export function openActivityDb(path) {
  ensureParent(path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
  db.exec(ACTIVITY_SCHEMA_SQL);
  return db;
}

export function transaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}
