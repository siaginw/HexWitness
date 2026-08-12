#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ingestFile } from "../src/ingest.mjs";
import { startDaemon } from "../src/daemon.mjs";

function numberOption(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = Number(index >= 0 ? process.argv[index + 1] : fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

const durationMs = numberOption("--duration-ms", process.env.HEXWITNESS_LOAD_DURATION_MS ?? 3000);
const concurrency = Math.floor(numberOption("--concurrency", process.env.HEXWITNESS_LOAD_CONCURRENCY ?? 16));
const root = mkdtempSync(join(tmpdir(), "hexwitness-load-"));
const dbPath = join(root, "evidence.db");
const activityDb = join(root, "activity.db");
const fixture = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
let daemon;

try {
  await ingestFile(dbPath, fixture);
  daemon = startDaemon({ evidenceDb: dbPath, activityDb, activityLog: false, host: "127.0.0.1", port: 0 });
  await new Promise((resolveListening) => daemon.server.once("listening", resolveListening));
  const origin = `http://127.0.0.1:${daemon.server.address().port}`;
  const paths = [
    "/v1/health",
    "/v1/contract",
    "/v1/search?build_id=toy-v1&q=dispatch",
    "/v1/explain?build_id=toy-v1&address=0x401120",
    "/v1/captures/timeline?capture_id=toy-capture-1",
  ];
  const deadline = performance.now() + durationMs;
  const latencies = [];
  const failures = [];
  let requestCount = 0;

  async function worker(index) {
    let ordinal = index;
    while (performance.now() < deadline) {
      const started = performance.now();
      const path = paths[ordinal % paths.length];
      try {
        const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
        await response.arrayBuffer();
        latencies.push(performance.now() - started);
        requestCount += 1;
      } catch (error) {
        failures.push({ path, error: error.message });
      }
      ordinal += concurrency;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
  if (failures.length) throw new Error(`load gate saw ${failures.length} failures: ${JSON.stringify(failures.slice(0, 3))}`);
  if (requestCount < concurrency * 10) throw new Error(`load gate completed too few requests: ${requestCount}`);
  latencies.sort((left, right) => left - right);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    duration_ms: durationMs,
    concurrency,
    requests: requestCount,
    failures: 0,
    requests_per_second: Number((requestCount / (durationMs / 1000)).toFixed(1)),
    latency_ms: {
      p50: Number(percentile(latencies, 0.50).toFixed(2)),
      p95: Number(percentile(latencies, 0.95).toFixed(2)),
      p99: Number(percentile(latencies, 0.99).toFixed(2)),
      max: Number((latencies.at(-1) ?? 0).toFixed(2)),
    },
  }, null, 2)}\n`);
} finally {
  await daemon?.close();
  rmSync(root, { recursive: true, force: true });
}
