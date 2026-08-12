import { canonicalAddress, publicRow } from "./util.mjs";

function rows(statement, ...params) {
  return statement.all(...params).map(publicRow);
}

function boundedLimit(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function requireUnambiguousBuild(db, column, value) {
  const matches = db.prepare(`SELECT DISTINCT build_id FROM entities WHERE ${column}=? ORDER BY build_id LIMIT 2`).all(value);
  if (matches.length > 1) throw new Error(`ambiguous ${column}; specify build_id`);
}

export function listBuilds(db) {
  return rows(db.prepare(`SELECT build_id,label,sha256,architecture,image_base,tool,tool_version,created_utc,metadata_json
    FROM builds ORDER BY created_utc DESC`));
}

export function search(db, { q, buildId = null, kind = null, limit = 50 }) {
  const term = `%${String(q ?? "").trim()}%`;
  return rows(db.prepare(`SELECT entity_id,build_id,kind,stable_key,name,address,size,namespace,signature,metadata_json
    FROM entities WHERE (? IS NULL OR build_id=?) AND (? IS NULL OR kind=?)
    AND (name LIKE ? OR stable_key LIKE ? OR signature LIKE ? OR address LIKE ?)
    ORDER BY CASE WHEN name=? THEN 0 WHEN name LIKE ? THEN 1 ELSE 2 END,name LIMIT ?`),
    buildId, buildId, kind, kind, term, term, term, term, q ?? "", `${q ?? ""}%`, boundedLimit(limit, 50, 250));
}

export function findEntity(db, { buildId = null, address = null, stableKey = null, entityId = null }) {
  if (entityId) return publicRow(db.prepare("SELECT * FROM entities WHERE entity_id=?").get(entityId));
  if (stableKey) {
    if (!buildId) requireUnambiguousBuild(db, "stable_key", stableKey);
    return publicRow(db.prepare("SELECT * FROM entities WHERE (? IS NULL OR build_id=?) AND stable_key=? ORDER BY build_id LIMIT 1").get(buildId, buildId, stableKey));
  }
  if (address != null) {
    const normalized = canonicalAddress(address);
    if (!buildId) requireUnambiguousBuild(db, "address", normalized);
    return publicRow(db.prepare("SELECT * FROM entities WHERE (? IS NULL OR build_id=?) AND address=? ORDER BY CASE kind WHEN 'function' THEN 0 ELSE 1 END LIMIT 1").get(buildId, buildId, normalized));
  }
  return null;
}

function edgeRows(db, entity, direction, limit = 100) {
  const incoming = direction === "incoming";
  const joinColumn = incoming ? "source_entity_id" : "target_entity_id";
  const filterColumn = incoming ? "target_entity_id" : "source_entity_id";
  return rows(db.prepare(`SELECT e.edge_id,e.kind,e.source_key,e.target_key,e.source_address,e.target_address,e.metadata_json,
      peer.entity_id AS peer_entity_id,peer.kind AS peer_kind,peer.stable_key AS peer_stable_key,
      peer.name AS peer_name,peer.address AS peer_address
    FROM edges e LEFT JOIN entities peer ON peer.entity_id=e.${joinColumn}
    WHERE e.${filterColumn}=? ORDER BY e.kind,peer.address LIMIT ?`), entity.entity_id, boundedLimit(limit, 100, 500));
}

export function explain(db, selector) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  const incoming = edgeRows(db, entity, "incoming");
  const outgoing = edgeRows(db, entity, "outgoing");
  const evidence = rows(db.prepare(`SELECT ev.*,ee.relation FROM entity_evidence ee JOIN evidence ev ON ev.evidence_id=ee.evidence_id
    WHERE ee.entity_id=? ORDER BY ev.confidence DESC,ev.observed_utc DESC LIMIT 100`), entity.entity_id);
  const claims = rows(db.prepare(`SELECT * FROM claims WHERE build_id=? AND (subject=? OR subject=? OR subject=?)
    ORDER BY confidence DESC,updated_utc DESC LIMIT 100`), entity.build_id, entity.entity_id, entity.stable_key, entity.address);
  const runtime = rows(db.prepare(`SELECT ev.*,c.scenario,c.build_id FROM events ev JOIN captures c ON c.capture_id=ev.capture_id
    WHERE c.build_id=? AND (? IS NOT NULL AND ev.address=?) ORDER BY ev.ts_utc DESC LIMIT 100`), entity.build_id, entity.address, entity.address);
  return {
    entity,
    callers: incoming.filter((edge) => edge.kind === "call"),
    callees: outgoing.filter((edge) => edge.kind === "call"),
    incoming,
    outgoing,
    evidence,
    claims,
    runtime,
    summary: {
      incoming_edges: incoming.length,
      outgoing_edges: outgoing.length,
      evidence_items: evidence.length,
      claims: claims.length,
      runtime_hits: runtime.length,
    },
  };
}

