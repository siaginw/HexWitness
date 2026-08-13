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
  const plain = String(q ?? "").trim();
  const term = `%${plain}%`;
  if (plain.length >= 2) {
    try {
      const match = `"${plain.replaceAll('"', '""')}"*`;
      const found = rows(db.prepare(`SELECT e.* FROM entities_fts f JOIN entities e ON e.entity_id=f.entity_id
        WHERE entities_fts MATCH ? AND (? IS NULL OR e.build_id=?) AND (? IS NULL OR e.kind=?)
        ORDER BY bm25(entities_fts),e.name LIMIT ?`), match, buildId, buildId, kind, kind, boundedLimit(limit, 50, 250));
      if (found.length) return found;
    } catch {}
  }
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
    capture_artifacts: count("capture_artifacts"),
    markers: count("markers"),
    relationships: count("relationships"),
    analysis_slices: count("analysis_slices"),
    gaps: count("gaps"),
    investigations: count("investigations"),
    investigation_items: count("investigation_items"),
    failed_attempts: count("failed_attempts"),
    investigation_usage: count("investigation_usage"),
  };
}

export function memoryStatus(db) {
  const pageCount = Number(db.prepare("PRAGMA page_count").get()?.page_count ?? 0);
  const pageSize = Number(db.prepare("PRAGMA page_size").get()?.page_size ?? 0);
  return {
    mode: "durable-evidence-first",
    policy: {
      query_before_live_tool: true,
      idempotent_ingestion: true,
      live_result_requires_export_or_ingest: true,
      activity_retains_arguments_or_results: false,
    },
    durable: {
      ...stats(db),
      database_bytes: pageCount * pageSize,
      latest_import: publicRow(db.prepare("SELECT import_id,source_sha256,finished_utc,status,accepted_count,rejected_count FROM import_runs ORDER BY started_utc DESC LIMIT 1").get()),
      latest_capture: publicRow(db.prepare("SELECT capture_id,build_id,scenario,finished_utc,status FROM captures ORDER BY COALESCE(finished_utc,started_utc) DESC LIMIT 1").get()),
      latest_investigation: publicRow(db.prepare("SELECT investigation_id,build_id,title,status,updated_utc FROM investigations ORDER BY updated_utc DESC LIMIT 1").get()),
    },
    reuse_sequence: ["select exact build", "query HexWitness", "use retained evidence when sufficient", "call live viewer only for a gap", "export and ingest the new finding"],
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

export function reachable(db, selector, { direction = "outgoing", kind = null, depth = 3, limit = 500 } = {}) {
  const root = findEntity(db, selector);
  if (!root) return null;
  const maximumDepth = Math.max(1, Math.min(Number(depth) || 3, 12));
  const maximumNodes = boundedLimit(limit, 500, 5000);
  const queue = [{ entity: root, depth: 0 }];
  const seen = new Set([root.entity_id]);
  const nodes = [{ ...root, depth: 0 }];
  const traversed = [];
  while (queue.length && nodes.length < maximumNodes) {
    const current = queue.shift();
    if (current.depth >= maximumDepth) continue;
    for (const edge of edgeRows(db, current.entity, direction, maximumNodes)) {
      if (kind && edge.kind !== kind) continue;
      traversed.push({ ...edge, depth: current.depth + 1 });
      if (!edge.peer_entity_id || seen.has(edge.peer_entity_id)) continue;
      const peer = publicRow(db.prepare("SELECT * FROM entities WHERE entity_id=?").get(edge.peer_entity_id));
      if (!peer) continue;
      seen.add(peer.entity_id);
      nodes.push({ ...peer, depth: current.depth + 1 });
      queue.push({ entity: peer, depth: current.depth + 1 });
      if (nodes.length >= maximumNodes) break;
    }
  }
  return { root, direction, kind, depth: maximumDepth, nodes, edges: traversed, truncated: nodes.length >= maximumNodes };
}

export function analysisSlices(db, selector, { kind = null, limit = 100 } = {}) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  return {
    entity,
    slices: rows(db.prepare(`SELECT * FROM analysis_slices WHERE build_id=? AND entity_key=?
      AND (? IS NULL OR kind=?) ORDER BY start_address,kind LIMIT ?`), entity.build_id, entity.stable_key, kind, kind, boundedLimit(limit, 100, 500)),
  };
}

export function objectModel(db, { buildId, q = "", limit = 200 }) {
  const term = `%${String(q).trim()}%`;
  return rows(db.prepare(`SELECT * FROM entities WHERE build_id=? AND kind IN
    ('class','type','field','method','vtable','vtable_slot','enum')
    AND (name LIKE ? OR stable_key LIKE ? OR signature LIKE ?) ORDER BY kind,name LIMIT ?`),
  buildId, term, term, term, boundedLimit(limit, 200, 1000));
}

export function classDetail(db, { buildId = null, name = null, stableKey = null, entityId = null }) {
  let entity = null;
  if (entityId || stableKey) entity = findEntity(db, { buildId, stableKey, entityId });
  else if (name) {
    const matches = db.prepare(`SELECT * FROM entities WHERE (? IS NULL OR build_id=?) AND kind IN ('class','type')
      AND (name=? OR stable_key=?) ORDER BY CASE WHEN name=? THEN 0 ELSE 1 END,build_id LIMIT 2`).all(buildId, buildId, name, name, name).map(publicRow);
    if (!buildId && matches.length > 1 && matches[0].build_id !== matches[1].build_id) throw new Error("ambiguous class name; specify build_id");
    entity = matches[0] ?? null;
  }
  if (!entity) return null;
  const edges = [...edgeRows(db, entity, "outgoing", 2000), ...edgeRows(db, entity, "incoming", 2000)];
  const members = edges.filter((edge) => ["contains", "field", "method", "vtable_slot", "inherits", "implements", "type_of"].includes(edge.kind));
  return { entity, members, evidence: explain(db, { entityId: entity.entity_id })?.evidence ?? [] };
}

export function uuidLookup(db, { buildId = null, uuid, limit = 100 }) {
  const normalized = String(uuid ?? "").trim().replace(/[{}]/g, "").toLowerCase();
  if (!normalized) return [];
  const term = `%${normalized}%`;
  return rows(db.prepare(`SELECT * FROM entities WHERE (? IS NULL OR build_id=?) AND
    (LOWER(stable_key) LIKE ? OR LOWER(name) LIKE ? OR LOWER(metadata_json) LIKE ?)
    ORDER BY CASE WHEN LOWER(stable_key)=? THEN 0 WHEN LOWER(name)=? THEN 1 ELSE 2 END,kind,name LIMIT ?`),
  buildId, buildId, term, term, term, normalized, normalized, boundedLimit(limit, 100, 500));
}

export function typeRegistry(db, { buildId, q = "", kind = null, limit = 500 }) {
  const term = `%${String(q).trim()}%`;
  return rows(db.prepare(`SELECT * FROM entities WHERE build_id=? AND kind IN ('type','class','enum','vtable','vtable_slot')
    AND (? IS NULL OR kind=?) AND (name LIKE ? OR stable_key LIKE ? OR signature LIKE ? OR metadata_json LIKE ?)
    ORDER BY kind,name LIMIT ?`), buildId, kind, kind, term, term, term, term, boundedLimit(limit, 500, 2000));
}

export function functionInventory(db, { buildId, q = "", named = null, limit = 500 }) {
  const term = `%${String(q).trim()}%`;
  return rows(db.prepare(`SELECT entity_id,build_id,stable_key,name,address,size,namespace,signature,metadata_json FROM entities
    WHERE build_id=? AND kind IN ('function','method') AND (name LIKE ? OR stable_key LIKE ? OR signature LIKE ?)
    AND (? IS NULL OR (?=1 AND name IS NOT NULL) OR (?=0 AND name IS NULL)) ORDER BY address LIMIT ?`),
  buildId, term, term, term, named, named, named, boundedLimit(limit, 500, 5000));
}

export function vtableDetail(db, selector, limit = 500) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  const all = [...edgeRows(db, entity, "outgoing", limit), ...edgeRows(db, entity, "incoming", limit)];
  return { entity, slots: all.filter((edge) => edge.kind === "vtable_slot" || edge.peer_kind === "vtable_slot"), edges: all };
}

