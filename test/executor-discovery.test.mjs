import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { discover, discoveryContext } from "../src/discovery.mjs";
import { localToolStatus, recordToolObservation, runLocalTool } from "../src/executor.mjs";
import { adapterDiagnostics } from "../src/adapters.mjs";

test("adapter diagnostics separate bundled assets from vendor runtime proof", () => {
  const report = adapterDiagnostics();
  assert.equal(report.adapters.length, 5);
  assert.ok(report.adapters.every((adapter) => adapter.asset.present));
  assert.match(report.boundary, /compatibility still requires an adapter acceptance run/);
});

test("local tools are agent-callable, argv-only, cwd-rooted, credential-scrubbed, and observation-only", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-exec-"));
  try {
    process.env.HEXWITNESS_TEST_TOKEN = "must-not-reach-child";
    const policy = localToolStatus({ root, allow: [process.execPath] });
    assert.equal(policy.enabled, true);
    assert.equal(policy.contract.shell, false);
    assert.equal(policy.contract.cwd_bounded_to_root, true);
    assert.equal(policy.contract.process_filesystem_sandboxed, false);
    const receipt = await runLocalTool({ executable: process.execPath, args: ["-e", "process.stdout.write(process.env.HEXWITNESS_TEST_TOKEN ?? 'proof')"], cwd: root }, { root, allow: [process.execPath] });
    assert.equal(receipt.exit_code, 0);
    assert.equal(receipt.stdout, "proof");
    assert.equal(receipt.observation_only, true);
    assert.equal(receipt.creates_claim, false);
    const capped = await runLocalTool({ executable: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(5000))"] }, { root, allow: [process.execPath], maxOutputBytes: 4096 });
    assert.equal(capped.stdout.length, 4096);
    assert.equal(capped.stdout_truncated, true);
    const timed = await runLocalTool({ executable: process.execPath, args: ["-e", "setTimeout(()=>{},1000)"], timeoutMs: 100 }, { root, allow: [process.execPath] });
    assert.equal(timed.timed_out, true);
    await assert.rejects(runLocalTool({ executable: process.execPath, args: [], cwd: dirname(root) }, { root, allow: [process.execPath] }), /escapes execution root/);
    await assert.rejects(runLocalTool({ executable: process.execPath, args: ["token=secret"] }, { root, allow: [process.execPath] }), /credential-like/);

    const dbPath = join(root, "evidence.db");
    await ingestFile(dbPath, resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl"));
    const db = openEvidenceDb(dbPath);
    try {
      const recorded = recordToolObservation(db, "toy-v1", receipt, "Node emitted a bounded test observation");
      assert.equal(recorded.claim_created, false);
      const row = db.prepare("SELECT classification,confidence FROM evidence WHERE evidence_id=?").get(recorded.evidence_id);
      assert.equal(row.classification, "tool-observation");
      assert.equal(row.confidence, 1);
    } finally { db.close(); }
  } finally { delete process.env.HEXWITNESS_TEST_TOKEN; rmSync(root, { recursive: true, force: true }); }
});

test("retrieval context stays discovery-only and points to exact records", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-discovery-"));
  const dbPath = join(root, "evidence.db");
  let db;
  try {
    await ingestFile(dbPath, resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl"));
    db = openEvidenceDb(dbPath, { readOnly: true });
    const result = discover(db, { query: "dispatch request", buildId: "toy-v1" });
    assert.equal(result.authority, "discovery-only");
    assert.ok(result.results.some((entry) => entry.kind === "entity" && entry.exact_followup.tool === "hexwitness_explain"));
    const context = discoveryContext(db, { query: "dispatch", buildId: "toy-v1", maxChars: 1000 });
    assert.ok(context.augmentation_policy.includes("follow exact query"));
  } finally { db?.close(); rmSync(root, { recursive: true, force: true }); }
});
