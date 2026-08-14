import { existsSync } from "node:fs";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { startDaemon } from "./daemon.mjs";
import { startMcp } from "./mcp.mjs";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function startAgent() {
  const config = loadConfig();
  const baseUrl = process.env.HEXWITNESS_URL ?? `http://${config.host}:${config.port}`;
  let daemon = null;
  let mcp = null;
  let stopping = false;

  async function healthy() {
    try {
      const response = await fetch(new URL("/v1/health", baseUrl), { signal: AbortSignal.timeout(750) });
      if (!response.ok) return false;
      const body = await response.json();
      return body?.ok === true && body?.service === "hexwitness-daemon";
    } catch {
      return false;
    }
  }

  async function waitForHealth() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await healthy()) return;
      await delay(50);
    }
    throw new Error(`daemon did not become healthy at ${baseUrl}`);
  }

  async function shutdown(code = 0) {
    if (stopping) return;
    stopping = true;
    try { await mcp?.close(); } catch {}
    try { await daemon?.close(); } catch {}
    process.exitCode = code;
  }

  if (!await healthy()) {
    const url = new URL(baseUrl);
    if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
      throw new Error(`remote HexWitness daemon is unavailable: ${baseUrl}`);
    }
    if (!existsSync(config.evidenceDb)) openEvidenceDb(config.evidenceDb).close();
    daemon = startDaemon(config);
    await waitForHealth();
  }

  mcp = await startMcp();
  process.stdin.once("end", () => { void shutdown(0); });
  process.once("SIGINT", () => { void shutdown(0); });
  process.once("SIGTERM", () => { void shutdown(0); });
  return { baseUrl, shutdown };
}
