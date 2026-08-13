import { getPlaybook } from "./playbooks.mjs";
import { json, newId, nowUtc, parseJson, publicRow } from "./util.mjs";

const STATUSES = new Set(["planned", "active", "blocked", "complete", "abandoned"]);
const ITEM_KINDS = new Set(["objective", "check", "decision", "note", "entity", "evidence", "claim", "gap", "capture", "attempt"]);
const ITEM_STATUSES = new Set(["pending", "in_progress", "done", "blocked", "skipped"]);
const REF_TABLES = Object.freeze({ entity: ["entities", "entity_id"], evidence: ["evidence", "evidence_id"], claim: ["claims", "claim_id"], gap: ["gaps", "gap_id"], capture: ["captures", "capture_id"], attempt: ["failed_attempts", "attempt_id"] });

function requireText(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function requireBuild(db, buildId) {
  const id = requireText(buildId, "build_id");
  if (!db.prepare("SELECT 1 FROM builds WHERE build_id=?").get(id)) throw new Error(`unknown build: ${id}`);
  return id;
}

function requireInvestigation(db, investigationId) {
  const row = db.prepare("SELECT * FROM investigations WHERE investigation_id=?").get(requireText(investigationId, "investigation_id"));
  if (!row) throw new Error(`unknown investigation: ${investigationId}`);
  return publicRow(row);
}

function validateReference(db, buildId, kind, refId) {
  if (!refId) return;
  const spec = REF_TABLES[kind];
  if (!spec) throw new Error(`item kind ${kind} cannot carry ref_id`);
  const [table, column] = spec;
  const row = db.prepare(`SELECT build_id FROM ${table} WHERE ${column}=?`).get(refId);
  if (!row) throw new Error(`unknown ${kind} reference: ${refId}`);
  if (row.build_id != null && row.build_id !== buildId) throw new Error(`${kind} reference belongs to a different build`);
}

export function createInvestigation(db, { buildId, title, question = "", playbookId = null, priority = 2, operationBudget = null, metadata = {} }) {
  const build = requireBuild(db, buildId);
  const timestamp = nowUtc();
  const id = newId("investigation");
  const budget = operationBudget == null ? null : Number(operationBudget);
  if (budget != null && (!Number.isInteger(budget) || budget < 1)) throw new Error("operation_budget must be a positive integer");
  const playbook = playbookId ? getPlaybook(playbookId) : null;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO investigations(investigation_id,build_id,title,question,status,priority,playbook_id,operation_budget,created_utc,updated_utc,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id, build, requireText(title, "title"), String(question ?? ""), "planned", Math.max(0, Math.min(4, Number(priority) || 2)), playbook?.id ?? null, budget, timestamp, timestamp, json(metadata));
    if (playbook) {
      const insert = db.prepare(`INSERT INTO investigation_items(item_id,investigation_id,kind,title,status,ordinal,required,details_json,created_utc,updated_utc)
        VALUES(?,?,?,?,?,?,?,?,?,?)`);
      playbook.phases.forEach((phase, index) => insert.run(newId("item"), id, "check", phase.title, "pending", index + 1, phase.required ? 1 : 0, json({ phase_id: phase.id, evidence_classes: phase.evidence_classes }), timestamp, timestamp));
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return investigationDetail(db, id);
}

export function addInvestigationItem(db, investigationId, { kind, title, refId = null, required = false, status = "pending", details = {} }) {
  const investigation = requireInvestigation(db, investigationId);
  const normalizedKind = requireText(kind, "kind");
  if (!ITEM_KINDS.has(normalizedKind)) throw new Error(`unsupported investigation item kind: ${normalizedKind}`);
  if (!ITEM_STATUSES.has(status)) throw new Error(`unsupported investigation item status: ${status}`);
  validateReference(db, investigation.build_id, normalizedKind, refId);
  const ordinal = Number(db.prepare("SELECT COALESCE(MAX(ordinal),0)+1 AS ordinal FROM investigation_items WHERE investigation_id=?").get(investigationId).ordinal);
  const timestamp = nowUtc();
  const id = newId("item");
  db.prepare(`INSERT INTO investigation_items(item_id,investigation_id,kind,ref_id,title,status,ordinal,required,details_json,created_utc,updated_utc)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id, investigationId, normalizedKind, refId, requireText(title, "title"), status, ordinal, required ? 1 : 0, json(details), timestamp, timestamp);
  db.prepare("UPDATE investigations SET updated_utc=? WHERE investigation_id=?").run(timestamp, investigationId);
  return publicRow(db.prepare("SELECT * FROM investigation_items WHERE item_id=?").get(id));
}

export function updateInvestigationItem(db, investigationId, itemId, { status }) {
  requireInvestigation(db, investigationId);
  if (!ITEM_STATUSES.has(status)) throw new Error(`unsupported investigation item status: ${status}`);
  const timestamp = nowUtc();
  const result = db.prepare("UPDATE investigation_items SET status=?,updated_utc=? WHERE investigation_id=? AND item_id=?").run(status, timestamp, investigationId, itemId);
  if (!result.changes) throw new Error(`unknown investigation item: ${itemId}`);
  db.prepare("UPDATE investigations SET updated_utc=? WHERE investigation_id=?").run(timestamp, investigationId);
  return publicRow(db.prepare("SELECT * FROM investigation_items WHERE item_id=?").get(itemId));
}

export function recordFailedAttempt(db, { investigationId = null, buildId = null, subject, method, expected, actual, lesson, tool = null, toolVersion = null, evidenceIds = [], metadata = {} }) {
  const investigation = investigationId ? requireInvestigation(db, investigationId) : null;
  const build = requireBuild(db, investigation?.build_id ?? buildId);
  const ids = [...new Set(evidenceIds.filter(Boolean))];
  for (const evidenceId of ids) validateReference(db, build, "evidence", evidenceId);
  const id = newId("attempt"); const timestamp = nowUtc();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`INSERT INTO failed_attempts(attempt_id,investigation_id,build_id,subject,method,expected_result,actual_result,lesson,tool,tool_version,observed_utc,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, investigationId, build, requireText(subject, "subject"), requireText(method, "method"), requireText(expected, "expected"), requireText(actual, "actual"), requireText(lesson, "lesson"), tool, toolVersion, timestamp, json(metadata));
    const link = db.prepare("INSERT INTO failed_attempt_evidence(attempt_id,evidence_id) VALUES(?,?)");
    for (const evidenceId of ids) link.run(id, evidenceId);
    if (investigationId) {
      const ordinal = Number(db.prepare("SELECT COALESCE(MAX(ordinal),0)+1 AS ordinal FROM investigation_items WHERE investigation_id=?").get(investigationId).ordinal);
      db.prepare(`INSERT INTO investigation_items(item_id,investigation_id,kind,ref_id,title,status,ordinal,required,details_json,created_utc,updated_utc)
        VALUES(?,?,?,?,?,'done',?,0,'{}',?,?)`).run(newId("item"), investigationId, "attempt", id, `Failed attempt: ${method}`, ordinal, timestamp, timestamp);
      db.prepare("UPDATE investigations SET updated_utc=? WHERE investigation_id=?").run(timestamp, investigationId);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return failedAttemptDetail(db, id);
}

export function failedAttemptDetail(db, attemptId) {
  const attempt = publicRow(db.prepare("SELECT * FROM failed_attempts WHERE attempt_id=?").get(attemptId));
  if (!attempt) return null;
  return { ...attempt, evidence: db.prepare(`SELECT e.* FROM failed_attempt_evidence ae JOIN evidence e ON e.evidence_id=ae.evidence_id WHERE ae.attempt_id=? ORDER BY e.observed_utc`).all(attemptId).map(publicRow) };
}

export function listFailedAttempts(db, { investigationId = null, buildId = null, subject = null, limit = 100 } = {}) {
  return db.prepare(`SELECT a.*,COUNT(ae.evidence_id) AS evidence_count FROM failed_attempts a LEFT JOIN failed_attempt_evidence ae ON ae.attempt_id=a.attempt_id
    WHERE (? IS NULL OR a.investigation_id=?) AND (? IS NULL OR a.build_id=?) AND (? IS NULL OR a.subject LIKE '%'||?||'%')
    GROUP BY a.attempt_id ORDER BY a.observed_utc DESC LIMIT ?`).all(investigationId, investigationId, buildId, buildId, subject, subject, Math.max(1, Math.min(Number(limit) || 100, 500))).map(publicRow);
}

export function recordInvestigationUsage(db, investigationId, { operation, units = 1, note = null, source = "manual" }) {
  const investigation = requireInvestigation(db, investigationId);
  const amount = Number(units);
  if (!Number.isInteger(amount) || amount < 1) throw new Error("usage units must be a positive integer");
  const used = Number(db.prepare("SELECT COALESCE(SUM(units),0) AS used FROM investigation_usage WHERE investigation_id=?").get(investigationId).used);
  if (investigation.operation_budget != null && used + amount > investigation.operation_budget) throw new Error(`operation budget exceeded: ${used}/${investigation.operation_budget} used, ${amount} requested`);
  const timestamp = nowUtc(); const id = newId("usage");
  db.prepare("INSERT INTO investigation_usage(usage_id,investigation_id,operation,units,source,note,ts_utc) VALUES(?,?,?,?,?,?,?)").run(id, investigationId, requireText(operation, "operation"), amount, source, note, timestamp);
  db.prepare("UPDATE investigations SET updated_utc=? WHERE investigation_id=?").run(timestamp, investigationId);
  return investigationProgress(db, investigationId);
}

export function investigationProgress(db, investigationId, { staleDays = 7 } = {}) {
  const investigation = requireInvestigation(db, investigationId);
  const items = db.prepare("SELECT kind,status,required,ref_id FROM investigation_items WHERE investigation_id=?").all(investigationId);
  const required = items.filter((item) => item.required === 1);
  const completed = required.filter((item) => item.status === "done");
  const linkedGapIds = items.filter((item) => item.kind === "gap" && item.ref_id).map((item) => item.ref_id);
  let openGaps = 0;
  if (linkedGapIds.length) openGaps = Number(db.prepare(`SELECT COUNT(*) AS count FROM gaps WHERE status='open' AND gap_id IN (${linkedGapIds.map(() => "?").join(",")})`).get(...linkedGapIds).count);
  const used = Number(db.prepare("SELECT COALESCE(SUM(units),0) AS used FROM investigation_usage WHERE investigation_id=?").get(investigationId).used);
  const limit = investigation.operation_budget == null ? null : Number(investigation.operation_budget);
  const staleAfter = Math.max(1, Number(staleDays) || 7) * 86400000;
  const stalled = !["complete", "abandoned"].includes(investigation.status) && Date.now() - Date.parse(investigation.updated_utc) > staleAfter;
  const blockers = [];
  if (required.length === 0) blockers.push("no required completion checks defined");
  if (completed.length < required.length) blockers.push(`${required.length - completed.length} required checks incomplete`);
  const proofLinks = items.filter((item) => ["evidence", "claim", "capture"].includes(item.kind) && item.ref_id).length;
  if (proofLinks === 0) blockers.push("no evidence, claim, or capture linked");
  if (openGaps) blockers.push(`${openGaps} linked evidence gaps open`);
  const warnings = [];
  if (limit != null && used >= limit) warnings.push("operation budget exhausted");
  if (stalled) warnings.push("investigation is stale");
  return {
    investigation_id: investigationId, status: investigation.status,
    checks: { required: required.length, complete: completed.length, percent: required.length ? Math.round(completed.length / required.length * 100) : 0 },
    links: Object.fromEntries([...ITEM_KINDS].map((kind) => [kind, items.filter((item) => item.kind === kind).length])),
    open_linked_gaps: openGaps,
    budget: { metric: "agent_operation_units", limit, used, remaining: limit == null ? null : Math.max(0, limit - used), exhausted: limit != null && used >= limit },
    stalled, stale_days: Number(staleDays) || 7, ready_to_complete: blockers.length === 0, blockers, warnings,
  };
}

export function setInvestigationStatus(db, investigationId, status) {
  requireInvestigation(db, investigationId);
  if (!STATUSES.has(status)) throw new Error(`unsupported investigation status: ${status}`);
  if (status === "complete") {
    const progress = investigationProgress(db, investigationId);
    if (progress.blockers.length) throw new Error(`investigation completion blocked: ${progress.blockers.join("; ")}`);
  }
  const timestamp = nowUtc();
  db.prepare("UPDATE investigations SET status=?,updated_utc=?,completed_utc=? WHERE investigation_id=?").run(status, timestamp, status === "complete" ? timestamp : null, investigationId);
  return investigationDetail(db, investigationId);
}

export function listInvestigations(db, { buildId = null, status = null, playbookId = null, staleDays = 7, limit = 100 } = {}) {
  const rows = db.prepare(`SELECT * FROM investigations WHERE (? IS NULL OR build_id=?) AND (? IS NULL OR status=?) AND (? IS NULL OR playbook_id=?)
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,priority,updated_utc DESC LIMIT ?`).all(buildId, buildId, status, status, playbookId, playbookId, Math.max(1, Math.min(Number(limit) || 100, 500))).map(publicRow);
  return rows.map((row) => ({ ...row, progress: investigationProgress(db, row.investigation_id, { staleDays }) }));
}

export function investigationDetail(db, investigationId) {
  const investigation = requireInvestigation(db, investigationId);
  const items = db.prepare("SELECT * FROM investigation_items WHERE investigation_id=? ORDER BY ordinal,item_id").all(investigationId).map(publicRow);
  const attempts = listFailedAttempts(db, { investigationId, limit: 500 });
  const usage = db.prepare("SELECT * FROM investigation_usage WHERE investigation_id=? ORDER BY ts_utc,usage_id").all(investigationId).map(publicRow);
  return { investigation, items, attempts, usage, progress: investigationProgress(db, investigationId) };
}

export function investigationReport(db, { buildId = null, staleDays = 7 } = {}) {
  const investigations = listInvestigations(db, { buildId, staleDays, limit: 500 });
  const count = (status) => investigations.filter((item) => item.investigation.status === status).length;
  return {
    build_id: buildId, generated_utc: nowUtc(),
    summary: { total: investigations.length, planned: count("planned"), active: count("active"), blocked: count("blocked"), complete: count("complete"), abandoned: count("abandoned"), stalled: investigations.filter((item) => item.progress.stalled).length, ready_to_complete: investigations.filter((item) => item.progress.ready_to_complete).length },
    investigations,
  };
}

export function challengeEvidence(db, { investigationId = null, buildId = null, subject = null }) {
  if (!investigationId && !subject) throw new Error("evidence challenge requires investigation_id or subject");
  const investigation = investigationId ? requireInvestigation(db, investigationId) : null;
  const build = requireBuild(db, investigation?.build_id ?? buildId);
  const items = investigationId ? db.prepare("SELECT * FROM investigation_items WHERE investigation_id=?").all(investigationId) : [];
  const subjects = new Set();
  if (subject) subjects.add(String(subject));
  for (const item of items.filter((entry) => entry.kind === "entity" && entry.ref_id)) {
    const entity = db.prepare("SELECT entity_id,stable_key,address FROM entities WHERE entity_id=?").get(item.ref_id);
    if (entity) for (const value of [entity.entity_id, entity.stable_key, entity.address]) if (value) subjects.add(value);
  }
  const linkedClaimIds = items.filter((item) => item.kind === "claim" && item.ref_id).map((item) => item.ref_id);
  let claims = [];
  if (subjects.size) claims.push(...db.prepare(`SELECT * FROM claims WHERE build_id=? AND subject IN (${[...subjects].map(() => "?").join(",")}) AND status!='retracted'`).all(build, ...subjects));
  if (linkedClaimIds.length) claims.push(...db.prepare(`SELECT * FROM claims WHERE claim_id IN (${linkedClaimIds.map(() => "?").join(",")}) AND status!='retracted'`).all(...linkedClaimIds));
  claims = [...new Map(claims.map((claim) => [claim.claim_id, publicRow(claim)])).values()];
  const evidenceByClaim = [];
  for (const claim of claims) {
    const evidence = db.prepare(`SELECT ce.stance,e.* FROM claim_evidence ce JOIN evidence e ON e.evidence_id=ce.evidence_id WHERE ce.claim_id=? ORDER BY e.observed_utc`).all(claim.claim_id).map(publicRow);
    evidenceByClaim.push({ claim, evidence });
  }
  const directEvidence = [];
  for (const item of items.filter((entry) => entry.kind === "evidence" && entry.ref_id)) {
    const evidence = publicRow(db.prepare("SELECT * FROM evidence WHERE evidence_id=?").get(item.ref_id));
    if (evidence) directEvidence.push(evidence);
  }
  for (const value of subjects) {
    const found = db.prepare(`SELECT DISTINCT e.* FROM entities n JOIN entity_evidence ee ON ee.entity_id=n.entity_id JOIN evidence e ON e.evidence_id=ee.evidence_id
      WHERE n.build_id=? AND (n.entity_id=? OR n.stable_key=? OR n.address=?)`).all(build, value, value, value).map(publicRow);
    directEvidence.push(...found);
  }
  const uniqueDirect = [...new Map(directEvidence.map((entry) => [entry.evidence_id, entry])).values()];
  const grouped = new Map();
  for (const claim of claims) {
    const key = `${claim.subject}\u001f${claim.predicate}`;
    const values = grouped.get(key) ?? []; values.push(claim); grouped.set(key, values);
  }
  const contradictions = [...grouped.values()].filter((group) => new Set(group.map((claim) => JSON.stringify(claim.object))).size > 1).map((group) => ({ subject: group[0].subject, predicate: group[0].predicate, claims: group }));
  const supporting = evidenceByClaim.flatMap((entry) => entry.evidence.filter((evidence) => evidence.stance !== "opposes"));
  const opposing = evidenceByClaim.flatMap((entry) => entry.evidence.filter((evidence) => evidence.stance === "opposes"));
  const unsupportedClaims = evidenceByClaim.filter((entry) => entry.evidence.length === 0).map((entry) => entry.claim);
  const linkedGapIds = items.filter((item) => item.kind === "gap" && item.ref_id).map((item) => item.ref_id);
  let gaps = [];
  if (linkedGapIds.length) gaps = db.prepare(`SELECT * FROM gaps WHERE gap_id IN (${linkedGapIds.map(() => "?").join(",")}) AND status='open' ORDER BY priority`).all(...linkedGapIds).map(publicRow);
  if (!investigationId && subjects.size) gaps = db.prepare(`SELECT * FROM gaps WHERE build_id=? AND subject IN (${[...subjects].map(() => "?").join(",")}) AND status='open' ORDER BY priority`).all(build, ...subjects).map(publicRow);
  const attempts = listFailedAttempts(db, { investigationId, buildId: investigationId ? null : build, subject: investigationId ? null : subject, limit: 500 });
  const state = contradictions.length || opposing.length ? "contested" : supporting.length || uniqueDirect.length ? (unsupportedClaims.length || gaps.length ? "partially_supported" : "supported_by_current_evidence") : "under_evidenced";
  const nextActions = gaps.map((gap) => ({ kind: "close_gap", gap_id: gap.gap_id, priority: gap.priority, recommendation: gap.recommendation, missing: gap.missing }));
  if (!nextActions.length && unsupportedClaims.length) nextActions.push(...unsupportedClaims.map((claim) => ({ kind: "support_or_retract_claim", claim_id: claim.claim_id, subject: claim.subject, predicate: claim.predicate })));
  if (!nextActions.length && !supporting.length && !uniqueDirect.length) nextActions.push({ kind: "collect_evidence", recommendation: "Add one build-bound independent observation before accepting the claim." });
  return {
    build_id: build, investigation_id: investigationId, subjects: [...subjects], state,
    policy: { confidence_changed: false, consensus_is_evidence: false, automatic_promotion: false },
    direct_evidence: uniqueDirect, claims: evidenceByClaim, supporting_evidence: supporting, opposing_evidence: opposing,
    unsupported_claims: unsupportedClaims, contradictions, open_gaps: gaps, failed_attempts: attempts, next_actions: nextActions,
  };
}
