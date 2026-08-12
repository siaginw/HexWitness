#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION } from "../src/constants.mjs";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
const tag = process.env.GITHUB_REF_NAME;

if (packageJson.version !== VERSION) throw new Error(`package version ${packageJson.version} does not match runtime ${VERSION}`);
if (!changelog.includes(`## ${VERSION} `)) throw new Error(`CHANGELOG is missing ${VERSION}`);
if (tag && tag !== `v${VERSION}`) throw new Error(`tag ${tag} does not match v${VERSION}`);
console.log(`Release version contract passed: ${VERSION}${tag ? ` (${tag})` : ""}.`);
