import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { ingestFile } from "../src/ingest.mjs";
import { startDaemon } from "../src/daemon.mjs";

test("daemon serves read-only evidence queries and records safe activity", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-daemon-"));
  const dbPath = join(root, "evidence.db");
  const activityDb = join(root, "activity.db");
  const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
  await ingestFile(dbPath, fixture);
  const instance = startDaemon({ evidenceDb: dbPath, activityDb, host: "127.0.0.1", port: 0 });
  await new Promise((resolveListening) => instance.server.once("listening", resolveListening));
  const port = instance.server.address().port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/v1/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.stats.entities, 4);

    const dossier = await fetch(`http://127.0.0.1:${port}/v1/explain?build_id=toy-v1&address=0x401120`).then((response) => response.json());
    assert.equal(dossier.entity.name, "dispatch_request");

    const routes = await fetch(`http://127.0.0.1:${port}/v1/routes`).then((response) => response.json());
    assert.equal(routes.routes.includes("/v1/class"), true);
    assert.equal(routes.routes.includes("/v1/captures/compare"), true);
    assert.equal(routes.routes.includes("/v1/contract"), true);

    const contract = await fetch(`http://127.0.0.1:${port}/v1/contract`).then((response) => response.json());
    assert.equal(contract.stability, "stable-1.x");
    assert.equal(contract.version, "1.0.0");

    const memory = await fetch(`http://127.0.0.1:${port}/v1/memory`).then((response) => response.json());
    assert.equal(memory.mode, "durable-evidence-first");
    assert.equal(memory.policy.query_before_live_tool, true);
    assert.equal(memory.policy.activity_retains_arguments_or_results, false);
    assert.equal(memory.durable.entities, 4);

    const queried = await fetch(`http://127.0.0.1:${port}/v1/query?build_id=toy-v1&q=dispatch&kinds=function`).then((response) => response.json());
    assert.equal(queried[0].name, "dispatch_request");

    const writeAttempt = await fetch(`http://127.0.0.1:${port}/v1/ingest`, { method: "POST" });
    assert.equal(writeAttempt.status, 405);
  } finally {
    await instance.close();
    rmSync(root, { recursive: true, force: true });
  }
});
