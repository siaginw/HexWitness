import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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
