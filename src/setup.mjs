import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { installAgentGuidance } from "./agent-guidance.mjs";

export const SUPPORTED_CLIENTS = Object.freeze(["codex", "claude-code", "cursor", "vscode", "claude-desktop", "generic"]);
export const SUPPORTED_VIEWERS = Object.freeze(["none", "binary-ninja", "ida", "both"]);
export const BINARY_NINJA_MCP_URL = "http://127.0.0.1:24642/mcp";

function timestamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }

function localViewerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`invalid Binary Ninja MCP URL: ${value}`); }
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("Binary Ninja MCP URL must use HTTP(S) on localhost");
  }
  return url.href.replace(/\/$/, "");
}

export function buildServerDefinitions({ cliEntry, session = "hexwitness-project", client = "generic", viewer = "none", binaryNinjaUrl = BINARY_NINJA_MCP_URL, idaDirectory = "C:/tools/ida-pro-mcp" }) {
  const servers = {
    hexwitness: {
      command: process.execPath,
      args: [resolve(cliEntry), "agent"],
      env: { HEXWITNESS_AGENT_SESSION: session, HEXWITNESS_AGENT_CLIENT: client },
    },
  };
  if (["binary-ninja", "both"].includes(viewer)) servers.binary_ninja_live = { url: localViewerUrl(binaryNinjaUrl) };
  if (["ida", "both"].includes(viewer)) servers.ida_live = {
    command: "uv",
    args: ["run", "--directory", resolve(idaDirectory), "idalib-mcp", "--stdio"],
  };
  return servers;
}