export function dataflow(db, selector, { direction = "both", depth = 2, limit = 500 } = {}) {
  const entity = findEntity(db, selector);
  if (!entity) return null;
  const kinds = new Set(["reads", "writes", "loads", "stores", "defines", "uses", "flows_to", "parameter", "returns", "aliases"]);
  const collect = (dir) => reachable(db, selector, { direction: dir, depth, limit })?.edges.filter((edge) => kinds.has(edge.kind)) ?? [];
  return { entity, direction, incoming: direction === "outgoing" ? [] : collect("incoming"), outgoing: direction === "incoming" ? [] : collect("outgoing") };
}

export function genericQuery(db, { buildId = null, kinds = [], edgeKinds = [], q = "", hasEvidence = null, hasRuntime = null, limit = 200 } = {}) {
  const allowedKinds = Array.isArray(kinds) ? kinds.filter(Boolean) : String(kinds).split(",").filter(Boolean);
  const allowedEdges = Array.isArray(edgeKinds) ? edgeKinds.filter(Boolean) : String(edgeKinds).split(",").filter(Boolean);
  const term = `%${String(q).trim()}%`;
  const kindCsv = allowedKinds.join(",");
  const candidates = rows(db.prepare(`SELECT e.*,
    EXISTS(SELECT 1 FROM entity_evidence ee WHERE ee.entity_id=e.entity_id) AS has_evidence,
    EXISTS(SELECT 1 FROM events ev JOIN captures c ON c.capture_id=ev.capture_id WHERE c.build_id=e.build_id AND ev.address=e.address) AS has_runtime
    FROM entities e WHERE (? IS NULL OR e.build_id=?) AND (e.name LIKE ? OR e.stable_key LIKE ? OR e.signature LIKE ? OR e.metadata_json LIKE ?)
    AND (?='' OR INSTR(','||?||',',','||e.kind||',')>0)
    AND (? IS NULL OR EXISTS(SELECT 1 FROM entity_evidence ee WHERE ee.entity_id=e.entity_id)=?)
    AND (? IS NULL OR EXISTS(SELECT 1 FROM events ev JOIN captures c ON c.capture_id=ev.capture_id WHERE c.build_id=e.build_id AND ev.address=e.address)=?)
    ORDER BY e.kind,e.name,e.address LIMIT ?`), buildId, buildId, term, term, term, term, kindCsv, kindCsv,
  hasEvidence == null ? null : Number(Boolean(hasEvidence)), hasEvidence == null ? null : Number(Boolean(hasEvidence)),
  hasRuntime == null ? null : Number(Boolean(hasRuntime)), hasRuntime == null ? null : Number(Boolean(hasRuntime)),
  boundedLimit(limit, 200, 5000));
  return candidates
    .map((item) => {
      if (!allowedEdges.length) return item;
      const edges = db.prepare(`SELECT * FROM edges WHERE build_id=? AND (source_entity_id=? OR target_entity_id=?)`).all(item.build_id, item.entity_id, item.entity_id).map(publicRow);
      return { ...item, edges: edges.filter((edge) => allowedEdges.includes(edge.kind)) };
    }).filter((item) => !allowedEdges.length || item.edges.length);
}

