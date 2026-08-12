import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

export const NATIVE_SKILL_CLIENTS = Object.freeze(["codex", "claude-code", "cursor", "vscode"]);

function stamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }

export function agentPackSource(root, client) {
  const selected = ["claude-desktop", "generic", ...NATIVE_SKILL_CLIENTS].includes(client) ? client : "generic";
  const base = resolve(root, "agent-packs", selected);
  return NATIVE_SKILL_CLIENTS.includes(selected) ? join(base, "hexwitness") : join(base, "hexwitness-agent-instructions.md");
}

export function defaultAgentGuidancePath(client, { home = homedir(), output } = {}) {
  if (client === "codex") return join(home, ".codex", "skills", "hexwitness");
  if (client === "claude-code") return join(home, ".claude", "skills", "hexwitness");
  if (client === "cursor") return join(home, ".cursor", "skills", "hexwitness");
  if (client === "vscode") return join(home, ".copilot", "skills", "hexwitness");
  if (client === "generic" && output) return join(dirname(resolve(output)), "hexwitness-agent-instructions.md");
  return join(home, ".hexwitness", "agent-packs", client, "hexwitness-agent-instructions.md");
}

export function readAgentGuidance(root, client) {
  const source = agentPackSource(root, client);
  const file = NATIVE_SKILL_CLIENTS.includes(client) ? join(source, "SKILL.md") : source;
  return readFileSync(file, "utf8");
}

export function installAgentGuidance(client, root, options = {}) {
  const source = agentPackSource(root, client);
  const target = defaultAgentGuidancePath(client, options);
  if (!existsSync(source)) throw new Error(`agent guidance pack missing for ${client}: ${source}`);
  const kind = NATIVE_SKILL_CLIENTS.includes(client) ? "native-skill" : "mcp-guide";
  if (options.dryRun) return { status: "planned", kind, source, target, backup: null };

  const backupRoot = join(options.home ?? homedir(), ".hexwitness", "backups", "agent-packs", client, stamp());
  const backup = existsSync(target) ? join(backupRoot, basename(target)) : null;
  const building = `${target}.building-${process.pid}`;
  rmSync(building, { recursive: true, force: true });
  try {
    mkdirSync(dirname(building), { recursive: true });
    cpSync(source, building, { recursive: true });
    if (backup) {
      mkdirSync(dirname(backup), { recursive: true });
      cpSync(target, backup, { recursive: true });
    }
    rmSync(target, { recursive: true, force: true });
    renameSync(building, target);
    return { status: "installed", kind, source, target, backup };
  } catch (error) {
    rmSync(building, { recursive: true, force: true });
    if (backup && !existsSync(target)) cpSync(backup, target, { recursive: true });
    throw error;
  }
}
