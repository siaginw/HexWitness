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
      const discoveryReady = db.prepare("SELECT value FROM meta WHERE key='discovery_backfill_v1'").get()?.value === "complete";
      if (!discoveryReady) {
        db.exec(`DELETE FROM discovery_fts;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT entity_id,build_id,'entity',COALESCE(name,stable_key),COALESCE(signature,'')||' '||COALESCE(decompiler,'')||' '||stable_key,metadata_json FROM entities;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT evidence_id,build_id,'evidence',summary,source||' '||source_ref||' '||summary,metadata_json FROM evidence;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT claim_id,build_id,'claim',subject||' '||predicate,subject||' '||predicate||' '||object_json,json_object('subject',subject,'status',status) FROM claims;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT e.event_id,c.build_id,'capture_event',e.name,e.source||' '||e.kind||' '||e.name||' '||COALESCE(e.summary,'')||' '||e.fields_json,json_object('capture_id',e.capture_id,'ordinal',e.ordinal) FROM events e JOIN captures c ON c.capture_id=e.capture_id;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT investigation_id,build_id,'investigation',title,question||' '||title,json_object('status',status,'playbook_id',playbook_id) FROM investigations;
          INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) SELECT attempt_id,build_id,'failed_attempt',subject||' — '||method,subject||' '||method||' '||expected_result||' '||actual_result||' '||lesson,json_object('investigation_id',investigation_id,'tool',tool,'tool_version',tool_version) FROM failed_attempts;`);
        db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("discovery_backfill_v1", "complete");
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
