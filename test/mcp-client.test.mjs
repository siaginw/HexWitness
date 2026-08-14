import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { DaemonClient } from "../src/mcp-client.mjs";

test("daemon client bounds a wedged request", async () => {
  const server = createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const client = new DaemonClient({ baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 25 });
    await assert.rejects(() => client.get("/v1/health"), /timeout|aborted/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
