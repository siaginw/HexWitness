import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function ensureParent(path) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function stableId(prefix, ...parts) {
  return `${prefix}_${sha256(parts.map((part) => part ?? "").join("\u001f")).slice(0, 24)}`;
}

export function newId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function json(value) {
  return JSON.stringify(value ?? {});
}

export function parseJson(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function canonicalAddress(value) {
  if (value == null || value === "") return null;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`unsafe numeric address: ${value}`);
    return `0x${value.toString(16)}`;
  }
  const text = String(value).trim().toLowerCase().replaceAll("_", "");
  const parsed = text.startsWith("0x") ? BigInt(text) : BigInt(text);
  if (parsed < 0n) throw new Error(`negative address: ${value}`);
  return `0x${parsed.toString(16)}`;
}

export function nowUtc() {
  return new Date().toISOString();
}

export function clampConfidence(value) {
  const number = Number(value ?? 0.5);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

export function publicRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (key.endsWith("_json")) {
      const plain = key.slice(0, -5);
      out[plain] = parseJson(out[key], key === "tags_json" ? [] : {});
      delete out[key];
    }
  }
  return out;
}
