export const FORMAT = "hexwitness-jsonl-v1";
export const SCHEMA_VERSION = 4;
export const MIN_READABLE_SCHEMA_VERSION = 1;
export const VERSION = "1.2.0";
export const API_VERSION = "v1";

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
  "investigation",
  "investigation_item",
  "failed_attempt",
  "investigation_usage",
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
