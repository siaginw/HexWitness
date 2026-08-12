#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "hexwitness-package-"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run this check through `npm run test:package`");
const npm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

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
  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  if (version.status !== 0 || version.stdout.trim() !== packageJson.version) throw new Error(`installed version mismatch: ${version.stdout || version.stderr}`);
  for (const bin of ["hexwitness", "hexwitness-mcp", "hexwitness-agent", "hexwitness-setup"]) {
    if (!packageJson.bin?.[bin]) throw new Error(`installed package missing bin entry: ${bin}`);
  }
  const setup = spawnSync(process.execPath, [join(app, "node_modules", "hexwitness", "bin", "hexwitness-setup.mjs"),
    "--client", "codex,claude-code,cursor,vscode,claude-desktop,generic", "--viewer", "none", "--output", join(scratch, "mcp.json"), "--dry-run", "--yes", "--json"], { encoding: "utf8" });
  if (setup.status !== 0) throw new Error(setup.stderr || setup.stdout || "installed setup wizard failed");
  const setupResult = JSON.parse(setup.stdout);
  if (setupResult.results.length !== 6 || setupResult.results.some((entry) => entry.guidance.status !== "planned")) throw new Error(`unexpected setup plan: ${setup.stdout}`);
  const port = await freePort();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(app, "node_modules", "hexwitness", "bin", "hexwitness-agent.mjs")],
    env: { ...process.env, HEXWITNESS_HOME: state, HEXWITNESS_PORT: String(port), HEXWITNESS_ACTIVITY_LOG: "0", HEXWITNESS_AGENT_SESSION: "package-smoke" },
    stderr: "pipe",
  });
  const client = new Client({ name: "hexwitness-package-smoke", version: packageJson.version });
  try {
    await client.connect(transport);
    const dossier = await client.callTool({ name: "hexwitness_explain", arguments: { build_id: "toy-v1", address: "0x401120" } });
    if (!dossier.content?.[0]?.text?.includes("dispatch_request")) throw new Error(`installed MCP evidence query failed: ${JSON.stringify(dossier)}`);
  } finally {
    await client.close();
  }
  console.log(`Package journey passed: ${packageJson.name}@${packageJson.version}, CLI -> DB -> daemon -> MCP -> evidence query, ${result.accepted} records.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
