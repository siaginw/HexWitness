export const OBJECTIVES = ["identity", "control_flow", "data_flow", "object_model", "protocol", "runtime", "behavior"];

const requirements = {
  identity: ["build SHA-256", "architecture", "image base", "function address/size", "symbol and signature"],
  control_flow: ["function entities", "direct call edges", "incoming code references", "switch targets"],
  data_flow: ["data references", "globals", "fields and offsets", "parameter/return roles"],
  object_model: ["types/classes", "vtable addresses and slots", "inheritance edges", "fields and offsets", "constructor/destructor references"],
  protocol: ["message/handler identities", "serializer/deserializer call graph", "field order and widths", "controlled bidirectional runtime events", "payload hashes and lengths"],
  runtime: ["exact build identity", "UTC scenario boundaries", "timestamped action markers", "hook addresses and threads", "semantic fields", "terminal cleanup"],
  behavior: ["static control/data graph", "one narrow controlled runtime scenario", "positive and negative observations", "claims linked to evidence"],
};

export function dumpGuide(objective = "behavior") {
  const selected = OBJECTIVES.includes(objective) ? objective : "behavior";
  return {
    objective: selected,
    required: requirements[selected],
    preferred_static_adapters: ["binary-ninja", "ida", "ghidra"],
    preferred_runtime_adapter: "frida-jsonl or another semantic event exporter",
    provenance: ["artifact SHA-256", "tool and version", "build-scoped addresses", "UTC timestamp", "confidence/source"],
    keep_private: ["executable bytes", "vendor analysis databases", "raw memory", "credentials", "authentication traffic", "raw packet payloads unless separately authorized"],
    interchange: "hexwitness-jsonl-v1",
  };
}
