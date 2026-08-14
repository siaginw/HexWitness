#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { requireUtcTimestamp, sanitizeCaptureFields, summarizeCapturePayload } from "../common/event-safety.mjs";

const FORMAT = "hexwitness-jsonl-v1";

function stableId(prefix, ...parts) {
  const input = parts.map((part) => part ?? "").join("\u001f");
  return `${prefix}_${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

function canonicalAddress(value) {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`unsafe numeric address: ${value}`);
  const text = String(value).trim().toLowerCase().replaceAll("_", "");
  if (/^0[0-9]+$/.test(text) && text !== "0") throw new Error(`ambiguous address requires 0x prefix: ${value}`);
  const parsed = BigInt(text);
  if (parsed < 0n) throw new Error(`negative address: ${value}`);
  return `0x${parsed.toString(16)}`;
}

const [input, output, buildId, captureId] = process.argv.slice(2);
if (!input || !output || !buildId || !captureId) {
  console.error("usage: node normalize.mjs INPUT.jsonl OUTPUT.jsonl BUILD_ID CAPTURE_ID");
  process.exit(2);
}

const out = createWriteStream(output, { encoding: "utf8" });
out.write(`${JSON.stringify({ format: FORMAT, record: "capture", build_id: buildId, capture_id: captureId, scenario: "Frida semantic capture", status: "supporting" })}\n`);
const lines = createInterface({ input: createReadStream(input, { encoding: "utf8" }), crlfDelay: Infinity });
let ordinal = 0;
for await (const line of lines) {
  if (!line.trim()) continue;
  const raw = JSON.parse(line);
  ordinal += 1;
  const address = raw.address ?? raw.rva ?? raw.hook_rva;
  const payload = summarizeCapturePayload(raw);
  const event = {
    format: FORMAT,
    record: "event",
    build_id: buildId,
    capture_id: captureId,
    event_id: stableId("event", captureId, ordinal),
    ordinal,
    ts_utc: requireUtcTimestamp(raw, `event #${ordinal}`),
    source: raw.source ?? "frida-semantic",
    kind: raw.kind ?? raw.event ?? "observation",
    name: raw.name ?? raw.function ?? raw.hook ?? "unnamed",
    direction: raw.direction ?? "local",
    address: address == null ? undefined : canonicalAddress(address),
    thread_id: raw.thread_id == null ? undefined : String(raw.thread_id),
    body_len: raw.body_len ?? payload.body_len,
    body_sha256: raw.body_sha256 ?? payload.body_sha256,
    confidence: raw.confidence ?? 1,
    action_id: raw.action_id ?? raw.marker,
    summary: raw.summary,
    fields: sanitizeCaptureFields(raw.fields ?? raw.args ?? raw),
  };
  out.write(`${JSON.stringify(event)}\n`);
}
out.end();