export function neighbors(db, selector, direction = "outgoing", kind = null, limit = 100) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  const edges = edgeRows(db, entity, direction, limit).filter((edge) => !kind || edge.kind === kind);
  return { entity, direction, kind, edges };
}

export function xrefs(db, selector, limit = 200) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  return {
    entity,
    incoming: edgeRows(db, entity, "incoming", limit),
    outgoing: edgeRows(db, entity, "outgoing", limit),
  };
}

export function evidenceFor(db, { buildId = null, source = null, classification = null, limit = 100 }) {
  return rows(db.prepare(`SELECT * FROM evidence WHERE (? IS NULL OR build_id=?) AND (? IS NULL OR source=?)
    AND (? IS NULL OR classification=?) ORDER BY observed_utc DESC LIMIT ?`),
    buildId, buildId, source, source, classification, classification, boundedLimit(limit, 100, 500));
}

export function contradictions(db, { buildId = null, limit = 100 }) {
  const groups = rows(db.prepare(`SELECT build_id,subject,predicate,COUNT(DISTINCT object_json) AS distinct_values,
    COUNT(*) AS claim_count FROM claims WHERE status!='retracted' AND (? IS NULL OR build_id=?)
    GROUP BY build_id,subject,predicate HAVING COUNT(DISTINCT object_json)>1 ORDER BY claim_count DESC LIMIT ?`),
    buildId, buildId, boundedLimit(limit, 100, 500));
  return groups.map((group) => ({
    ...group,
    claims: rows(db.prepare(`SELECT * FROM claims WHERE build_id IS ? AND subject=? AND predicate=? AND status!='retracted'
      ORDER BY confidence DESC,updated_utc DESC`), group.build_id, group.subject, group.predicate),
  }));
}

export function stats(db) {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  return {
    builds: count("builds"),
    entities: count("entities"),
    edges: count("edges"),
    evidence: count("evidence"),
    claims: count("claims"),
    captures: count("captures"),
    events: count("events"),
    imports: count("import_runs"),
  };
}

export function gapReport(db, selector, objective = "behavior") {
  const dossier = explain(db, selector);
  if (!dossier) return null;
  const missing = [];
  const entity = dossier.entity;
  if (!entity.signature && entity.kind === "function") missing.push({ layer: "static", need: "recovered signature/calling convention" });
  if (!entity.decompiler) missing.push({ layer: "semantic", need: "decompiler text or structured IL summary", optional: true });
  if (dossier.incoming.length === 0 && dossier.outgoing.length === 0) missing.push({ layer: "graph", need: "call and reference edges" });
  if (dossier.evidence.length === 0) missing.push({ layer: "provenance", need: "evidence record supporting identity or behavior" });
  if (["runtime", "protocol", "behavior"].includes(objective) && dossier.runtime.length === 0) {
    missing.push({ layer: "runtime", need: "controlled build-matched runtime observation with action marker" });
  }
  if (dossier.claims.length === 0) missing.push({ layer: "interpretation", need: "bounded claim linked to evidence", optional: true });
  return { entity, objective, missing, ready: missing.filter((item) => !item.optional).length === 0 };
}
