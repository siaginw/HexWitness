import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { FORMAT } from "./constants.mjs";
import { openEvidenceDb, transaction } from "./db.mjs";
import { validateRecord } from "./records.mjs";
import { json, newId, nowUtc, stableId } from "./util.mjs";

const INVESTIGATION_REFS = Object.freeze({ entity: ["entities", "entity_id"], evidence: ["evidence", "evidence_id"], claim: ["claims", "claim_id"], gap: ["gaps", "gap_id"], capture: ["captures", "capture_id"], attempt: ["failed_attempts", "attempt_id"] });

function investigationBuild(db, investigationId) {
  const row = db.prepare("SELECT build_id FROM investigations WHERE investigation_id=?").get(investigationId);
  if (!row) throw new Error(`unknown investigation: ${investigationId}`);
  return row.build_id;
}

function validateInvestigationRef(db, buildId, kind, refId) {
  if (!refId) return;
  const spec = INVESTIGATION_REFS[kind];
  if (!spec) throw new Error(`investigation item kind ${kind} cannot carry ref_id`);
  const row = db.prepare(`SELECT build_id FROM ${spec[0]} WHERE ${spec[1]}=?`).get(refId);
  if (!row) throw new Error(`unknown ${kind} reference: ${refId}`);
  if (row.build_id != null && row.build_id !== buildId) throw new Error(`${kind} reference belongs to a different build`);
}

function resolveEntityId(db, buildId, stableKey) {
  return db.prepare("SELECT entity_id FROM entities WHERE build_id=? AND stable_key=?").get(buildId, stableKey)?.entity_id ?? null;
}