export function metadataLookup(db, { buildId = null, q, kinds = [], limit = 200 }) {
  const allowedKinds = Array.isArray(kinds) ? kinds.filter(Boolean) : String(kinds ?? "").split(",").filter(Boolean);
  const kindCsv = allowedKinds.join(",");
  const term = `%${String(q ?? "").trim()}%`;
  return rows(db.prepare(`SELECT * FROM entities WHERE (? IS NULL OR build_id=?)
    AND (?='' OR INSTR(','||?||',',','||kind||',')>0)
    AND (metadata_json LIKE ? OR stable_key LIKE ? OR name LIKE ?) ORDER BY kind,name LIMIT ?`),
  buildId, buildId, kindCsv, kindCsv, term, term, term, boundedLimit(limit, 200, 2000));
}

export function fieldOffsets(db, { buildId, owner = "", q = "", limit = 500 }) {
  const ownerTerm = `%${String(owner).trim()}%`; const term = `%${String(q).trim()}%`;
  return rows(db.prepare(`SELECT f.* FROM entities f WHERE f.build_id=? AND f.kind='field'
    AND (f.name LIKE ? OR f.stable_key LIKE ? OR f.signature LIKE ?)
    AND (f.metadata_json LIKE ? OR EXISTS(SELECT 1 FROM edges e JOIN entities o ON o.entity_id=e.source_entity_id
      WHERE e.target_entity_id=f.entity_id AND e.kind='field' AND (o.name LIKE ? OR o.stable_key LIKE ?)))
    ORDER BY json_extract(f.metadata_json,'$.offset'),f.name LIMIT ?`), buildId, term, term, term, ownerTerm, ownerTerm, ownerTerm, boundedLimit(limit, 500, 2000));
}

