import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FORMAT } from "../src/constants.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { ingestRecords } from "../src/ingest.mjs";
import {
  analysisSlices, captureSearch, classDetail, compareBuilds, compareCaptures, dataflow, decompSearch, edgeKinds, fieldOffsets,
  gapWorklist, genericQuery, metadataLookup, reachable, shortestPath, typeRegistry, uuidLookup,
  gapReport,
} from "../src/query.mjs";

const base = (record, fields) => ({ format: FORMAT, record, ...fields });

test("generic parity queries cover classes, UUIDs, slices, dataflow, reach, gaps, and capture divergence", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-parity-"));
  const dbPath = join(root, "evidence.db");
  let db;
  try {
    db = openEvidenceDb(dbPath);
    const build_id = "parity-build";
    ingestRecords(db, [
      base("build", { build_id, label: "Parity fixture" }),
      base("entity", { build_id, kind: "class", stable_key: "type:Widget", name: "Widget", metadata: { uuid: "11111111-2222-3333-4444-555555555555" } }),
      base("entity", { build_id, kind: "field", stable_key: "type:Widget:field:8:value", name: "value", metadata: { offset: 8 } }),
      base("entity", { build_id, kind: "method", stable_key: "fn:0x1000", name: "Widget::set", address: "0x1000" }),
      base("entity", { build_id, kind: "global", stable_key: "global:widget", name: "g_widget", address: "0x2000" }),
      base("edge", { build_id, kind: "field", source: "type:Widget", target: "type:Widget:field:8:value" }),
      base("edge", { build_id, kind: "method", source: "type:Widget", target: "fn:0x1000" }),
      base("edge", { build_id, kind: "writes", source: "fn:0x1000", target: "global:widget" }),
      base("slice", { build_id, entity_key: "fn:0x1000", kind: "ssa", start_address: "0x1000", end_address: "0x1010", operations: [{ op: "store", target: "global:widget" }] }),
      base("gap", { build_id, subject: "fn:0x1000", objective: "runtime", missing: ["one observed call"], priority: 1 }),
      base("capture", { build_id, capture_id: "left", scenario: "negative", status: "sealed" }),
      base("event", { build_id, capture_id: "left", ordinal: 1, source: "wire", kind: "message", name: "request", direction: "send" }),
      base("capture", { build_id, capture_id: "right", scenario: "positive", status: "sealed" }),
      base("event", { build_id, capture_id: "right", ordinal: 1, source: "wire", kind: "message", name: "request", direction: "send" }),
      base("event", { build_id, capture_id: "right", ordinal: 2, source: "wire", kind: "message", name: "response", direction: "receive" }),
      base("build", { build_id: "parity-build-v2", label: "Parity fixture v2" }),
      base("entity", { build_id: "parity-build-v2", kind: "class", stable_key: "type:Widget", name: "Widget" }),
      base("entity", { build_id: "parity-build-v2", kind: "method", stable_key: "fn:0x1000", name: "Widget::set", address: "0x1100" }),
      base("entity", { build_id: "parity-build-v2", kind: "method", stable_key: "fn:0x1200", name: "Widget::get", address: "0x1200" }),
    ]);

    assert.equal(classDetail(db, { buildId: build_id, name: "Widget" }).members.length, 2);
    assert.equal(uuidLookup(db, { buildId: build_id, uuid: "11111111-2222-3333-4444-555555555555" }).length, 1);
    assert.ok(typeRegistry(db, { buildId: build_id, q: "Widget" }).length >= 1);
    assert.equal(analysisSlices(db, { buildId: build_id, address: "0x1000" }).slices[0].kind, "ssa");
    assert.equal(dataflow(db, { buildId: build_id, address: "0x1000" }).outgoing.length, 1);
    assert.equal(reachable(db, { buildId: build_id, stableKey: "type:Widget" }, { depth: 2 }).nodes.length, 4);
    assert.equal(genericQuery(db, { buildId: build_id, kinds: ["class"] }).length, 1);
    assert.equal(fieldOffsets(db, { buildId: build_id, owner: "Widget", q: "value" }).length, 1);
    assert.equal(metadataLookup(db, { buildId: build_id, q: "11111111-2222" }).length, 1);
    assert.equal(decompSearch(db, { buildId: build_id, q: "store", kind: "ssa" }).slices.length, 1);
    assert.equal(shortestPath(db, { buildId: build_id, stableKey: "type:Widget" }, { buildId: build_id, stableKey: "global:widget" }).path.length, 2);
    assert.ok(edgeKinds(db, { buildId: build_id }).some((item) => item.kind === "writes"));
    const buildDiff = compareBuilds(db, build_id, "parity-build-v2");
    assert.equal(buildDiff.added.length, 1);
    assert.ok(buildDiff.changed.some((item) => item.stable_key === "fn:0x1000"));
    assert.equal(gapWorklist(db, { buildId: build_id }).length, 1);
    const comparison = compareCaptures(db, "left", "right");
    assert.equal(comparison.first_divergence.index, 1);
    assert.equal(comparison.deltas[0].delta, 1);
    assert.equal(captureSearch(db, { captureId: "right", q: "response" })[0].name, "response");
    assert.equal(compareCaptures(db, "left", "missing"), null);
    ingestRecords(db, [
      base("capture", { build_id: "parity-build-v2", capture_id: "other-build", scenario: "mismatch", status: "sealed" }),
      base("event", { build_id: "parity-build-v2", capture_id: "other-build", ordinal: 1, source: "wire", kind: "message", name: "request" }),
    ]);
    assert.throws(() => compareCaptures(db, "left", "other-build"), /same build_id/);
    assert.throws(() => gapReport(db, { buildId: build_id, address: "0x1000" }, "typo"), /unsupported gap objective/);
  } finally { db?.close(); rmSync(root, { recursive: true, force: true }); }
});
