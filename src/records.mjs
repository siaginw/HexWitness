import { ENTITY_KINDS, FORMAT, RECORD_TYPES } from "./constants.mjs";
import { canonicalAddress, clampConfidence } from "./util.mjs";

function required(record, field) {
  if (record[field] == null || record[field] === "") throw new Error(`${record.record}: missing ${field}`);
}

export const RECORD_REQUIRED_FIELDS = Object.freeze({
  build: ["build_id", "label"],
  artifact: ["build_id", "role"],
  entity: ["build_id", "kind", "stable_key"],
  edge: ["build_id", "kind", "source", "target"],
  evidence: ["build_id", "source", "source_ref", "summary"],
  claim: ["build_id", "subject", "predicate"],
  capture: ["build_id", "capture_id", "scenario"],
  event: ["build_id", "capture_id", "ordinal", "source", "kind", "name"],
  capture_artifact: ["build_id", "capture_id", "role", "path", "sha256", "size_bytes"],
  marker: ["build_id", "capture_id", "ordinal", "name"],
  relationship: ["build_id", "capture_id", "source_ref", "kind", "target_ref"],
  slice: ["build_id", "entity_key", "kind"],
  gap: ["build_id", "subject", "objective"],
  investigation: ["build_id", "investigation_id", "title"],
  investigation_item: ["build_id", "investigation_id", "kind", "title"],
  failed_attempt: ["build_id", "subject", "method", "expected", "actual", "lesson"],
  investigation_usage: ["build_id", "investigation_id", "operation"],
});

export function validateRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("record must be an object");
  const record = { ...input };
  if (record.format !== FORMAT) throw new Error(`unsupported format ${record.format ?? "<missing>"}`);
  if (!RECORD_TYPES.has(record.record)) throw new Error(`unsupported record type ${record.record ?? "<missing>"}`);

  for (const field of RECORD_REQUIRED_FIELDS[record.record]) required(record, field);
  switch (record.record) {
    case "build":
      if (record.image_base != null) record.image_base = canonicalAddress(record.image_base);
      break;
    case "artifact":
      break;
    case "entity":
      if (!ENTITY_KINDS.has(record.kind)) throw new Error(`unsupported entity kind ${record.kind}`);
      if (record.address != null) record.address = canonicalAddress(record.address);
      break;
    case "edge":
      if (record.source_address != null) record.source_address = canonicalAddress(record.source_address);
      if (record.target_address != null) record.target_address = canonicalAddress(record.target_address);
      break;
    case "evidence":
      record.confidence = clampConfidence(record.confidence);
      break;
    case "claim":
      if (!("object" in record)) throw new Error("claim: missing object");
      record.confidence = clampConfidence(record.confidence);
      break;
    case "capture":
      break;
    case "event":
      record.confidence = clampConfidence(record.confidence);
      if (record.address != null) record.address = canonicalAddress(record.address);
      break;
    case "capture_artifact":
      break;
    case "marker":
      break;
    case "relationship":
      record.confidence = clampConfidence(record.confidence);
      break;
    case "slice":
      if (record.start_address != null) record.start_address = canonicalAddress(record.start_address);
      if (record.end_address != null) record.end_address = canonicalAddress(record.end_address);
      break;
    case "gap":
      record.priority = Math.max(0, Math.min(4, Number(record.priority ?? 2)));
      break;
    case "investigation":
      if (record.operation_budget != null && (!Number.isInteger(Number(record.operation_budget)) || Number(record.operation_budget) < 1)) throw new Error("investigation: operation_budget must be a positive integer");
      break;
    case "investigation_item":
      break;
    case "failed_attempt":
      break;
    case "investigation_usage":
      if (!Number.isInteger(Number(record.units ?? 1)) || Number(record.units ?? 1) < 1) throw new Error("investigation_usage: units must be a positive integer");
      break;
  }
  return record;
}
