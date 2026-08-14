import { createHash } from "node:crypto";

export const SENSITIVE_KEYS = /(^|_)(api_?key|auth|authorization|bearer|cookie|credential|jwt|password|secret|session_?key|steam_?ticket|ticket|token)($|_)/i;
export const PAYLOAD_KEYS = /^(body|buffer|bytes|data|frame|packet|payload|raw|wire)$/i;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function sanitizeCaptureValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeCaptureValue(item));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(key) || PAYLOAD_KEYS.test(key)) continue;
    output[key] = sanitizeCaptureValue(nested);
  }
  return output;
}

export function sanitizeCaptureFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return sanitizeCaptureValue(input);
}

export function summarizeCapturePayload(raw) {
  for (const key of Object.keys(raw)) {
    if (!PAYLOAD_KEYS.test(key) || raw[key] == null) continue;
    const value = typeof raw[key] === "string" ? raw[key] : JSON.stringify(raw[key]);
    return { body_len: Buffer.byteLength(value), body_sha256: sha256(value) };
  }
  return {};
}

export function requireUtcTimestamp(raw, label = "event") {
  const timestamp = raw.ts_utc ?? raw.timestamp ?? raw.time;
  if (typeof timestamp !== "string" || !timestamp.endsWith("Z") || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${label} requires an ISO-8601 UTC timestamp ending in Z`);
  }
  return timestamp;
}
