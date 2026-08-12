#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    if ([".git", "node_modules", ".hexwitness"].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".md")) files.push(path);
  }
}
walk(root);

const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const targets = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) targets.push(match[1]);
  for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) targets.push(match[1]);
  for (let target of targets) {
    target = target.trim().replace(/^<|>$/g, "").split("#", 1)[0].split("?", 1)[0];
    if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
    const decoded = decodeURIComponent(target);
    const resolved = resolve(dirname(file), decoded);
    if (!existsSync(resolved)) failures.push(`${relative(root, file)} -> ${target}`);
  }
}

if (failures.length) {
  console.error("Documentation link check failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Documentation links passed across ${files.length} Markdown files.`);
