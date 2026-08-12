#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../src/constants.mjs";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const serverJson = JSON.parse(readFileSync(resolve(root, "server.json"), "utf8"));
const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;

if (packageJson.version !== VERSION) throw new Error(`package version ${packageJson.version} does not match runtime ${VERSION}`);
if (packageJson.mcpName !== serverJson.name) throw new Error(`package mcpName ${packageJson.mcpName} does not match server name ${serverJson.name}`);
if (serverJson.version !== VERSION) throw new Error(`server version ${serverJson.version} does not match runtime ${VERSION}`);
const npmPackage = serverJson.packages?.find((entry) => entry.registryType === "npm");
if (!npmPackage || npmPackage.identifier !== packageJson.name || npmPackage.version !== VERSION) {
  throw new Error("server npm package identity does not match package.json");
}
if (JSON.stringify(npmPackage.packageArguments) !== JSON.stringify([{ type: "positional", value: "agent" }])) {
  throw new Error("server package must launch the unified runtime with the agent argument");
}
if (!changelog.includes(`## ${VERSION} `)) throw new Error(`CHANGELOG is missing ${VERSION}`);
if (tag && tag !== `v${VERSION}`) throw new Error(`tag ${tag} does not match v${VERSION}`);
console.log(`Release version contract passed: ${VERSION}${tag ? ` (${tag})` : ""}.`);
