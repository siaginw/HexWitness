import { DatabaseSync } from "node:sqlite";
import { ACTIVITY_SCHEMA_SQL, EVIDENCE_SCHEMA_SQL } from "./schema.mjs";
import { ensureParent, nowUtc } from "./util.mjs";
import { SCHEMA_VERSION } from "./constants.mjs";

export function openEvidenceDb(path, { readOnly = false } = {}) {
  if (!readOnly) ensureParent(path);
  const db = new DatabaseSync(path, { readOnly });
  if (!readOnly) {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
    db.exec(EVIDENCE_SCHEMA_SQL);
    db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)").run("schema_version", String(SCHEMA_VERSION));
    db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)").run("created_utc", nowUtc());
  }
  return db;
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
