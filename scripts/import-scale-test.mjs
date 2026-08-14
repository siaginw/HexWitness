#!/usr/bin/env node
import { createWriteStream, mkdtempSync, rmSync, statSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingestFile } from "../src/ingest.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { stats, uuidLookup } from "../src/query.mjs";

function numberOption(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = Number(index >= 0 ? process.argv[index + 1] : fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

const records = numberOption("--records", process.env.HEXWITNESS_SCALE_RECORDS ?? 50_000);
const root = mkdtempSync(join(tmpdir(), "hexwitness-scale-"));
const source = join(root, "large-export.jsonl");
const database = join(root, "evidence.db");
const buildId = "scale-build";

try {
  const output = createWriteStream(source, { encoding: "utf8" });
  const write = async (record) => {
    if (!output.write(`${JSON.stringify(record)}\n`)) await once(output, "drain");
  };
  await write({ format: "hexwitness-jsonl-v1", record: "build", build_id: buildId, label: "Scale fixture" });
  for (let index = 0; index < records; index += 1) {
    await write({
      format: "hexwitness-jsonl-v1", record: "entity", build_id: buildId, kind: index % 5 === 0 ? "field" : "function",
      stable_key: `entity:${index}`, name: `entity_${index}`, address: `0x${(0x1000 + index * 16).toString(16)}`,
      metadata: index % 5 === 0 ? { owner: `type:${index % 100}`, offset: index, uuid: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}` } : {},
    });
  }
  output.end();
  await once(output, "finish");

  const started = performance.now();
  const imported = await ingestFile(database, source);
  const duration = performance.now() - started;
  const db = openEvidenceDb(database, { readOnly: true });
  try {
    const counts = stats(db);
    if (imported.accepted !== records + 1 || counts.entities !== records) throw new Error(`scale import count mismatch: ${JSON.stringify({ imported, counts })}`);
    const probe = uuidLookup(db, { buildId, uuid: "00000000-0000-0000-0000-000000000000" });
    if (probe.length !== 1) throw new Error("indexed UUID probe failed after scale import");
    process.stdout.write(`${JSON.stringify({
      ok: true, entities: records, accepted: imported.accepted, memory_mode: imported.memory_mode,
      duration_ms: Number(duration.toFixed(1)), records_per_second: Number(((records + 1) / (duration / 1000)).toFixed(1)),
      source_bytes: statSync(source).size, database_bytes: statSync(database).size,
      max_rss_bytes: process.resourceUsage().maxRSS * 1024,
    }, null, 2)}\n`);
  } finally { db.close(); }
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
