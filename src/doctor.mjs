import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { stats } from "./query.mjs";

export function doctor(overrides = {}) {
  const config = loadConfig(overrides);
  const checks = [];
  checks.push({ check: "node", ok: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version });
  checks.push({ check: "local_bind", ok: ["127.0.0.1", "localhost", "::1"].includes(config.host) || Boolean(config.apiToken), detail: `${config.host}:${config.port}` });
  checks.push({ check: "evidence_db", ok: existsSync(config.evidenceDb), detail: config.evidenceDb });
  const root = resolve(import.meta.dirname, "..");
  for (const relative of ["schemas/hexwitness-jsonl-v1.schema.json", "schemas/capture-pack-v1.schema.json", "schemas/scenario-v1.schema.json", "schemas/adapter-manifest-v1.schema.json", "adapters/manifest.json"]) {
    const path = resolve(root, relative);
    let ok = existsSync(path);
    if (ok) { try { JSON.parse(readFileSync(path, "utf8")); } catch { ok = false; } }
    checks.push({ check: `contract:${relative}`, ok, detail: ok ? "available" : "missing or invalid JSON" });
  }
  if (existsSync(config.evidenceDb)) {
    try {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      checks.push({ check: "schema", ok: true, detail: db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value ?? "unknown" });
      checks.push({ check: "content", ok: true, detail: stats(db) });
      db.close();
    } catch (error) { checks.push({ check: "schema", ok: false, detail: error.message }); }
  }
  return { ok: checks.every((entry) => entry.ok), config: { ...config, apiToken: config.apiToken ? "<set>" : "<unset>" }, checks };
}