export function decompSearch(db, { buildId, q, kind = null, limit = 200 }) {
  const term = `%${String(q ?? "").trim()}%`;
  const entities = rows(db.prepare(`SELECT entity_id,build_id,kind,stable_key,name,address,signature,decompiler,metadata_json
    FROM entities WHERE build_id=? AND decompiler LIKE ? ORDER BY address LIMIT ?`), buildId, term, boundedLimit(limit, 200, 1000));
  const slices = rows(db.prepare(`SELECT * FROM analysis_slices WHERE build_id=? AND (? IS NULL OR kind=?)
    AND (text LIKE ? OR operations_json LIKE ?) ORDER BY entity_key,start_address LIMIT ?`), buildId, kind, kind, term, term, boundedLimit(limit, 200, 1000));
  return { build_id: buildId, query: q, entities, slices };
}

export function edgeKinds(db, { buildId = null }) {
  return rows(db.prepare(`SELECT kind,COUNT(*) AS count,COUNT(DISTINCT source_entity_id) AS sources,
    COUNT(DISTINCT target_entity_id) AS targets FROM edges WHERE (? IS NULL OR build_id=?) GROUP BY kind ORDER BY count DESC,kind`), buildId, buildId);
}

export function shortestPath(db, fromSelector, toSelector, { kind = null, direction = "outgoing", depth = 8 } = {}) {
  const from = findEntity(db, fromSelector); const to = findEntity(db, toSelector);
  if (!from || !to) return null;
  if (from.build_id !== to.build_id) throw new Error("path endpoints must belong to the same build");
  const maximumDepth = Math.max(1, Math.min(Number(depth) || 8, 20));
  const queue = [{ entity: from, path: [] }]; const seen = new Set([from.entity_id]);
  while (queue.length) {
    const current = queue.shift();
    if (current.path.length >= maximumDepth) continue;
    for (const edge of edgeRows(db, current.entity, direction, 5000)) {
      if (kind && edge.kind !== kind) continue;
      const nextPath = [...current.path, edge];
      if (edge.peer_entity_id === to.entity_id) return { from, to, direction, kind, path: nextPath, depth: nextPath.length };
      if (!edge.peer_entity_id || seen.has(edge.peer_entity_id)) continue;
      const peer = publicRow(db.prepare("SELECT * FROM entities WHERE entity_id=?").get(edge.peer_entity_id));
      if (!peer) continue;
      seen.add(peer.entity_id); queue.push({ entity: peer, path: nextPath });
    }
  }
  return { from, to, direction, kind, path: null, depth: null };
}

export function compareBuilds(db, leftId, rightId, { limit = 1000 } = {}) {
  const leftBuild = publicRow(db.prepare("SELECT * FROM builds WHERE build_id=?").get(leftId));
  const rightBuild = publicRow(db.prepare("SELECT * FROM builds WHERE build_id=?").get(rightId));
  if (!leftBuild || !rightBuild) return null;
  const maximum = boundedLimit(limit, 1000, 10000);
  const leftRows = db.prepare("SELECT * FROM entities WHERE build_id=? ORDER BY stable_key LIMIT ?").all(leftId, maximum).map(publicRow);
  const rightRows = db.prepare("SELECT * FROM entities WHERE build_id=? ORDER BY stable_key LIMIT ?").all(rightId, maximum).map(publicRow);
  const left = new Map(leftRows.map((item) => [item.stable_key, item])); const right = new Map(rightRows.map((item) => [item.stable_key, item]));
  const rightByName = new Map();
  for (const item of rightRows) {
    if (!item.name) continue;
    const key = `${item.kind}|${item.namespace ?? ""}|${item.name}`;
    const values = rightByName.get(key) ?? []; values.push(item); rightByName.set(key, values);
  }
  const consumedRight = new Set(); const added = []; const removed = []; const changed = [];
  for (const [key, value] of left) {
    let other = right.get(key); let matchedBy = "stable_key";
    if (!other && value.name) {
      const alternatives = rightByName.get(`${value.kind}|${value.namespace ?? ""}|${value.name}`) ?? [];
      if (alternatives.length === 1) { other = alternatives[0]; matchedBy = "kind_namespace_name"; }
    }
    if (!other) { removed.push(value); continue; }
    consumedRight.add(other.stable_key);
    const changes = {};
    for (const field of ["stable_key", "kind", "name", "address", "size", "namespace", "signature"]) if (value[field] !== other[field]) changes[field] = { left: value[field], right: other[field] };
    if (Object.keys(changes).length) changed.push({ stable_key: key, right_stable_key: other.stable_key, matched_by: matchedBy, changes });
  }
  for (const [key, value] of right) if (!consumedRight.has(key)) added.push(value);
  return { left: leftBuild, right: rightBuild, added, removed, changed, truncated: leftRows.length >= maximum || rightRows.length >= maximum };
}

