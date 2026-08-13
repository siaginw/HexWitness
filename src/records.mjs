import { ENTITY_KINDS, FORMAT, RECORD_TYPES } from "./constants.mjs";
import { canonicalAddress, clampConfidence } from "./util.mjs";

function required(record, field) {
  if (record[field] == null || record[field] === "") throw new Error(`${record.record}: missing ${field}`);
}

export function validateRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("record must be an object");
  const record = { ...input };
  if (record.format !== FORMAT) throw new Error(`unsupported format ${record.format ?? "<missing>"}`);
  if (!RECORD_TYPES.has(record.record)) throw new Error(`unsupported record type ${record.record ?? "<missing>"}`);

  if (record.record !== "build") required(record, "build_id");
  switch (record.record) {
    case "build":
      required(record, "build_id"); required(record, "label");
      if (record.image_base != null) record.image_base = canonicalAddress(record.image_base);
      break;
    case "artifact":
      required(record, "role");
      break;
    case "entity":
      required(record, "kind"); required(record, "stable_key");
      if (!ENTITY_KINDS.has(record.kind)) throw new Error(`unsupported entity kind ${record.kind}`);
      if (record.address != null) record.address = canonicalAddress(record.address);
      break;
    case "edge":
      required(record, "kind"); required(record, "source"); required(record, "target");
      if (record.source_address != null) record.source_address = canonicalAddress(record.source_address);
      if (record.target_address != null) record.target_address = canonicalAddress(record.target_address);
      break;
    case "evidence":
      required(record, "source"); required(record, "source_ref"); required(record, "summary");
      record.confidence = clampConfidence(record.confidence);
      break;
    case "claim":
      required(record, "subject"); required(record, "predicate");
      if (!("object" in record)) throw new Error("claim: missing object");
      record.confidence = clampConfidence(record.confidence);
      break;
    case "capture":
      required(record, "capture_id"); required(record, "scenario");
      break;
    case "event":
      required(record, "capture_id"); required(record, "ordinal"); required(record, "source");
      required(record, "kind"); required(record, "name");
      record.confidence = clampConfidence(record.confidence);
      if (record.address != null) record.address = canonicalAddress(record.address);
      break;
    case "capture_artifact":
      required(record, "capture_id"); required(record, "role"); required(record, "path");
      required(record, "sha256"); required(record, "size_bytes");
      break;
    case "marker":
      required(record, "capture_id"); required(record, "ordinal"); required(record, "name");
      break;
    case "relationship":
      required(record, "capture_id"); required(record, "source_ref"); required(record, "kind"); required(record, "target_ref");
      record.confidence = clampConfidence(record.confidence);
      break;
    case "slice":
      required(record, "build_id"); required(record, "entity_key"); required(record, "kind");
      if (record.start_address != null) record.start_address = canonicalAddress(record.start_address);
      if (record.end_address != null) record.end_address = canonicalAddress(record.end_address);
      break;
    case "gap":
      required(record, "subject"); required(record, "objective");
      record.priority = Math.max(0, Math.min(4, Number(record.priority ?? 2)));
      break;
    case "investigation":
      required(record, "investigation_id"); required(record, "title");
      if (record.operation_budget != null && (!Number.isInteger(Number(record.operation_budget)) || Number(record.operation_budget) < 1)) throw new Error("investigation: operation_budget must be a positive integer");
      break;
    case "investigation_item":
      required(record, "investigation_id"); required(record, "kind"); required(record, "title");
      break;
    case "failed_attempt":
      required(record, "subject"); required(record, "method"); required(record, "expected"); required(record, "actual"); required(record, "lesson");
      break;
    case "investigation_usage":
      required(record, "investigation_id"); required(record, "operation");
      if (!Number.isInteger(Number(record.units ?? 1)) || Number(record.units ?? 1) < 1) throw new Error("investigation_usage: units must be a positive integer");
      break;
  }
  return record;
}
