import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  addCaptureArtifact, addCaptureMarker, initCapturePack, normalizeCapturePack, sealCapturePack, verifyCapturePack,
} from "../src/capture-pack.mjs";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { captureDetail, captureTimeline } from "../src/query.mjs";

test("capture packs reject missing baseline, seal with hashes, normalize safely, and import", async () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-pack-"));
  const pack = join(root, "capture");
  const buildId = "fixture-build";
  const executableHash = "a".repeat(64);
  try {
    initCapturePack(pack, { buildId, executableSha256: executableHash, scenarioSpec: {
      schema: "hexwitness-scenario-v1", id: "request-roundtrip", title: "Request roundtrip",
      required_roles: ["bidirectional-wire", "semantic-events", "action-markers", "screen-recording", "context"],
      steps: [{ id: "send", instruction: "send" }, { id: "complete", instruction: "complete" }],
    } });
    assert.throws(() => sealCapturePack(pack), /quality gate failed/);

    const wire = join(root, "wire.jsonl");
    const semantic = join(root, "semantic.jsonl");
    const video = join(root, "screen.mp4");
    const context = join(root, "context.json");
    writeFileSync(wire, `${JSON.stringify({ ts_utc: "2026-01-01T00:00:01.000Z", source: "wire", kind: "message", name: "request", direction: "client_to_server", payload: "private bytes", fields: { correlation_id: 7 } })}\n${JSON.stringify({ format: "hexwitness-jsonl-v1", record: "event", build_id: "wrong-build", capture_id: "wrong-capture", ordinal: 99, ts_utc: "2026-01-01T00:00:02.000Z", source: "wire", kind: "message", name: "response", direction: "server_to_client", body: "private response", fields: { correlation_id: 7 } })}\n`);
    writeFileSync(semantic, `${JSON.stringify({ ts_utc: "2026-01-01T00:00:01.500Z", source: "hook", kind: "call", name: "dispatch", address: "0x401000", action_id: "send", fields: { object_id: "object-1", token: "must-not-survive", nested: [{ cookie: "also-secret", safe: "kept" }] } })}\n`);
    writeFileSync(video, "synthetic-video-fixture");
    writeFileSync(context, JSON.stringify({ target: "synthetic", operator: "fixture" }));
    addCaptureArtifact(pack, wire, "bidirectional-wire");
    addCaptureArtifact(pack, semantic, "semantic-events");
    addCaptureArtifact(pack, video, "screen-recording");
    addCaptureArtifact(pack, context, "context");
    addCaptureMarker(pack, "send", "send one request");
    addCaptureMarker(pack, "complete", "observe completion");

    const normalized = normalizeCapturePack(pack);
    const normalizedText = readFileSync(normalized.output, "utf8");
    assert.doesNotMatch(normalizedText, /private bytes|private response|must-not-survive|also-secret/);
    assert.match(normalizedText, /"safe":"kept"/);
    assert.match(normalizedText, /response_to/);
    const sealed = sealCapturePack(pack);
    assert.equal(sealed.manifest.quality, "accepted");
    assert.equal(verifyCapturePack(pack).passed, true);

    const dbPath = join(root, "evidence.db");
    await ingestFile(dbPath, normalized.output);
    const db = openEvidenceDb(dbPath, { readOnly: true });
    const detail = captureDetail(db, sealed.manifest.capture_id);
    assert.equal(detail.artifacts.length, 4);
    assert.equal(detail.markers.length, 2);
    assert.ok(detail.relationships.length >= 2);
    assert.equal(captureTimeline(db, sealed.manifest.capture_id).length, 3);
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("failed normalization leaves a capture active and recoverable", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-pack-rollback-"));
  const pack = join(root, "capture");
  const malformed = join(root, "semantic.jsonl");
  try {
    initCapturePack(pack, { buildId: "fixture-build", scenario: "rollback", requiredRoles: ["semantic-events", "action-markers"] });
    writeFileSync(malformed, "{not-json}\n");
    addCaptureArtifact(pack, malformed, "semantic-events");
    addCaptureMarker(pack, "attempt", "trigger malformed normalization");
    assert.throws(() => sealCapturePack(pack), /semantic\.jsonl:1/);
    const manifest = JSON.parse(readFileSync(join(pack, "manifest.json"), "utf8"));
    assert.equal(manifest.status, "active");
    assert.equal(manifest.finished_utc, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("allow-incomplete permits missing evidence but never corrupt artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-pack-incomplete-"));
  const pack = join(root, "capture");
  const semantic = join(root, "semantic.jsonl");
  try {
    initCapturePack(pack, { buildId: "fixture-build", scenario: "incomplete", requiredRoles: ["semantic-events", "screen-recording", "action-markers"] });
    writeFileSync(semantic, `${JSON.stringify({ ts_utc: "2026-01-01T00:00:00.000Z", kind: "call", name: "observe" })}\n`);
    addCaptureArtifact(pack, semantic, "semantic-events");
    addCaptureMarker(pack, "observe");
    const sealed = sealCapturePack(pack, { allowIncomplete: true });
    assert.equal(sealed.manifest.quality, "incomplete");

    const corruptPack = join(root, "corrupt");
    const empty = join(root, "empty.jsonl");
    initCapturePack(corruptPack, { buildId: "fixture-build", scenario: "corrupt", requiredRoles: ["semantic-events"] });
    writeFileSync(empty, "");
    addCaptureArtifact(corruptPack, empty, "semantic-events");
    assert.throws(() => sealCapturePack(corruptPack, { allowIncomplete: true }), /integrity gate failed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
