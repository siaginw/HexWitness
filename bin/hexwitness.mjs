#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { openEvidenceDb } from "../src/db.mjs";
import { doctor } from "../src/doctor.mjs";
import { ingestFile } from "../src/ingest.mjs";
import { contradictions, explain, search, stats } from "../src/query.mjs";
import { gapReport } from "../src/query.mjs";
import { startDaemon } from "../src/daemon.mjs";
import { dumpGuide } from "../src/guides.mjs";
import { addCaptureArtifact, addCaptureMarker, initCapturePack, inspectCapturePack, normalizeCapturePack, sealCapturePack, verifyCapturePack } from "../src/capture-pack.mjs";
import { analysisSlices, captureDetail, captureGraph, captureSearch, captureTimeline, classDetail, compareBuilds, compareCaptures, coverage, dataflow, decompSearch, edgeKinds, evidenceFor, fieldOffsets, functionInventory, gapWorklist, genericQuery, listBuilds, listCaptures, memoryStatus, metadataLookup, neighbors, objectModel, reachable, shortestPath, typeRegistry, uuidLookup, vtableDetail, xrefs } from "../src/query.mjs";

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
  hexwitness query [TEXT] [--build BUILD] [--kinds function,class] [--edge-kinds call,reads]
  hexwitness serve [--db PATH] [--host HOST] [--port PORT]
  hexwitness search QUERY [--build BUILD] [--kind KIND]
  hexwitness builds
  hexwitness memory
  hexwitness explain ADDRESS [--build BUILD]
  hexwitness gaps ADDRESS [--build BUILD] [--objective behavior]
  hexwitness guide [identity|control_flow|data_flow|object_model|protocol|runtime|behavior]
  hexwitness contradictions [--build BUILD]
  hexwitness functions [TEXT] --build BUILD
  hexwitness classes [TEXT] --build BUILD
  hexwitness class NAME [--build BUILD]
  hexwitness uuid UUID [--build BUILD]
  hexwitness types [TEXT] --build BUILD
  hexwitness offsets [TEXT] --build BUILD [--owner CLASS]
  hexwitness metadata QUERY [--build BUILD] [--kinds asset,codec]
  hexwitness decomp-search QUERY --build BUILD
  hexwitness path FROM_ADDRESS TO_ADDRESS --build BUILD [--kind call]
  hexwitness edge-kinds [--build BUILD]
  hexwitness compare-builds LEFT_BUILD RIGHT_BUILD
  hexwitness reach ADDRESS [--build BUILD] [--direction outgoing] [--depth 3]
  hexwitness dataflow ADDRESS [--build BUILD]
  hexwitness callers|callees|xrefs|vtable|slices ADDRESS [--build BUILD]
  hexwitness evidence [--build BUILD] [--source SOURCE]
  hexwitness worklist [--build BUILD] [--status open]
  hexwitness coverage [--build BUILD]
  hexwitness captures [--build BUILD]
  hexwitness capture-detail CAPTURE_ID
  hexwitness capture-timeline CAPTURE_ID
  hexwitness capture-search QUERY [--capture CAPTURE_ID]
  hexwitness capture-graph CAPTURE_ID
  hexwitness capture-compare LEFT_ID RIGHT_ID
  hexwitness capture init DIR --scenario NAME --build BUILD [--sha SHA256] [--spec scenario.json]
  hexwitness capture add DIR FILE --role ROLE
  hexwitness capture mark DIR NAME [--note TEXT]
  hexwitness capture normalize|inspect|verify DIR
  hexwitness capture seal DIR [--allow-incomplete]
  hexwitness capture import DIR [--db PATH]
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
    case "query": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(genericQuery(db, { buildId: option(args, "--build"), q: args[1] ?? "", kinds: (option(args, "--kinds", "") ?? "").split(",").filter(Boolean), edgeKinds: (option(args, "--edge-kinds", "") ?? "").split(",").filter(Boolean), limit: option(args, "--limit") })); db.close(); break;
    }
    case "serve": startDaemon(config); break;
    case "search": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      print(search(db, { q: args[1] ?? "", buildId: option(args, "--build"), kind: option(args, "--kind") })); db.close(); break;
    }
    case "builds": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(listBuilds(db)); db.close(); break; }
    case "memory": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(memoryStatus(db)); db.close(); break; }
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
    case "functions": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(functionInventory(db, { buildId: option(args, "--build"), q: args[1] ?? "", limit: option(args, "--limit") })); db.close(); break;
    }
    case "classes": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(objectModel(db, { buildId: option(args, "--build"), q: args[1] ?? "", limit: option(args, "--limit") })); db.close(); break;
    }
    case "class": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(classDetail(db, { buildId: option(args, "--build"), name: args[1] })); db.close(); break;
    }
    case "uuid": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(uuidLookup(db, { buildId: option(args, "--build"), uuid: args[1], limit: option(args, "--limit") })); db.close(); break;
    }
    case "types": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(typeRegistry(db, { buildId: option(args, "--build"), q: args[1] ?? "", kind: option(args, "--kind"), limit: option(args, "--limit") })); db.close(); break;
    }
    case "offsets": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(fieldOffsets(db, { buildId: option(args, "--build"), owner: option(args, "--owner", ""), q: args[1] ?? "", limit: option(args, "--limit") })); db.close(); break; }
    case "metadata": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(metadataLookup(db, { buildId: option(args, "--build"), q: args[1], kinds: (option(args, "--kinds", "") ?? "").split(",").filter(Boolean), limit: option(args, "--limit") })); db.close(); break; }
    case "decomp-search": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(decompSearch(db, { buildId: option(args, "--build"), q: args[1], kind: option(args, "--kind"), limit: option(args, "--limit") })); db.close(); break; }
    case "path": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(shortestPath(db, { buildId: option(args, "--build"), address: args[1] }, { buildId: option(args, "--build"), address: args[2] }, { kind: option(args, "--kind"), direction: option(args, "--direction", "outgoing"), depth: option(args, "--depth") })); db.close(); break; }
    case "edge-kinds": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(edgeKinds(db, { buildId: option(args, "--build") })); db.close(); break; }
    case "compare-builds": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(compareBuilds(db, args[1], args[2], { limit: option(args, "--limit") })); db.close(); break; }
    case "reach": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(reachable(db, { buildId: option(args, "--build"), address: args[1] }, { direction: option(args, "--direction", "outgoing"), kind: option(args, "--kind"), depth: option(args, "--depth"), limit: option(args, "--limit") })); db.close(); break;
    }
    case "dataflow": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(dataflow(db, { buildId: option(args, "--build"), address: args[1] }, { direction: option(args, "--direction", "both"), depth: option(args, "--depth"), limit: option(args, "--limit") })); db.close(); break;
    }
    case "callers": case "callees": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(neighbors(db, { buildId: option(args, "--build"), address: args[1] }, command === "callers" ? "incoming" : "outgoing", "call", option(args, "--limit"))); db.close(); break;
    }
    case "xrefs": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(xrefs(db, { buildId: option(args, "--build"), address: args[1] }, option(args, "--limit"))); db.close(); break; }
    case "vtable": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(vtableDetail(db, { buildId: option(args, "--build"), address: args[1] }, option(args, "--limit"))); db.close(); break; }
    case "slices": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(analysisSlices(db, { buildId: option(args, "--build"), address: args[1] }, { kind: option(args, "--kind"), limit: option(args, "--limit") })); db.close(); break; }
    case "evidence": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(evidenceFor(db, { buildId: option(args, "--build"), source: option(args, "--source"), classification: option(args, "--classification"), limit: option(args, "--limit") })); db.close(); break; }
    case "worklist": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(gapWorklist(db, { buildId: option(args, "--build"), captureId: option(args, "--capture"), status: option(args, "--status", "open"), limit: option(args, "--limit") })); db.close(); break; }
    case "coverage": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(coverage(db, { buildId: option(args, "--build") })); db.close(); break;
    }
    case "captures": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(listCaptures(db, { buildId: option(args, "--build"), scenario: option(args, "--scenario"), status: option(args, "--status"), limit: option(args, "--limit") })); db.close(); break;
    }
    case "capture-detail": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(captureDetail(db, args[1])); db.close(); break;
    }
    case "capture-timeline": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(captureTimeline(db, args[1], { after: option(args, "--after"), source: option(args, "--source"), kind: option(args, "--kind"), name: option(args, "--name"), limit: option(args, "--limit") })); db.close(); break;
    }
    case "capture-compare": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(compareCaptures(db, args[1], args[2])); db.close(); break;
    }
    case "capture-search": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(captureSearch(db, { q: args[1] ?? "", captureId: option(args, "--capture"), direction: option(args, "--direction"), kind: option(args, "--kind"), limit: option(args, "--limit") })); db.close(); break; }
    case "capture-graph": { const db = openEvidenceDb(config.evidenceDb, { readOnly: true }); print(captureGraph(db, args[1], { kind: option(args, "--kind"), limit: option(args, "--limit") })); db.close(); break; }
    case "capture": {
      const action = args[1]; const root = args[2];
      if (!action || !root) throw new Error("capture requires ACTION and DIR");
      if (action === "init") {
        const specPath = option(args, "--spec");
        print(initCapturePack(root, { scenario: option(args, "--scenario"), title: option(args, "--title"), buildId: option(args, "--build"), executableSha256: option(args, "--sha"), requiredRoles: option(args, "--required")?.split(",").filter(Boolean), requiredMarkers: option(args, "--markers")?.split(",").filter(Boolean), scenarioSpec: specPath ? JSON.parse(readFileSync(resolve(specPath), "utf8")) : null }));
      }
      else if (action === "add") { if (!args[3]) throw new Error("capture add requires FILE"); print(addCaptureArtifact(root, args[3], option(args, "--role"), { description: option(args, "--description") })); }
      else if (action === "mark") print(addCaptureMarker(root, args[3], option(args, "--note")));
      else if (action === "normalize") print(normalizeCapturePack(root));
      else if (action === "seal") print(sealCapturePack(root, { allowIncomplete: args.includes("--allow-incomplete") }));
      else if (action === "verify") print(verifyCapturePack(root));
      else if (action === "inspect") print(inspectCapturePack(root));
      else if (action === "import") { const normalized = resolve(root, "normalized/evidence.hexwitness.jsonl"); if (!existsSync(normalized)) normalizeCapturePack(root); print(await ingestFile(config.evidenceDb, normalized)); }
      else throw new Error(`unknown capture action: ${action}`);
      break;
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