export function applyRecord(db, record) {
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
    case "capture_artifact": {
      const id = record.artifact_id ?? stableId("capture-artifact", record.capture_id, record.path, record.sha256);
      db.prepare(`INSERT OR REPLACE INTO capture_artifacts(artifact_id,capture_id,role,path,sha256,size_bytes,media_type,event_count,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(id, record.capture_id, record.role, record.path, record.sha256, record.size_bytes,
        record.media_type ?? null, record.event_count ?? null, metadata);
      return;
    }
    case "marker": {
      const id = record.marker_id ?? stableId("marker", record.capture_id, record.ordinal, record.name);
      db.prepare(`INSERT OR REPLACE INTO markers(marker_id,capture_id,ordinal,ts_utc,name,note,metadata_json)
        VALUES(?,?,?,?,?,?,?)`).run(id, record.capture_id, record.ordinal, record.ts_utc ?? nowUtc(), record.name, record.note ?? null, metadata);
      return;
    }
    case "relationship": {
      const id = record.relationship_id ?? stableId("relationship", record.capture_id, record.source_ref, record.kind, record.target_ref);
      db.prepare(`INSERT OR REPLACE INTO relationships(relationship_id,capture_id,source_ref,kind,target_ref,confidence,evidence_json,metadata_json)
        VALUES(?,?,?,?,?,?,?,?)`).run(id, record.capture_id, record.source_ref, record.kind, record.target_ref, record.confidence,
        json(record.evidence), metadata);
      return;
    }
    case "slice": {
      const id = record.slice_id ?? stableId("slice", record.build_id, record.entity_key, record.kind, record.start_address, record.end_address);
      db.prepare(`INSERT OR REPLACE INTO analysis_slices(slice_id,build_id,entity_key,kind,start_address,end_address,text,operations_json,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(id, record.build_id, record.entity_key, record.kind, record.start_address ?? null,
        record.end_address ?? null, record.text ?? null, json(record.operations ?? []), metadata);
      return;
    }
    case "gap": {
      const id = record.gap_id ?? stableId("gap", record.build_id, record.capture_id, record.subject, record.objective);
      const created = record.created_utc ?? nowUtc();
      db.prepare(`INSERT INTO gaps(gap_id,build_id,capture_id,subject,objective,status,priority,missing_json,recommendation,created_utc,updated_utc,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gap_id) DO UPDATE SET status=excluded.status,priority=excluded.priority,
        missing_json=excluded.missing_json,recommendation=excluded.recommendation,updated_utc=excluded.updated_utc,metadata_json=excluded.metadata_json`).run(
        id, record.build_id ?? null, record.capture_id ?? null, record.subject, record.objective, record.status ?? "open", record.priority,
        json(record.missing ?? []), record.recommendation ?? null, created, record.updated_utc ?? created, metadata,
      );
      return;
    }
    case "investigation": {
      db.prepare(`INSERT INTO investigations(investigation_id,build_id,title,question,status,priority,playbook_id,operation_budget,created_utc,updated_utc,completed_utc,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(investigation_id) DO UPDATE SET title=excluded.title,question=excluded.question,status=excluded.status,
        priority=excluded.priority,playbook_id=excluded.playbook_id,operation_budget=excluded.operation_budget,updated_utc=excluded.updated_utc,
        completed_utc=excluded.completed_utc,metadata_json=excluded.metadata_json`).run(record.investigation_id, record.build_id, record.title,
        record.question ?? "", record.status ?? "planned", Math.max(0, Math.min(4, Number(record.priority ?? 2))), record.playbook_id ?? null,
        record.operation_budget == null ? null : Number(record.operation_budget), record.created_utc ?? nowUtc(), record.updated_utc ?? nowUtc(), record.completed_utc ?? null, metadata);
      return;
    }
    case "investigation_item": {
      const buildId = investigationBuild(db, record.investigation_id);
      validateInvestigationRef(db, buildId, record.kind, record.ref_id);
      const id = record.item_id ?? stableId("item", record.investigation_id, record.kind, record.ref_id, record.title);
      const ordinal = Number(record.ordinal ?? db.prepare("SELECT COALESCE(MAX(ordinal),0)+1 AS ordinal FROM investigation_items WHERE investigation_id=?").get(record.investigation_id).ordinal);
      db.prepare(`INSERT INTO investigation_items(item_id,investigation_id,kind,ref_id,title,status,ordinal,required,details_json,created_utc,updated_utc)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET ref_id=excluded.ref_id,title=excluded.title,status=excluded.status,
        ordinal=excluded.ordinal,required=excluded.required,details_json=excluded.details_json,updated_utc=excluded.updated_utc`).run(id, record.investigation_id,
        record.kind, record.ref_id ?? null, record.title, record.status ?? "pending", ordinal, record.required ? 1 : 0, json(record.details), record.created_utc ?? nowUtc(), record.updated_utc ?? nowUtc());
      return;
    }
    case "failed_attempt": {
      if (record.investigation_id && investigationBuild(db, record.investigation_id) !== record.build_id) throw new Error("failed attempt belongs to a different investigation build");
      for (const evidenceId of record.evidence_ids ?? []) validateInvestigationRef(db, record.build_id, "evidence", evidenceId);
      const id = record.attempt_id ?? stableId("attempt", record.build_id, record.investigation_id, record.subject, record.method, record.observed_utc);
      db.prepare(`INSERT INTO failed_attempts(attempt_id,investigation_id,build_id,subject,method,expected_result,actual_result,lesson,tool,tool_version,observed_utc,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(attempt_id) DO UPDATE SET expected_result=excluded.expected_result,actual_result=excluded.actual_result,
        lesson=excluded.lesson,tool=excluded.tool,tool_version=excluded.tool_version,metadata_json=excluded.metadata_json`).run(id, record.investigation_id ?? null,
        record.build_id, record.subject, record.method, record.expected, record.actual, record.lesson, record.tool ?? null, record.tool_version ?? null,
        record.observed_utc ?? nowUtc(), metadata);
      const link = db.prepare("INSERT OR REPLACE INTO failed_attempt_evidence(attempt_id,evidence_id) VALUES(?,?)");
      for (const evidenceId of record.evidence_ids ?? []) link.run(id, evidenceId);
      return;
    }
    case "investigation_usage": {
      const id = record.usage_id ?? stableId("usage", record.investigation_id, record.operation, record.ts_utc, record.note);
      db.prepare(`INSERT OR REPLACE INTO investigation_usage(usage_id,investigation_id,operation,units,source,note,ts_utc)
        VALUES(?,?,?,?,?,?,?)`).run(id, record.investigation_id, record.operation, Number(record.units ?? 1), record.source ?? "import", record.note ?? null, record.ts_utc ?? nowUtc());
      return;
    }
  }
}

export function ingestRecords(db, records) {
  transaction(db, () => {
    for (const input of records) applyRecord(db, validateRecord(input));
    db.exec(`UPDATE edges SET source_entity_id=(SELECT entity_id FROM entities WHERE entities.build_id=edges.build_id AND entities.stable_key=edges.source_key)
      WHERE source_entity_id IS NULL;
      UPDATE edges SET target_entity_id=(SELECT entity_id FROM entities WHERE entities.build_id=edges.build_id AND entities.stable_key=edges.target_key)
      WHERE target_entity_id IS NULL;`);
  });
  return records.length;
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
