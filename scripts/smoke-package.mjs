#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "hexwitness-package-"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run this check through `npm run test:package`");
const npm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);
try {
  const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", scratch], { cwd: root, encoding: "utf8" }));
  const tarball = join(scratch, packed[0].filename);
  const app = join(scratch, "app");
  npm(["install", "--prefix", app, "--ignore-scripts", tarball], { cwd: root, stdio: "pipe" });
  const cli = join(app, "node_modules", "hexwitness", "bin", "hexwitness.mjs");
  const state = join(scratch, "state");
  const run = spawnSync(process.execPath, [cli, "demo", "--reset"], {
    encoding: "utf8",
    env: { ...process.env, HEXWITNESS_HOME: state },
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || "installed CLI failed");
  const result = JSON.parse(run.stdout);
  if (result.accepted !== 15 || result.format !== "hexwitness-jsonl-v1") throw new Error(`unexpected demo result: ${run.stdout}`);
  const doctor = spawnSync(process.execPath, [cli, "doctor"], {
    encoding: "utf8",
    env: { ...process.env, HEXWITNESS_HOME: state },
  });
  if (doctor.status !== 0) throw new Error(doctor.stderr || doctor.stdout || "installed doctor failed");
  const diagnosis = JSON.parse(doctor.stdout);
  if (!diagnosis.ok || !diagnosis.checks.every((check) => check.ok)) throw new Error(`unexpected doctor result: ${doctor.stdout}`);
  const packageJson = JSON.parse(readFileSync(join(app, "node_modules", "hexwitness", "package.json"), "utf8"));
  for (const bin of ["hexwitness", "hexwitness-mcp", "hexwitness-agent", "hexwitness-setup"]) {
    if (!packageJson.bin?.[bin]) throw new Error(`installed package missing bin entry: ${bin}`);
  }
  const setup = spawnSync(process.execPath, [join(app, "node_modules", "hexwitness", "bin", "hexwitness-setup.mjs"),
    "--client", "generic", "--viewer", "none", "--output", join(scratch, "mcp.json"), "--dry-run", "--yes"], { encoding: "utf8" });
  if (setup.status !== 0 || !setup.stdout.includes("Setup plan ready")) throw new Error(setup.stderr || setup.stdout || "installed setup wizard failed");
  console.log(`Package smoke passed: ${packageJson.name}@${packageJson.version}, ${result.accepted} records, doctor healthy, setup wizard healthy.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