export function listCaptures(db, { buildId = null, scenario = null, status = null, limit = 100 } = {}) {
  return rows(db.prepare(`SELECT c.*,
    (SELECT COUNT(*) FROM events e WHERE e.capture_id=c.capture_id) AS event_count,
    (SELECT COUNT(*) FROM capture_artifacts a WHERE a.capture_id=c.capture_id) AS artifact_count,
    (SELECT COUNT(*) FROM markers m WHERE m.capture_id=c.capture_id) AS marker_count
    FROM captures c WHERE (? IS NULL OR c.build_id=?) AND (? IS NULL OR c.scenario LIKE '%'||?||'%')
    AND (? IS NULL OR c.status=?) ORDER BY COALESCE(c.finished_utc,c.started_utc) DESC LIMIT ?`),
  buildId, buildId, scenario, scenario, status, status, boundedLimit(limit, 100, 500));
}

export function captureDetail(db, captureId) {
  const capture = publicRow(db.prepare("SELECT * FROM captures WHERE capture_id=?").get(captureId));
  if (!capture) return null;
  return {
    capture,
    artifacts: rows(db.prepare("SELECT * FROM capture_artifacts WHERE capture_id=? ORDER BY role,path"), captureId),
    markers: rows(db.prepare("SELECT * FROM markers WHERE capture_id=? ORDER BY ordinal"), captureId),
    relationships: rows(db.prepare("SELECT * FROM relationships WHERE capture_id=? ORDER BY kind,source_ref,target_ref"), captureId),
    counts: rows(db.prepare("SELECT direction,kind,name,COUNT(*) AS count FROM events WHERE capture_id=? GROUP BY direction,kind,name ORDER BY count DESC,name"), captureId),
  };
}

export function captureTimeline(db, captureId, { after = 0, limit = 500, source = null, kind = null, name = null } = {}) {
  const capture = db.prepare("SELECT capture_id FROM captures WHERE capture_id=?").get(captureId);
  if (!capture) return null;
  return rows(db.prepare(`SELECT * FROM events WHERE capture_id=? AND ordinal>? AND (? IS NULL OR source=?)
    AND (? IS NULL OR kind=?) AND (? IS NULL OR name LIKE '%'||?||'%') ORDER BY ordinal LIMIT ?`),
  captureId, Number(after) || 0, source, source, kind, kind, name, name, boundedLimit(limit, 500, 5000));
}

export function captureSearch(db, { captureId = null, q = "", direction = null, kind = null, limit = 200 } = {}) {
  const plain = String(q).trim(); const term = `%${plain}%`;
  if (plain.length >= 2) {
    try {
      const match = `"${plain.replaceAll('"', '""')}"*`;
      const found = rows(db.prepare(`SELECT e.*,c.scenario,c.build_id FROM events_fts f JOIN events e ON e.event_id=f.event_id
        JOIN captures c ON c.capture_id=e.capture_id WHERE events_fts MATCH ? AND (? IS NULL OR e.capture_id=?)
        AND (? IS NULL OR e.direction=?) AND (? IS NULL OR e.kind=?) ORDER BY bm25(events_fts),e.ts_utc LIMIT ?`),
      match, captureId, captureId, direction, direction, kind, kind, boundedLimit(limit, 200, 2000));
      if (found.length) return found;
    } catch {}
  }
  return rows(db.prepare(`SELECT e.*,c.scenario,c.build_id FROM events e JOIN captures c ON c.capture_id=e.capture_id
    WHERE (? IS NULL OR e.capture_id=?) AND (? IS NULL OR e.direction=?) AND (? IS NULL OR e.kind=?)
    AND (e.name LIKE ? OR e.summary LIKE ? OR e.fields_json LIKE ?) ORDER BY e.ts_utc,e.capture_id,e.ordinal LIMIT ?`),
  captureId, captureId, direction, direction, kind, kind, term, term, term, boundedLimit(limit, 200, 2000));
}

