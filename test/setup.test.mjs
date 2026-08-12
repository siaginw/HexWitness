import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildServerDefinitions, defaultClientPath, mergeMcpJson } from "../src/setup.mjs";

test("setup definitions combine autostart memory and optional live viewers", () => {
  const servers = buildServerDefinitions({
    agentEntry: "./bin/hexwitness-agent.mjs",
    session: "fixture",
    client: "codex",
    viewer: "both",
    idaDirectory: "./ida-pro-mcp",
  });
  assert.equal(servers.hexwitness.command, process.execPath);
  assert.equal(servers.hexwitness.args[0], resolve("./bin/hexwitness-agent.mjs"));
  assert.equal(servers.hexwitness.env.HEXWITNESS_AGENT_SESSION, "fixture");
  assert.equal(servers.hexwitness.env.HEXWITNESS_AGENT_CLIENT, "codex");
  assert.equal(servers.binary_ninja_live.url, "http://127.0.0.1:9090/mcp");
  assert.match(servers.ida_live.args.join(" "), /idalib-mcp --stdio/);
});

test("setup JSON merge preserves existing servers and creates a backup", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-setup-"));
  const path = join(root, "mcp.json");
  try {
    writeFileSync(path, JSON.stringify({ mcpServers: { existing: { command: "existing" } }, untouched: true }));
    const result = mergeMcpJson(path, { hexwitness: { command: "node", args: ["agent.mjs"] } });
    const merged = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(merged.untouched, true);
    assert.equal(merged.mcpServers.existing.command, "existing");
    assert.equal(merged.mcpServers.hexwitness.command, "node");
    assert.equal(existsSync(result.backup), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("setup JSON merge refuses to replace a server without force", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-setup-collision-"));
  const path = join(root, "mcp.json");
  try {
    writeFileSync(path, JSON.stringify({ mcpServers: { hexwitness: { command: "old" } } }));
    assert.throws(() => mergeMcpJson(path, { hexwitness: { command: "new" } }), /--force/);
    mergeMcpJson(path, { hexwitness: { command: "new" } }, { force: true });
    assert.equal(JSON.parse(readFileSync(path, "utf8")).mcpServers.hexwitness.command, "new");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("client config paths are deterministic", () => {
  assert.equal(defaultClientPath("cursor", { home: "/srv/test", os: "linux", env: {} }), join("/srv/test", ".cursor", "mcp.json"));
  assert.equal(defaultClientPath("claude-desktop", { home: "C:/Profiles/Test", os: "win32", env: { APPDATA: "C:/Profiles/Test/AppData/Roaming" } }), join("C:/Profiles/Test/AppData/Roaming", "Claude", "claude_desktop_config.json"));
});
