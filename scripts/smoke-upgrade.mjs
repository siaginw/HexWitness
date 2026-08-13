#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { downgradeFixtureToSchema1 } from "./schema-v1-fixture.mjs";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "hexwitness-upgrade-"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run this check through `npm run test:upgrade`");
const npm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);

try {
  const database = join(scratch, "legacy", "evidence.db");
  await ingestFile(database, resolve(root, "examples/toy-binary/evidence.jsonl"));
  const legacy = openEvidenceDb(database);
  downgradeFixtureToSchema1(legacy);
  legacy.close();

  const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", scratch], { cwd: root, encoding: "utf8" }));
  const app = join(scratch, "app");
  npm(["install", "--prefix", app, "--ignore-scripts", join(scratch, packed[0].filename)], { cwd: root, stdio: "pipe" });
  const packageJson = JSON.parse(readFileSync(join(app, "node_modules", "hexwitness", "package.json"), "utf8"));
  const cli = join(app, "node_modules", "hexwitness", packageJson.bin.hexwitness);
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `installed command failed: ${args.join(" ")}`);
    return JSON.parse(result.stdout);
  };

  const initialized = run("init", "--db", database);
  if (!initialized.ok) throw new Error("installed migration did not initialize");
  const counts = run("stats", "--db", database);
  if (counts.entities !== 4 || counts.builds !== 1) throw new Error(`migration lost evidence: ${JSON.stringify(counts)}`);
  const contract = run("contract");
  if (contract.version !== packageJson.version || contract.stability !== "stable-1.x") throw new Error(`contract mismatch: ${JSON.stringify(contract)}`);
  const backup = run("backup", join(scratch, "backup", "evidence.db"), "--db", database);
  if (!backup.ok || backup.integrity !== "ok") throw new Error(`installed backup failed: ${JSON.stringify(backup)}`);
  console.log(`Upgrade journey passed: schema 1 -> ${contract.database.schema_version} with ${counts.entities} entities retained, backup verified, package ${packageJson.version}.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