export function captureGraph(db, captureId, { kind = null, limit = 1000 } = {}) {
  const detail = captureDetail(db, captureId);
  if (!detail) return null;
  const relationships = rows(db.prepare(`SELECT * FROM relationships WHERE capture_id=? AND (? IS NULL OR kind=?)
    ORDER BY kind,source_ref,target_ref LIMIT ?`), captureId, kind, kind, boundedLimit(limit, 1000, 5000));
  const nodeRefs = new Set();
  for (const item of relationships) { nodeRefs.add(item.source_ref); nodeRefs.add(item.target_ref); }
  return { capture: detail.capture, nodes: [...nodeRefs].sort().map((id) => ({ id })), relationships };
}

function eventSignature(event) {
  return `${event.direction ?? ""}|${event.source}|${event.kind}|${event.name}|${event.action_id ?? ""}`;
}

export function compareCaptures(db, leftId, rightId) {
  const left = captureTimeline(db, leftId, { limit: 5000 });
  const right = captureTimeline(db, rightId, { limit: 5000 });
  if (!left || !right) return null;
  const aggregate = (items) => {
    const counts = new Map();
    for (const item of items) counts.set(eventSignature(item), (counts.get(eventSignature(item)) ?? 0) + 1);
    return counts;
  };
  const a = aggregate(left); const b = aggregate(right);
  const signatures = [...new Set([...a.keys(), ...b.keys()])].sort();
  let firstDivergence = null;
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    if (eventSignature(left[index] ?? {}) !== eventSignature(right[index] ?? {})) {
      firstDivergence = { index, left: left[index] ?? null, right: right[index] ?? null }; break;
    }
  }
  return {
    left: { capture_id: leftId, events: left.length }, right: { capture_id: rightId, events: right.length },
    first_divergence: firstDivergence,
    deltas: signatures.map((signature) => ({ signature, left: a.get(signature) ?? 0, right: b.get(signature) ?? 0, delta: (b.get(signature) ?? 0) - (a.get(signature) ?? 0) })).filter((item) => item.delta !== 0),
  };
}

export function gapWorklist(db, { buildId = null, captureId = null, status = "open", limit = 100 } = {}) {
  return rows(db.prepare(`SELECT * FROM gaps WHERE (? IS NULL OR build_id=?) AND (? IS NULL OR capture_id=?)
    AND (? IS NULL OR status=?) ORDER BY priority ASC,updated_utc DESC LIMIT ?`), buildId, buildId, captureId, captureId,
  status, status, boundedLimit(limit, 100, 500));
}

export function coverage(db, { buildId = null } = {}) {
  const byKind = rows(db.prepare(`SELECT kind,COUNT(*) AS entities,
    SUM(CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END) AS named,
    SUM(CASE WHEN signature IS NOT NULL THEN 1 ELSE 0 END) AS signed,
    SUM(CASE WHEN decompiler IS NOT NULL THEN 1 ELSE 0 END) AS decompiled
    FROM entities WHERE (? IS NULL OR build_id=?) GROUP BY kind ORDER BY entities DESC`), buildId, buildId);
  const evidence = rows(db.prepare(`SELECT classification,COUNT(*) AS count FROM evidence WHERE (? IS NULL OR build_id=?) GROUP BY classification ORDER BY count DESC`), buildId, buildId);
  const captures = rows(db.prepare(`SELECT status,COUNT(*) AS count,SUM((SELECT COUNT(*) FROM events e WHERE e.capture_id=c.capture_id)) AS events
    FROM captures c WHERE (? IS NULL OR build_id=?) GROUP BY status`), buildId, buildId);
  return { build_id: buildId, entities: byKind, evidence, captures };
}
