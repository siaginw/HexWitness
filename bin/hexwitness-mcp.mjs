#!/usr/bin/env node
import { startMcp } from "../src/mcp.mjs";

startMcp().catch((error) => {
  console.error(`hexwitness-mcp: ${error.stack ?? error.message}`);
  process.exit(1);
});
