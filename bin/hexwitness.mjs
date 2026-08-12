#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { doctor } from "../src/doctor.mjs";
import { ingestFile } from "../src/ingest.mjs";
import { contradictions, explain, search, stats } from "../src/query.mjs";
import { gapReport } from "../src/query.mjs";
import { startDaemon } from "../src/daemon.mjs";
import { dumpGuide } from "../src/guides.mjs";

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

function help() {
  console.log(`HexWitness — evidence-first reverse engineering

Usage:
  hexwitness init [--db PATH]
  hexwitness ingest FILE [--db PATH]
  hexwitness serve [--db PATH] [--host HOST] [--port PORT]
  hexwitness search QUERY [--build BUILD] [--kind KIND]
  hexwitness explain ADDRESS [--build BUILD]
  hexwitness gaps ADDRESS [--build BUILD] [--objective behavior]
  hexwitness guide [identity|control_flow|data_flow|object_model|protocol|runtime|behavior]
  hexwitness contradictions [--build BUILD]
  hexwitness stats
  hexwitness doctor
  hexwitness demo [--reset]

Environment: HEXWITNESS_HOME, HEXWITNESS_DB, HEXWITNESS_HOST,
HEXWITNESS_PORT, HEXWITNESS_API_TOKEN, HEXWITNESS_ACTIVITY_RETENTION_DAYS.`);
}

const args = process.argv.slice(2);
const command = args[0];
const config = loadConfig({ evidenceDb: option(args, "--db") ?? undefined, host: option(args, "--host") ?? undefined, port: option(args, "--port") ?? undefined });

try {
  switch (command) {
    case "init": {
      const db = openEvidenceDb(config.evidenceDb); db.close();
      print({ ok: true, database: config.evidenceDb }); break;
    }
    case "ingest": {
      if (!args[1]) throw new Error("ingest requires a JSONL file");
      print(await ingestFile(config.evidenceDb, args[1])); break;
    }
    case "serve": startDaemon(config); break;
    case "search": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(search(db, { q: args[1] ?? "", buildId: option(args, "--build"), kind: option(args, "--kind") })); db.close(); break;
    }
    case "explain": {
      if (!args[1]) throw new Error("explain requires an address");
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(explain(db, { address: args[1], buildId: option(args, "--build") })); db.close(); break;
    }
    case "gaps": {
      if (!args[1]) throw new Error("gaps requires an address");
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(gapReport(db, { address: args[1], buildId: option(args, "--build") }, option(args, "--objective", "behavior"))); db.close(); break;
    }
    case "guide": print(dumpGuide(args[1] ?? "behavior")); break;
    case "contradictions": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(contradictions(db, { buildId: option(args, "--build") })); db.close(); break;
    }
    case "stats": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(stats(db)); db.close(); break;
    }
    case "doctor": print(doctor(config)); break;
    case "demo": {
      const example = resolve(import.meta.dirname, "../examples/toy-binary/evidence.jsonl");
      if (args.includes("--reset") && existsSync(config.evidenceDb)) rmSync(config.evidenceDb);
      openEvidenceDb(config.evidenceDb).close();
      print(await ingestFile(config.evidenceDb, example));
      console.error(`Try: hexwitness explain 0x401120 --build toy-v1`);
      break;
    }
    case "help": case "--help": case "-h": case undefined: help(); break;
    default: throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  console.error(`hexwitness: ${error.message}`);
  process.exitCode = 1;
}
