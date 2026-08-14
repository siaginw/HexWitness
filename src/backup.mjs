import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openEvidenceDb } from "./db.mjs";
import { ensureParent, nowUtc } from "./util.mjs";
import { hashFileStreaming } from "./file-io.mjs";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function backupEvidenceDb(sourcePath, outputPath) {
  const source = resolve(sourcePath);
  const output = resolve(outputPath);
  if (!existsSync(source)) throw new Error(`evidence database does not exist: ${source}`);
  if (existsSync(output)) throw new Error(`backup destination already exists: ${output}`);
  if (source === output) throw new Error("backup destination must differ from the evidence database");
  ensureParent(output);

  const sourceDb = openEvidenceDb(source, { readOnly: true });
  try { sourceDb.exec(`VACUUM INTO ${sqlString(output)}`); }
  finally { sourceDb.close(); }

  const verification = openEvidenceDb(output, { readOnly: true });
  try {
    const integrity = verification.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrity !== "ok") throw new Error(`backup integrity check failed: ${integrity ?? "unknown"}`);
  } finally { verification.close(); }

  return {
    ok: true,
    source,
    output,
    created_utc: nowUtc(),
    size_bytes: statSync(output).size,
    sha256: hashFileStreaming(output),
    integrity: "ok",
  };
}
