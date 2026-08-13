import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { openEvidenceDb } from "../src/db.mjs";
import { applyRecord, ingestFile } from "../src/ingest.mjs";
import { addInvestigationItem, challengeEvidence, createInvestigation, investigationProgress, listFailedAttempts, recordFailedAttempt, recordInvestigationUsage, setInvestigationStatus, updateInvestigationItem } from "../src/investigations.mjs";
import { getPlaybook, listPlaybooks } from "../src/playbooks.mjs";

test("durable investigations enforce evidence gates, budgets, failed-attempt memory, and deterministic challenge", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-investigation-"));
  const path = join(root, "evidence.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  let db;
  try {
    await ingestFile(path, fixture);
    db = openEvidenceDb(path);
    const created = createInvestigation(db, { buildId: "toy-v1", title: "Prove dispatcher behavior", question: "Which kind reaches the decoder?", playbookId: "binary", operationBudget: 3 });
    const id = created.investigation.investigation_id;
    assert.equal(created.items.length, getPlaybook("binary").phases.length);
    assert.equal(created.progress.ready_to_complete, false);
    assert.throws(() => setInvestigationStatus(db, id, "complete"), /completion blocked/);
    setInvestigationStatus(db, id, "active");

    const entityId = db.prepare("SELECT entity_id FROM entities WHERE build_id='toy-v1' AND stable_key='fn:0x401120'").get().entity_id;
    addInvestigationItem(db, id, { kind: "entity", refId: entityId, title: "Dispatcher subject" });
    addInvestigationItem(db, id, { kind: "evidence", refId: "evidence_static_dispatch", title: "Static dispatch comparison" });
    const claimId = db.prepare("SELECT claim_id FROM claims WHERE subject='fn:0x401120' AND object_json='7'").get().claim_id;
    addInvestigationItem(db, id, { kind: "claim", refId: claimId, title: "Kind 7 claim" });

    applyRecord(db, { record: "build", build_id: "other-v1", label: "Other" });
    applyRecord(db, { record: "entity", build_id: "other-v1", entity_id: "other-entity", kind: "function", stable_key: "fn:other" });
    assert.throws(() => applyRecord(db, { record: "investigation_item", investigation_id: id, kind: "entity", ref_id: "other-entity", title: "Cross-build leak" }), /different build/);

    const attempt = recordFailedAttempt(db, { investigationId: id, subject: "fn:0x401120", method: "Assume kind 8", expected: "Decoder runs", actual: "No supporting observation", lesson: "Do not reuse unlinked kind-8 hypothesis", tool: "synthetic", toolVersion: "1", evidenceIds: ["evidence_static_dispatch"] });
    assert.equal(attempt.evidence.length, 1);
    assert.equal(listFailedAttempts(db, { investigationId: id }).length, 1);

    const usage = recordInvestigationUsage(db, id, { operation: "explain", units: 2 });
    assert.equal(usage.budget.remaining, 1);
    assert.throws(() => recordInvestigationUsage(db, id, { operation: "capture-search", units: 2 }), /budget exceeded/);

    const challenge = challengeEvidence(db, { investigationId: id });
    assert.equal(challenge.state, "contested");
    assert.equal(challenge.policy.confidence_changed, false);
    assert.equal(challenge.contradictions.length, 1);
    assert.equal(challenge.failed_attempts.length, 1);

    for (const item of created.items) updateInvestigationItem(db, id, item.item_id, { status: "done" });
    assert.equal(investigationProgress(db, id).ready_to_complete, true);
    assert.equal(setInvestigationStatus(db, id, "complete").investigation.status, "complete");
  } finally { db?.close(); rmSync(root, { recursive: true, force: true }); }
});

test("playbooks cover bounded binary, firmware, network, protocol, and runtime workflows", () => {
  const ids = listPlaybooks().map((entry) => entry.id);
  assert.deepEqual(ids, ["binary", "firmware", "network", "protocol", "runtime"]);
  for (const id of ids) {
    const playbook = getPlaybook(id);
    assert.ok(playbook.phases.every((phase) => phase.evidence_classes.length > 0));
    assert.ok(playbook.preferred_adapters.length > 0);
  }
});
