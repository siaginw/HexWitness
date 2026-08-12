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
