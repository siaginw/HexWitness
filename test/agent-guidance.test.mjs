import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { defaultAgentGuidancePath, installAgentGuidance, NATIVE_SKILL_CLIENTS, readAgentGuidance } from "../src/agent-guidance.mjs";

const project = resolve(import.meta.dirname, "..");

test("every supported native agent receives its own skill pack", () => {
  const home = "/profiles/test";
  const expected = {
    codex: join(home, ".codex", "skills", "hexwitness"),
    "claude-code": join(home, ".claude", "skills", "hexwitness"),
    cursor: join(home, ".cursor", "skills", "hexwitness"),
    vscode: join(home, ".copilot", "skills", "hexwitness"),
  };
  for (const client of NATIVE_SKILL_CLIENTS) {
    assert.equal(defaultAgentGuidancePath(client, { home }), expected[client]);
    const guidance = readAgentGuidance(project, client);
    assert.match(guidance, /^---\r?\nname: hexwitness/m);
    assert.match(guidance, /evidence/i);
    assert.match(guidance, /hexwitness agent/);
    assert.match(guidance, /hexwitness adapters \[ID\]/);
    assert.match(guidance, /hexwitness_contract/);
    assert.match(guidance, /hexwitness_investigation_create/);
    assert.match(guidance, /hexwitness_failed_attempts/);
    assert.match(guidance, /hexwitness_evidence_challenge/);
    assert.match(guidance, /hexwitness_run_local_tool/);
    assert.match(guidance, /Never depend on package-internal/);
  }
});

test("Codex skill metadata declares the HexWitness MCP dependency", () => {
  const metadata = readFileSync(join(project, "agent-packs", "codex", "hexwitness", "agents", "openai.yaml"), "utf8");
  assert.match(metadata, /default_prompt: "Use \$hexwitness/);
  assert.match(metadata, /type: "mcp"/);
  assert.match(metadata, /value: "hexwitness"/);
});

test("agent guidance installation backs up an existing tailored skill", () => {
  const home = mkdtempSync(join(tmpdir(), "hexwitness-guidance-"));
  try {
    const first = installAgentGuidance("codex", project, { home });
    assert.equal(first.status, "installed");
    assert.equal(existsSync(join(first.target, "SKILL.md")), true);
    writeFileSync(join(first.target, "local-note.txt"), "preserve me");
    const second = installAgentGuidance("codex", project, { home });
    assert.equal(existsSync(join(second.backup, "local-note.txt")), true);
    assert.equal(readFileSync(join(second.backup, "local-note.txt"), "utf8"), "preserve me");
    assert.equal(existsSync(join(second.target, "local-note.txt")), false);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("generic clients receive a portable guide beside their MCP config", () => {
  const root = mkdtempSync(join(tmpdir(), "hexwitness-generic-guide-"));
  try {
    const output = join(root, "team.mcp.json");
    const result = installAgentGuidance("generic", project, { home: root, output });
    assert.equal(result.target, join(root, "hexwitness-agent-instructions.md"));
    assert.match(readFileSync(result.target, "utf8"), /Drive reverse-engineering investigations/);
    assert.match(readFileSync(result.target, "utf8"), /hexwitness agent/);
    assert.match(readFileSync(result.target, "utf8"), /hexwitness adapters \[ID\]/);
    assert.match(readFileSync(result.target, "utf8"), /hexwitness_investigation_create/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
