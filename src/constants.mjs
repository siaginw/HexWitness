export const FORMAT = "hexwitness-jsonl-v1";
export const SCHEMA_VERSION = 1;
export const VERSION = "0.1.0";

export const RECORD_TYPES = new Set([
  "build",
  "artifact",
  "entity",
  "edge",
  "evidence",
  "claim",
  "capture",
  "event",
]);

export const ENTITY_KINDS = new Set([
  "function",
  "symbol",
  "string",
  "type",
  "class",
  "field",
  "global",
  "import",
  "export",
  "basic_block",
  "runtime_object",
  "protocol_message",
  "other",
]);
