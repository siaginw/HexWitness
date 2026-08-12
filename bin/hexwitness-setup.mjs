#!/usr/bin/env node
import { formatSetupSummary, runSetup } from "../src/setup.mjs";

runSetup().then((result) => {
  process.stdout.write(`${process.argv.includes("--json") ? JSON.stringify(result, null, 2) : formatSetupSummary(result)}\n`);
}).catch((error) => {
  console.error(`hexwitness-setup: ${error.message}`);
  process.exitCode = 1;
});
