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
  }
  return record;
}
