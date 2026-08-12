#!/usr/bin/env node
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "dist");
const output = resolve(outputDirectory, "hexwitness.mjs");

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(root, "src", "cli.mjs")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none",
  sourcemap: false,
  treeShaking: true,
  logLevel: "info",
});

chmodSync(output, 0o755);
