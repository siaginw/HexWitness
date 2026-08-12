export const FORMAT = "hexwitness-jsonl-v1";
export const SCHEMA_VERSION = 2;
export const VERSION = "0.3.0";

export const RECORD_TYPES = new Set([
  "build",
  "artifact",
  "entity",
  "edge",
  "evidence",
  "claim",
  "capture",
  "event",
  "capture_artifact",
  "marker",
  "relationship",
  "slice",
  "gap",
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
  "method",
  "parameter",
  "local",
  "vtable",
  "vtable_slot",
  "enum",
  "constant",
  "section",
  "module",
  "thread",
  "resource",
  "asset",
  "codec",
  "protocol_fragment",
  "instruction",
  "other",
]);

export const CAPTURE_PACK_SCHEMA = "hexwitness-capture-pack-v1";
export const SCENARIO_SCHEMA = "hexwitness-scenario-v1";
