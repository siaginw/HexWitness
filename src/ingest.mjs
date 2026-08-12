import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { FORMAT } from "./constants.mjs";
import { openEvidenceDb, transaction } from "./db.mjs";
import { validateRecord } from "./records.mjs";
import { json, newId, nowUtc, stableId } from "./util.mjs";

function resolveEntityId(db, buildId, stableKey) {
  return db.prepare("SELECT entity_id FROM entities WHERE build_id=? AND stable_key=?").get(buildId, stableKey)?.entity_id ?? null;
}

function applyRecord(db, record) {
  const metadata = json(record.metadata);
  switch (record.record) {
    case "build": {
      db.prepare(`INSERT INTO builds(build_id,label,sha256,architecture,image_base,tool,tool_version,created_utc,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(build_id) DO UPDATE SET
        label=excluded.label, sha256=COALESCE(excluded.sha256,builds.sha256), architecture=COALESCE(excluded.architecture,builds.architecture),
        image_base=COALESCE(excluded.image_base,builds.image_base), tool=COALESCE(excluded.tool,builds.tool),
        tool_version=COALESCE(excluded.tool_version,builds.tool_version), metadata_json=excluded.metadata_json`).run(
        record.build_id, record.label, record.sha256 ?? null, record.architecture ?? null, record.image_base ?? null,
        record.tool ?? null, record.tool_version ?? null, record.created_utc ?? nowUtc(), metadata,
      );
      return;
    }
    case "artifact": {
      const id = record.artifact_id ?? stableId("artifact", record.build_id, record.role, record.sha256, record.path_hint);
      db.prepare(`INSERT OR REPLACE INTO artifacts(artifact_id,build_id,role,path_hint,sha256,size_bytes,metadata_json) VALUES(?,?,?,?,?,?,?)`).run(
        id, record.build_id, record.role, record.path_hint ?? null, record.sha256 ?? null, record.size_bytes ?? null, metadata,
      );
      return;
    }
    case "entity": {
      const id = record.entity_id ?? stableId("entity", record.build_id, record.stable_key);
      db.prepare(`INSERT INTO entities(entity_id,build_id,kind,stable_key,name,address,size,namespace,signature,decompiler,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(build_id,stable_key) DO UPDATE SET
        kind=excluded.kind, name=COALESCE(excluded.name,entities.name), address=COALESCE(excluded.address,entities.address),
        size=COALESCE(excluded.size,entities.size), namespace=COALESCE(excluded.namespace,entities.namespace),
        signature=COALESCE(excluded.signature,entities.signature), decompiler=COALESCE(excluded.decompiler,entities.decompiler),
        metadata_json=excluded.metadata_json`).run(
        id, record.build_id, record.kind, record.stable_key, record.name ?? null, record.address ?? null,
        record.size ?? null, record.namespace ?? null, record.signature ?? null, record.decompiler ?? null, metadata,
      );
      return;
    }
    case "edge": {
      const source = resolveEntityId(db, record.build_id, record.source);
      const target = resolveEntityId(db, record.build_id, record.target);
      const id = record.edge_id ?? stableId("edge", record.build_id, record.kind, record.source, record.target, record.source_address, record.target_address);
      db.prepare(`INSERT OR REPLACE INTO edges(edge_id,build_id,kind,source_key,target_key,source_entity_id,target_entity_id,source_address,target_address,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id, record.build_id, record.kind, record.source, record.target, source, target, record.source_address ?? null, record.target_address ?? null, metadata);
      return;
    }
    case "evidence": {
      const id = record.evidence_id ?? stableId("evidence", record.build_id, record.source, record.source_ref, record.summary);
      db.prepare(`INSERT OR REPLACE INTO evidence(evidence_id,build_id,source,source_ref,observed_utc,confidence,classification,summary,payload_sha256,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        id, record.build_id ?? null, record.source, record.source_ref, record.observed_utc ?? nowUtc(), record.confidence,
        record.classification ?? "derived", record.summary, record.payload_sha256 ?? null, metadata,
      );
      for (const stableKey of record.entities ?? []) {
        const entityId = resolveEntityId(db, record.build_id, stableKey);
        if (entityId) db.prepare("INSERT OR REPLACE INTO entity_evidence(entity_id,evidence_id,relation) VALUES(?,?,?)").run(entityId, id, record.relation ?? "supports");
      }
      return;
    }
    case "claim": {
      const id = record.claim_id ?? stableId("claim", record.build_id, record.subject, record.predicate, json(record.object));
      const created = record.created_utc ?? nowUtc();
      db.prepare(`INSERT INTO claims(claim_id,build_id,subject,predicate,object_json,status,confidence,created_utc,updated_utc,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(claim_id) DO UPDATE SET status=excluded.status,confidence=excluded.confidence,
        updated_utc=excluded.updated_utc,metadata_json=excluded.metadata_json`).run(
        id, record.build_id ?? null, record.subject, record.predicate, json(record.object), record.status ?? "proposed",
        record.confidence, created, record.updated_utc ?? created, metadata,
      );
      for (const evidenceId of record.evidence_ids ?? []) {
        db.prepare("INSERT OR REPLACE INTO claim_evidence(claim_id,evidence_id,stance) VALUES(?,?,?)").run(id, evidenceId, record.stance ?? "supports");
      }
      return;
    }
    case "capture": {
      db.prepare(`INSERT OR REPLACE INTO captures(capture_id,build_id,scenario,started_utc,finished_utc,status,manifest_sha256,metadata_json)
        VALUES(?,?,?,?,?,?,?,?)`).run(record.capture_id, record.build_id ?? null, record.scenario, record.started_utc ?? null,
        record.finished_utc ?? null, record.status ?? "sealed", record.manifest_sha256 ?? null, metadata);
      return;
    }
    case "event": {
      const id = record.event_id ?? stableId("event", record.capture_id, record.ordinal, record.source, record.name);
      db.prepare(`INSERT OR REPLACE INTO events(event_id,capture_id,ordinal,ts_utc,source,kind,name,direction,address,thread_id,body_len,body_sha256,confidence,action_id,summary,fields_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, record.capture_id, record.ordinal, record.ts_utc ?? null,
        record.source, record.kind, record.name, record.direction ?? null, record.address ?? null, record.thread_id ?? null,
        record.body_len ?? null, record.body_sha256 ?? null, record.confidence, record.action_id ?? null,
        record.summary ?? null, json(record.fields));
      return;
    }
  }
}

export async function readJsonl(path) {
  const records = [];
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    try { records.push(validateRecord(JSON.parse(trimmed))); }
    catch (error) { throw new Error(`${path}:${lineNumber}: ${error.message}`); }
  }
  return records;
}

export async function ingestFile(dbPath, sourcePath) {
  const absolute = resolve(sourcePath);
  const bytes = readFileSync(absolute);
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const importId = newId("import");
  const records = await readJsonl(absolute);
  const db = openEvidenceDb(dbPath);
  db.prepare(`INSERT INTO import_runs(import_id,source_path,source_sha256,started_utc,status) VALUES(?,?,?,?,?)`).run(
    importId, absolute, sourceHash, nowUtc(), "running",
  );
  try {
    transaction(db, () => {
      for (const record of records) applyRecord(db, record);
      db.exec(`UPDATE edges SET source_entity_id=(SELECT entity_id FROM entities WHERE entities.build_id=edges.build_id AND entities.stable_key=edges.source_key)
        WHERE source_entity_id IS NULL;
        UPDATE edges SET target_entity_id=(SELECT entity_id FROM entities WHERE entities.build_id=edges.build_id AND entities.stable_key=edges.target_key)
        WHERE target_entity_id IS NULL;`);
    });
    db.prepare(`UPDATE import_runs SET finished_utc=?,status='complete',accepted_count=? WHERE import_id=?`).run(nowUtc(), records.length, importId);
    return { import_id: importId, source: absolute, sha256: sourceHash, accepted: records.length, format: FORMAT };
  } catch (error) {
    db.prepare(`UPDATE import_runs SET finished_utc=?,status='failed',rejected_count=?,error=? WHERE import_id=?`).run(nowUtc(), records.length, error.message, importId);
    throw error;
  } finally {
    db.close();
  }
}
