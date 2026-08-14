import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("CLI rejects option flags used as missing positional selectors", () => {
  const entry = resolve(import.meta.dirname, "../dist/hexwitness.mjs");
  if (!existsSync(entry)) execFileSync(process.execPath, [resolve(import.meta.dirname, "../scripts/build.mjs")], { stdio: "inherit" });
  const home = mkdtempSync(join(tmpdir(), "hexwitness-cli-"));
  try {
    const run = spawnSync(process.execPath, [entry, "explain", "--build", "toy-v1"], { encoding: "utf8", env: { ...process.env, HEXWITNESS_HOME: home } });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /requires ADDRESS, --stable-key, or --entity-id/);
    assert.doesNotMatch(run.stderr, /BigInt|stack/i);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
