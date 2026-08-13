import { API_VERSION, FORMAT, MIN_READABLE_SCHEMA_VERSION, SCHEMA_VERSION, VERSION } from "./constants.mjs";

export const PUBLIC_COMMANDS = Object.freeze([
  "init", "setup", "agent", "mcp", "adapters", "contract", "backup", "ingest", "query", "serve", "search",
  "builds", "memory", "explain", "gaps", "guide", "contradictions", "functions", "classes", "class", "uuid",
  "types", "offsets", "metadata", "decomp-search", "path", "edge-kinds", "compare-builds", "reach", "dataflow",
  "callers", "callees", "xrefs", "vtable", "slices", "evidence", "worklist", "coverage", "captures",
  "capture-detail", "capture-timeline", "capture-search", "capture-graph", "capture-compare", "capture", "stats",
  "investigation", "attempt", "attempts", "challenge", "playbooks", "discover", "context", "tool",
  "doctor", "demo", "version", "help",
]);

export function isSupportedNode(version = process.versions.node) {
  const [major, minor, patch] = String(version).replace(/^v/, "").split(".").map(Number);
  if (![major, minor, patch].every(Number.isInteger)) return false;
  return major > 22 || (major === 22 && (minor > 13 || (minor === 13 && patch >= 0)));
}

export function publicContract() {
  return {
    product: "hexwitness",
    version: VERSION,
    stability: "stable-1.x",
    node: { minimum: "22.13.0", tested_majors: [22, 24] },
    interchange: { format: FORMAT, compatibility: "additive-within-v1" },
    database: {
      schema_version: SCHEMA_VERSION,
      minimum_readable_schema_version: MIN_READABLE_SCHEMA_VERSION,
      future_versions: "fail-closed",
      backup: "consistent-sqlite-snapshot",
    },
    rest: { version: API_VERSION, compatibility: "additive-within-v1", mutation: "none" },
    mcp: { compatibility: "tool-names-and-required-fields-stable-within-1.x", mutation: "explicit-investigation-state-and-tool-observation-only", database_mutation: "durable-investigation-ledger-or-build-bound-tool-observation", local_process: "explicit-allowlisted-or-project-local-tool-only" },
    cli: { compatibility: "commands-and-existing-option-semantics-stable-within-1.x", commands: PUBLIC_COMMANDS },
    deprecation: { minimum_notice: "one-minor-release", removal: "next-major-only" },
  };
}
