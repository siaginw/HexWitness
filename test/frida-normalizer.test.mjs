import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readJsonl } from "../src/ingest.mjs";

test("Frida adapter normalizes semantic events into validated capture records", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-frida-"));
  const output = join(root, "normalized.jsonl");
  const input = resolve(import.meta.dirname, "fixtures/frida-semantic.jsonl");
  const script = resolve(import.meta.dirname, "../adapters/frida-jsonl/normalize.mjs");
  try {
    const run = spawnSync(process.execPath, [script, input, output, "toy-v1", "frida-test"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const records = await readJsonl(output);
    assert.equal(records.length, 3);
    assert.equal(records[0].record, "capture");
    assert.equal(records[1].record, "event");
    assert.equal(records[1].address, "0x401120");
    assert.equal(records[2].ordinal, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Frida normalizer fails closed on missing time and strips generic auth and wire payload fields", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-frida-safety-"));
  const script = resolve(import.meta.dirname, "../adapters/frida-jsonl/normalize.mjs");
  try {
    const unsafe = join(root, "unsafe.jsonl");
    const output = join(root, "normalized.jsonl");
    writeFileSync(unsafe, `${JSON.stringify({ ts_utc: "2026-01-01T00:00:00.000Z", name: "call", packet: "private", fields: { api_key: "secret", session_key: "private", safe: 7 } })}\n`);
    let run = spawnSync(process.execPath, [script, unsafe, output, "build", "capture"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const text = readFileSync(output, "utf8");
    assert.doesNotMatch(text, /private|secret|api_key|session_key/);
    assert.match(text, /"safe":7/);

    const missing = join(root, "missing.jsonl");
    writeFileSync(missing, `${JSON.stringify({ name: "untimed" })}\n`);
    run = spawnSync(process.execPath, [script, missing, output, "build", "capture"], { encoding: "utf8" });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /requires an ISO-8601 UTC timestamp/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