export function mergeMcpJson(path, servers, { dryRun = false, force = false } = {}) {
  const target = resolve(path);
  let document = {};
  let backup = null;
  if (existsSync(target)) {
    document = JSON.parse(readFileSync(target, "utf8"));
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error(`MCP config must be a JSON object: ${target}`);
  const collisions = Object.keys(servers).filter((name) => document.mcpServers?.[name]);
  if (collisions.length && !force) throw new Error(`MCP config already has ${collisions.join(", ")}; rerun with --force to replace ${collisions.length === 1 ? "it" : "them"}`);
  document.mcpServers = { ...(document.mcpServers ?? {}), ...servers };
  if (!dryRun) {
    if (existsSync(target)) {
      backup = `${target}.hexwitness-backup-${timestamp()}`;
      copyFileSync(target, backup);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  }
  return { target, backup, document };
}

export function defaultClientPath(client, { home = homedir(), env = process.env, os = platform() } = {}) {
  if (client === "cursor") return join(home, ".cursor", "mcp.json");
  if (client === "claude-desktop") {
    if (os === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    if (os === "darwin") return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  return null;
}

function nativeCommand(client, name, server) {
  if (client === "codex") {
    if (server.url) return ["codex", ["mcp", "add", name, "--url", server.url]];
    const env = Object.entries(server.env ?? {}).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
    return ["codex", ["mcp", "add", name, ...env, "--", server.command, ...server.args]];
  }
  if (client === "claude-code") {
    if (server.url) return ["claude", ["mcp", "add", "--scope", "user", "--transport", "http", name, server.url]];
    const env = Object.entries(server.env ?? {}).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
    return ["claude", ["mcp", "add", "--scope", "user", name, ...env, "--", server.command, ...server.args]];
  }
  if (client === "vscode") {
    const definition = server.url ? { name, type: "http", url: server.url } : { name, type: "stdio", ...server };
    return ["code", ["--add-mcp", JSON.stringify(definition)]];
  }
  return null;
}

function commandExists(command) {
  const probe = spawnSync(command, ["--version"], { encoding: "utf8", windowsHide: true });
  return !probe.error;
}

function runNative(client, servers, { dryRun = false, force = false } = {}) {
  const results = [];
  for (const [name, server] of Object.entries(servers)) {
    const [command, args] = nativeCommand(client, name, server);
    if (dryRun) { results.push({ name, command, args, status: "planned" }); continue; }
    if (!commandExists(command)) throw new Error(`${command} CLI is not installed or not on PATH`);
    const getArgs = client === "vscode" ? null : ["mcp", "get", name];
    const exists = getArgs ? spawnSync(command, getArgs, { encoding: "utf8", windowsHide: true }).status === 0 : false;
    if (exists && !force) throw new Error(`${client} already has MCP server '${name}'; rerun with --force to replace it`);
    if (exists && force && !dryRun) spawnSync(command, ["mcp", "remove", name], { encoding: "utf8", windowsHide: true });
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`${command} failed for ${name}: ${(result.stderr || result.stdout || result.error?.message).trim()}`);
    results.push({ name, command, args, status: "installed" });
  }
  return results;
}

function parseOptions(args) {
  const option = (name, fallback = null) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
  return {
    clients: option("--client")?.split(",").map((item) => item.trim()).filter(Boolean),
    viewer: option("--viewer"),
    binaryNinjaUrl: option("--binary-ninja-url", BINARY_NINJA_MCP_URL),
    idaDirectory: option("--ida-dir", "C:/tools/ida-pro-mcp"),
    session: option("--session", "hexwitness-project"),
    output: option("--output"),
    yes: args.includes("--yes"),
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    json: args.includes("--json"),
  };
}

async function choose(rl, title, values, multiple = false) {
  output.write(`\n${title}\n`);
  values.forEach((value, index) => output.write(`  ${index + 1}) ${value}\n`));
  const answer = await rl.question(multiple ? "Choose one or more numbers (comma-separated): " : "Choose a number: ");
  const indexes = answer.split(",").map((value) => Number(value.trim()) - 1);
  const selected = indexes.map((index) => values[index]).filter(Boolean);
  if (!selected.length || (!multiple && selected.length !== 1)) throw new Error("invalid selection");
  return multiple ? selected : selected[0];
}

export async function runSetup(args = process.argv.slice(2), dependencies = {}) {
  const options = parseOptions(args);
  if (options.json && (!options.clients || !options.viewer)) throw new Error("--json requires --client and --viewer so setup remains non-interactive");
  const rl = dependencies.readline ?? createInterface({ input, output });
  const ownsReadline = !dependencies.readline;
  try {
    const clients = options.clients ?? await choose(rl, "Install HexWitness for which AI clients?", SUPPORTED_CLIENTS, true);
    const viewer = options.viewer ?? await choose(rl, "Add an optional live reverse-engineering viewer?", SUPPORTED_VIEWERS);
    for (const client of clients) if (!SUPPORTED_CLIENTS.includes(client)) throw new Error(`unsupported client: ${client}`);
    if (!SUPPORTED_VIEWERS.includes(viewer)) throw new Error(`unsupported viewer: ${viewer}`);
    const root = resolve(import.meta.dirname, "..");
    const cliEntry = resolve(root, "dist", "hexwitness.mjs");
    const serverNames = new Set(["hexwitness"]);
    if (["binary-ninja", "both"].includes(viewer)) serverNames.add("binary_ninja_live");
    if (["ida", "both"].includes(viewer)) serverNames.add("ida_live");
    if (!options.json) output.write(`\nHexWitness setup plan\n  clients: ${clients.join(", ")}\n  viewer: ${viewer}\n  MCP servers: ${[...serverNames].join(", ")}\n  agent guidance: tailored skill or MCP guide for every selected client\n`);
    if (!options.yes && !options.dryRun && !options.json) {
      const confirmed = (await rl.question("Apply this plan? [y/N] ")).trim().toLowerCase();
      if (!["y", "yes"].includes(confirmed)) return { status: "cancelled", clients, viewer };
    }
    const results = [];
    for (const client of clients) {
      const servers = buildServerDefinitions({ cliEntry, session: options.session, client, viewer, binaryNinjaUrl: options.binaryNinjaUrl, idaDirectory: options.idaDirectory });
      let mcp;
      if (["codex", "claude-code", "vscode"].includes(client)) {
        mcp = { method: "native-cli", entries: runNative(client, servers, options) };
      } else if (["cursor", "claude-desktop"].includes(client)) {
        mcp = { method: "json-merge", ...mergeMcpJson(defaultClientPath(client), servers, options) };
      } else {
        const target = options.output ? resolve(options.output) : resolve("hexwitness.mcp.json");
        mcp = { method: "json-merge", ...mergeMcpJson(target, servers, options) };
      }
      const guidance = installAgentGuidance(client, root, { ...options, output: client === "generic" ? options.output : undefined });
      results.push({ client, mcp, guidance });
    }
    const notes = [];
    if (["binary-ninja", "both"].includes(viewer)) notes.push(`Enable Binary Ninja's official MCP server, start it from Plugins > MCP, and confirm its connection URL (configured: ${options.binaryNinjaUrl}).`);
    if (["ida", "both"].includes(viewer)) notes.push(`Install the Hex-Rays-endorsed mrexodia/ida-pro-mcp bridge with idalib activated; expected source directory: ${resolve(options.idaDirectory)}.`);
    return { status: options.dryRun ? "planned" : "installed", clients, viewer, servers: [...serverNames], results, notes };
  } finally { if (ownsReadline) rl.close(); }
}

export function formatSetupSummary(result) {
  if (result.status === "cancelled") return "HexWitness setup cancelled.";
  const action = result.status === "planned" ? "Setup plan ready" : "HexWitness is ready";
  const lines = [action, `  AI clients: ${result.clients.join(", ")}`, `  MCP servers: ${result.servers.join(", ")}`];
  for (const entry of result.results ?? []) lines.push(`  ${entry.client} guidance: ${entry.guidance.kind} -> ${entry.guidance.target}`);
  for (const note of result.notes ?? []) lines.push(`  Next: ${note}`);
  if (result.status === "installed") lines.push("  Restart the configured AI client, then ask it to use HexWitness.");
  return lines.join("\n");
}
