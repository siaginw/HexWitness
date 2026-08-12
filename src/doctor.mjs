import { existsSync } from "node:fs";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { stats } from "./query.mjs";

export function doctor(overrides = {}) {
  const config = loadConfig(overrides);
  const checks = [];
  checks.push({ check: "node", ok: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version });
  checks.push({ check: "local_bind", ok: ["127.0.0.1", "localhost", "::1"].includes(config.host) || Boolean(config.apiToken), detail: `${config.host}:${config.port}` });
  checks.push({ check: "evidence_db", ok: existsSync(config.evidenceDb), detail: config.evidenceDb });
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
