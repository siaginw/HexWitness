import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { stats } from "./query.mjs";
import { adapterCatalog, adapterDiagnostics } from "./adapters.mjs";
import { isSupportedNode, publicContract } from "./contract.mjs";
import { SCHEMA_VERSION } from "./constants.mjs";

export function doctor(overrides = {}) {
  const config = loadConfig(overrides);
  const checks = [];
  checks.push({ check: "node", ok: isSupportedNode(), detail: `${process.version} (minimum ${publicContract().node.minimum})` });
  checks.push({ check: "local_bind", ok: ["127.0.0.1", "localhost", "::1"].includes(config.host) || Boolean(config.apiToken), detail: `${config.host}:${config.port}` });
  checks.push({ check: "evidence_db", ok: existsSync(config.evidenceDb), detail: config.evidenceDb });
  const root = resolve(import.meta.dirname, "..");
  for (const relative of ["schemas/hexwitness-jsonl-v1.schema.json", "schemas/capture-pack-v1.schema.json", "schemas/scenario-v1.schema.json", "schemas/adapter-manifest-v1.schema.json", "adapters/manifest.json"]) {
    const path = resolve(root, relative);
    let ok = existsSync(path);
    if (ok) { try { JSON.parse(readFileSync(path, "utf8")); } catch { ok = false; } }
    checks.push({ check: `contract:${relative}`, ok, detail: ok ? "available" : "missing or invalid JSON" });
  }
  const adapters = adapterCatalog().adapters;
  checks.push({ check: "adapters", ok: adapters.every((adapter) => existsSync(adapter.absolute_path)), detail: { count: adapters.length, ids: adapters.map((adapter) => adapter.id) } });
  checks.push({ check: "adapter_runtime_diagnostics", ok: true, detail: adapterDiagnostics() });
  if (existsSync(config.evidenceDb)) {
    try {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      const schema = Number(db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value);
      checks.push({ check: "schema", ok: schema === SCHEMA_VERSION, detail: { database: schema, supported: SCHEMA_VERSION } });
      checks.push({ check: "content", ok: true, detail: stats(db) });
      db.close();
    } catch (error) { checks.push({ check: "schema", ok: false, detail: error.message }); }
  }
  return { ok: checks.every((entry) => entry.ok), config: { ...config, apiToken: config.apiToken ? "<set>" : "<unset>" }, checks };
}
