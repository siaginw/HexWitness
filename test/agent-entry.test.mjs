import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function freePort() {
  const server = createServer();
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const port = server.address().port;
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return port;
}

test("agent entrypoint autostarts an empty local daemon and serves MCP", async () => {
  const entry = resolve(import.meta.dirname, "../dist/hexwitness.mjs");
  if (!existsSync(entry)) execFileSync(process.execPath, [resolve(import.meta.dirname, "../scripts/build.mjs")], { stdio: "inherit" });
  const root = mkdtempSync(join(tmpdir(), "hexwitness-agent-"));
  const port = await freePort();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, "agent"],
    env: {
      ...process.env,
      HEXWITNESS_HOME: root,
      HEXWITNESS_PORT: String(port),
      HEXWITNESS_ACTIVITY_LOG: "0",
      HEXWITNESS_AGENT_SESSION: "test-agent",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "hexwitness-agent-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const health = await client.callTool({ name: "hexwitness_health", arguments: {} });
    assert.equal(JSON.parse(health.content[0].text).ok, true);
    const memory = await client.callTool({ name: "hexwitness_memory_status", arguments: {} });
    assert.match(memory.content[0].text, /durable-evidence-first/);
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});
