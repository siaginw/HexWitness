import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

test("public JSON Schema accepts the complete synthetic interchange fixture", () => {
  const schema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/hexwitness-jsonl-v1.schema.json"), "utf8"));
  const fixture = readFileSync(resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => JSON.parse(line));
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true, formats: { "date-time": true } });
  const validate = ajv.compile(schema);
  for (const record of fixture) {
    assert.equal(validate(record), true, `${record.record}: ${JSON.stringify(validate.errors)}`);
  }
  assert.equal(validate({ format: "hexwitness-jsonl-v1", record: "entity", build_id: "toy-v1" }), false);
});

test("capture, scenario, and extended evidence schemas validate their public contracts", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true, formats: { "date-time": true } });
  const evidenceSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/hexwitness-jsonl-v1.schema.json"), "utf8"));
  const captureSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/capture-pack-v1.schema.json"), "utf8"));
  const scenarioSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/scenario-v1.schema.json"), "utf8"));
  const captureInputSchema = JSON.parse(readFileSync(resolve(import.meta.dirname, "../schemas/capture-input-v1.schema.json"), "utf8"));
  assert.equal(ajv.compile(evidenceSchema)({ format: "hexwitness-jsonl-v1", record: "slice", build_id: "b", entity_key: "fn:0x1", kind: "ssa", operations: [] }), true);
  assert.equal(ajv.compile(evidenceSchema)({ format: "hexwitness-jsonl-v1", record: "investigation", build_id: "b", investigation_id: "i", title: "Question", operation_budget: 10 }), true);
  assert.equal(ajv.compile(evidenceSchema)({ format: "hexwitness-jsonl-v1", record: "failed_attempt", build_id: "b", subject: "fn:1", method: "probe", expected: "yes", actual: "no", lesson: "wrong build" }), true);
  assert.equal(ajv.compile(captureSchema)({ schema: "hexwitness-capture-pack-v1", schema_version: 1, capture_id: "cap", scenario: "test", status: "active", quality: "pending", build_id: "b", started_utc: "2026-01-01T00:00:00.000Z", required_roles: [], artifacts: [], markers: [] }), true);
  assert.equal(ajv.compile(scenarioSchema)({ schema: "hexwitness-scenario-v1", id: "roundtrip", title: "Roundtrip", required_roles: [], steps: [{ id: "send", instruction: "Send one request" }] }), true);
  assert.equal(ajv.compile(captureInputSchema)({ schema: "hexwitness-capture-input-v1", scenario: "roundtrip", build_id: "b", markers: [{ name: "send", ts_utc: "2026-01-01T00:00:00.000Z" }] }), true);
});
