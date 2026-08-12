#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const ignored = new Set([".git", "node_modules", ".hexwitness", "dist", "coverage"]);
const forbiddenExtensions = new Set([".exe", ".dll", ".so", ".dylib", ".bndb", ".i64", ".idb", ".gzf", ".pcap", ".pcapng", ".dmp", ".core"]);
const textExtensions = new Set([".md", ".mjs", ".js", ".json", ".py", ".txt", ".yml", ".yaml", ".svg", ".xml", ".toml", ".sh", ".ps1", ""]);
const findings = [];

function walk(path) {
  for (const name of readdirSync(path)) {
    if (ignored.has(name)) continue;
    const full = join(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else inspect(full, stat.size);
  }
}

function inspect(path, size) {
  const rel = relative(root, path).replaceAll("\\", "/");
  const extension = extname(path).toLowerCase();
  if (forbiddenExtensions.has(extension)) findings.push(`${rel}: forbidden binary/capture extension ${extension}`);
  if (size > 2_000_000 && rel !== "package-lock.json") findings.push(`${rel}: unexpectedly large public file (${size} bytes)`);
  if (!textExtensions.has(extension) || rel === "package-lock.json") return;
  const text = readFileSync(path, "utf8");
  const checks = [
    [/github_pat_[A-Za-z0-9_]+/g, "GitHub token"],
    [/ghp_[A-Za-z0-9]{20,}/g, "GitHub token"],
    [/AKIA[0-9A-Z]{16}/g, "AWS access key"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "private key"],
    [/[A-Za-z]:\\Users\\[^\\\s]+/g, "personal absolute path"],
    [/(?:\/Users|\/home)\/[A-Za-z0-9._-]+/g, "personal absolute path"],
    [/[A-Fa-f0-9]{1024,}/g, "large embedded hex payload"],
  ];
  for (const [pattern, label] of checks) if (pattern.test(text)) findings.push(`${rel}: ${label}`);
}

walk(root);
if (findings.length) {
  console.error("Public audit failed:\n" + findings.map((line) => `- ${line}`).join("\n"));
  process.exit(1);
}
console.log("Public audit passed: no obvious secrets, proprietary binaries, captures, or embedded payloads.");
