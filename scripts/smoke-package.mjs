#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const installedRoot = join(app, "node_modules", "hexwitness");
  const packageJson = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  if (Object.keys(packageJson.bin ?? {}).join(",") !== "hexwitness") throw new Error(`installed package should expose one executable: ${JSON.stringify(packageJson.bin)}`);
  if (Object.keys(packageJson.dependencies ?? {}).length) throw new Error(`bundled package should not install runtime dependencies: ${JSON.stringify(packageJson.dependencies)}`);
  for (const internal of ["src", "bin", "scripts", "test"]) {
    if (existsSync(join(installedRoot, internal))) throw new Error(`installed package exposes internal directory: ${internal}`);
  }
  const cli = join(installedRoot, packageJson.bin.hexwitness);
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
  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  if (version.status !== 0 || version.stdout.trim() !== packageJson.version) throw new Error(`installed version mismatch: ${version.stdout || version.stderr}`);
  const adapters = spawnSync(process.execPath, [cli, "adapters"], { encoding: "utf8" });
  if (adapters.status !== 0 || JSON.parse(adapters.stdout).adapters.length < 5) throw new Error(`installed adapters are not discoverable: ${adapters.stderr || adapters.stdout}`);
  const fridaInput = join(scratch, "frida.jsonl");
  const fridaOutput = join(scratch, "frida-normalized.jsonl");
  writeFileSync(fridaInput, `${JSON.stringify({ ts_utc: "2026-01-01T00:00:00.000Z", name: "fixture", packet: "private", fields: { safe: true } })}\n`);
  const frida = spawnSync(process.execPath, [join(installedRoot, "adapters", "frida-jsonl", "normalize.mjs"), fridaInput, fridaOutput, "build", "capture"], { encoding: "utf8" });
  if (frida.status !== 0 || !readFileSync(fridaOutput, "utf8").includes('"safe":true')) throw new Error(`installed Frida normalizer failed: ${frida.stderr || frida.stdout}`);
  const setup = spawnSync(process.execPath, [cli, "setup",
    "--client", "codex,claude-code,cursor,vscode,claude-desktop,generic", "--viewer", "none", "--output", join(scratch, "mcp.json"), "--dry-run", "--yes", "--json"], { encoding: "utf8" });
  if (setup.status !== 0) throw new Error(setup.stderr || setup.stdout || "installed setup wizard failed");
  const setupResult = JSON.parse(setup.stdout);
  if (setupResult.results.length !== 6 || setupResult.results.some((entry) => entry.guidance.status !== "planned")) throw new Error(`unexpected setup plan: ${setup.stdout}`);
  const port = await freePort();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, "agent"],
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
