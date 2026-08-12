import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packCaptureDirectory } from "../src/capture-bundle.mjs";

test("one-command capture pack detects, seals, verifies, and preserves marker time", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-bundle-"));
  const source = join(root, "roundtrip");
  const output = join(root, "roundtrip.pack");
  try {
    mkdirSync(source);
    const ts = "2026-08-11T12:00:00.000Z";
    writeFileSync(join(source, "wire.jsonl"), `${JSON.stringify({ ts_utc: ts, source: "wire", kind: "message", name: "request", direction: "client_to_server" })}\n`);
    writeFileSync(join(source, "hooks.jsonl"), `${JSON.stringify({ ts_utc: "2026-08-11T12:00:00.100Z", source: "hook", kind: "call", name: "dispatch", action_id: "request" })}\n`);
    writeFileSync(join(source, "screen.mp4"), "synthetic-screen");
    writeFileSync(join(source, "context.json"), JSON.stringify({ target: "synthetic" }));
    writeFileSync(join(source, "capture.json"), JSON.stringify({
      schema: "hexwitness-capture-input-v1",
      scenario: "request-roundtrip",
      build_id: "fixture-build",
      executable_sha256: "a".repeat(64),
      markers: [{ name: "request", note: "perform one action", ts_utc: ts }],
      import: false,
    }));
    const result = await packCaptureDirectory(source, { output, import: false });
    assert.equal(result.ok, true);
    assert.equal(result.quality, "accepted");
    assert.equal(result.verification.passed, true);
    assert.equal(existsSync(join(output, "checksums.sha256")), true);
    const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
    assert.equal(manifest.markers[0].ts_utc, ts);
    assert.equal(manifest.artifacts.some((artifact) => artifact.role === "bidirectional-wire"), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("capture directory is the short CLI path", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-cli-bundle-"));
  const source = join(root, "roundtrip");
  const output = join(root, "roundtrip.pack");
  try {
    mkdirSync(source);
    const ts = "2026-08-11T12:00:00.000Z";
    writeFileSync(join(source, "wire.jsonl"), `${JSON.stringify({ ts_utc: ts, source: "wire", kind: "message", name: "request" })}\n`);
    writeFileSync(join(source, "hooks.jsonl"), `${JSON.stringify({ ts_utc: ts, source: "hook", kind: "call", name: "dispatch" })}\n`);
    writeFileSync(join(source, "screen.mp4"), "synthetic-screen");
    writeFileSync(join(source, "context.json"), "{}");
    writeFileSync(join(source, "capture.json"), JSON.stringify({
      schema: "hexwitness-capture-input-v1",
      scenario: "request-roundtrip",
      build_id: "fixture-build",
      executable_sha256: "a".repeat(64),
      markers: [{ name: "request", ts_utc: ts }],
      import: false,
    }));
    const run = spawnSync(process.execPath, [join(import.meta.dirname, "..", "bin", "hexwitness.mjs"), "capture", source, "--out", output, "--no-import"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).verification.passed, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("one-command capture can publish an explicitly incomplete exploratory pack", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-bundle-incomplete-"));
  const source = join(root, "partial");
  try {
    mkdirSync(source);
    const ts = "2026-08-11T12:00:00.000Z";
    writeFileSync(join(source, "hooks.jsonl"), `${JSON.stringify({ ts_utc: ts, kind: "call", name: "observe" })}\n`);
    writeFileSync(join(source, "capture.json"), JSON.stringify({
      schema: "hexwitness-capture-input-v1", scenario: "exploratory", build_id: "fixture-build",
      markers: [{ name: "observe", ts_utc: ts }], import: false,
    }));
    const result = await packCaptureDirectory(source, { import: false, allowIncomplete: true });
    assert.equal(result.quality, "incomplete");
    assert.equal(result.verification.passed, false);
    assert.deepEqual(result.verification.errors, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
