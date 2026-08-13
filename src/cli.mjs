#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { doctor } from "./doctor.mjs";
import { ingestFile } from "./ingest.mjs";
import { contradictions, explain, search, stats } from "./query.mjs";
import { gapReport } from "./query.mjs";
import { startDaemon } from "./daemon.mjs";
import { dumpGuide } from "./guides.mjs";
import { addCaptureArtifact, addCaptureMarker, initCapturePack, inspectCapturePack, normalizeCapturePack, sealCapturePack, verifyCapturePack } from "./capture-pack.mjs";
import { packCaptureDirectory } from "./capture-bundle.mjs";
import { formatSetupSummary, runSetup } from "./setup.mjs";
import { VERSION } from "./constants.mjs";
import { startAgent } from "./agent.mjs";
import { startMcp } from "./mcp.mjs";
import { adapterCatalog, adapterDetail, adapterDiagnostics } from "./adapters.mjs";
import { publicContract } from "./contract.mjs";
import { backupEvidenceDb } from "./backup.mjs";
import { analysisSlices, captureDetail, captureGraph, captureSearch, captureTimeline, classDetail, compareBuilds, compareCaptures, coverage, dataflow, decompSearch, edgeKinds, evidenceFor, fieldOffsets, functionInventory, gapWorklist, genericQuery, listBuilds, listCaptures, memoryStatus, metadataLookup, neighbors, objectModel, reachable, shortestPath, typeRegistry, uuidLookup, vtableDetail, xrefs } from "./query.mjs";
import { getPlaybook, listPlaybooks } from "./playbooks.mjs";
import { addInvestigationItem, challengeEvidence, createInvestigation, investigationDetail, investigationReport, listFailedAttempts, listInvestigations, recordFailedAttempt, recordInvestigationUsage, setInvestigationStatus, updateInvestigationItem } from "./investigations.mjs";
import { discover, discoveryContext } from "./discovery.mjs";
import { localToolStatus, recordToolObservation, runLocalTool } from "./executor.mjs";

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

function help() {
  console.log(`HexWitness ${VERSION} — evidence-first reverse engineering

Usage:
  hexwitness init [--db PATH]
  hexwitness setup [--client codex,cursor] [--viewer none|binary-ninja|ida|both]
  hexwitness agent
  hexwitness mcp
  hexwitness adapters [ADAPTER_ID] [--diagnose]
  hexwitness playbooks [PLAYBOOK_ID]
  hexwitness contract
  hexwitness backup OUTPUT [--db PATH]
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
  hexwitness capture SOURCE_DIR [--out PACK_DIR] [--no-import]
  hexwitness stats
  hexwitness investigation create TITLE --build BUILD [--question TEXT] [--playbook ID] [--budget UNITS]
  hexwitness investigation list [--build BUILD] [--status STATUS]
  hexwitness investigation show ID
  hexwitness investigation add ID KIND TITLE [--ref ID] [--required]
  hexwitness investigation item ID ITEM_ID pending|in_progress|done|blocked|skipped
  hexwitness investigation status ID planned|active|blocked|complete|abandoned
  hexwitness investigation use ID OPERATION [--units N] [--note TEXT]
  hexwitness investigation report [--build BUILD] [--stale-days N]
  hexwitness attempts [--investigation ID] [--build BUILD] [--subject TEXT]
  hexwitness attempt record SUBJECT --build BUILD --method TEXT --expected TEXT --actual TEXT --lesson TEXT
  hexwitness challenge SUBJECT --build BUILD
  hexwitness challenge --investigation ID
  hexwitness discover QUERY [--build BUILD] [--kinds entity,evidence]
  hexwitness context QUERY [--build BUILD] [--max-chars N]
  hexwitness tool status
  hexwitness tool run EXECUTABLE [ARG...] [--root DIR] [--cwd DIR] [--timeout MS]
  hexwitness tool run EXECUTABLE [ARG...] --record --build BUILD [--summary TEXT]
  hexwitness doctor
  hexwitness demo [--reset]

Environment: HEXWITNESS_HOME, HEXWITNESS_DB, HEXWITNESS_HOST,
HEXWITNESS_PORT, HEXWITNESS_API_TOKEN, HEXWITNESS_ACTIVITY_RETENTION_DAYS.`);
}

const args = process.argv.slice(2);
const command = args[0];
const controlArgs = command === "tool" && args.includes("--") ? args.slice(0, args.indexOf("--")) : args;
const config = loadConfig({ evidenceDb: option(controlArgs, "--db") ?? undefined, host: option(controlArgs, "--host") ?? undefined, port: option(controlArgs, "--port") ?? undefined });

try {
  switch (command) {
    case "init": {
      const db = openEvidenceDb(config.evidenceDb); db.close();
      print({ ok: true, database: config.evidenceDb }); break;
    }
    case "setup": {
      const result = await runSetup(args.slice(1));
      if (args.includes("--json")) print(result); else process.stdout.write(`${formatSetupSummary(result)}\n`);
      break;
    }
    case "agent": await startAgent(); break;
    case "mcp": await startMcp(); break;
    case "adapters": {
      const id = args[1]?.startsWith("--") ? null : args[1];
      print(args.includes("--diagnose") ? adapterDiagnostics(id) : id ? adapterDetail(id) : adapterCatalog()); break;
    }
    case "playbooks": print(args[1] ? getPlaybook(args[1]) : listPlaybooks()); break;
    case "contract": print(publicContract()); break;
    case "backup": {
      if (!args[1]) throw new Error("backup requires an output path");
      print(backupEvidenceDb(config.evidenceDb, args[1])); break;
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
      const lifecycleActions = new Set(["init", "add", "mark", "normalize", "inspect", "verify", "seal", "import", "pack"]);
      const direct = args[1] && !lifecycleActions.has(args[1]);
      const action = direct ? "pack" : args[1]; const root = direct ? args[1] : args[2];
      if (!action || !root) throw new Error("capture requires a source directory");
      if (action === "pack") print(await packCaptureDirectory(root, {
        output: option(args, "--out"), evidenceDb: option(args, "--db") ?? undefined,
        import: !args.includes("--no-import"), allowIncomplete: args.includes("--allow-incomplete"),
      }));
      else if (action === "init") {
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
    case "investigation": {
      const action = args[1];
      if (action === "create") {
        const db = openEvidenceDb(config.evidenceDb);
        try { print(createInvestigation(db, { buildId: option(args, "--build"), title: args[2], question: option(args, "--question", ""), playbookId: option(args, "--playbook"), priority: option(args, "--priority", 2), operationBudget: option(args, "--budget") })); } finally { db.close(); }
      } else if (action === "list") {
        const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
        try { print(listInvestigations(db, { buildId: option(args, "--build"), status: option(args, "--status"), playbookId: option(args, "--playbook"), staleDays: option(args, "--stale-days", 7), limit: option(args, "--limit") })); } finally { db.close(); }
      } else if (action === "show") {
        const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
        try { print(investigationDetail(db, args[2])); } finally { db.close(); }
      } else if (action === "add") {
        const db = openEvidenceDb(config.evidenceDb);
        try { print(addInvestigationItem(db, args[2], { kind: args[3], title: args[4], refId: option(args, "--ref"), required: args.includes("--required"), status: option(args, "--status", "pending"), details: option(args, "--details") ? JSON.parse(option(args, "--details")) : {} })); } finally { db.close(); }
      } else if (action === "item") {
        const db = openEvidenceDb(config.evidenceDb);
        try { print(updateInvestigationItem(db, args[2], args[3], { status: args[4] })); } finally { db.close(); }
      } else if (action === "status") {
        const db = openEvidenceDb(config.evidenceDb);
        try { print(setInvestigationStatus(db, args[2], args[3])); } finally { db.close(); }
      } else if (action === "use") {
        const db = openEvidenceDb(config.evidenceDb);
        try { print(recordInvestigationUsage(db, args[2], { operation: args[3], units: option(args, "--units", 1), note: option(args, "--note"), source: option(args, "--source", "manual") })); } finally { db.close(); }
      } else if (action === "report") {
        const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
        try { print(investigationReport(db, { buildId: option(args, "--build"), staleDays: option(args, "--stale-days", 7) })); } finally { db.close(); }
      } else throw new Error(`unknown investigation action: ${action ?? "<missing>"}`);
      break;
    }
    case "attempts": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      try { print(listFailedAttempts(db, { investigationId: option(args, "--investigation"), buildId: option(args, "--build"), subject: option(args, "--subject"), limit: option(args, "--limit") })); } finally { db.close(); }
      break;
    }
    case "attempt": {
      if (args[1] !== "record") throw new Error("attempt requires action record");
      const db = openEvidenceDb(config.evidenceDb);
      try { print(recordFailedAttempt(db, { investigationId: option(args, "--investigation"), buildId: option(args, "--build"), subject: args[2], method: option(args, "--method"), expected: option(args, "--expected"), actual: option(args, "--actual"), lesson: option(args, "--lesson"), tool: option(args, "--tool"), toolVersion: option(args, "--tool-version"), evidenceIds: (option(args, "--evidence", "") ?? "").split(",").filter(Boolean) })); } finally { db.close(); }
      break;
    }
    case "challenge": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      try { print(challengeEvidence(db, { investigationId: option(args, "--investigation"), buildId: option(args, "--build"), subject: args[1]?.startsWith("--") ? null : args[1] })); } finally { db.close(); }
      break;
    }
    case "discover": case "context": {
      const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
      const options = { query: args[1], buildId: option(args, "--build"), kinds: (option(args, "--kinds", "") ?? "").split(",").filter(Boolean), limit: option(args, "--limit"), maxChars: option(args, "--max-chars") };
      try { print(command === "discover" ? discover(db, options) : discoveryContext(db, options)); } finally { db.close(); }
      break;
    }
    case "tool": {
      const action = args[1];
      if (action === "status") { print(localToolStatus({ root: option(args, "--root") ?? process.cwd() })); break; }
      if (action !== "run") throw new Error("tool requires action status or run");
      const executable = args[2];
      const separator = args.indexOf("--");
      const localArgs = separator >= 0 ? args.slice(0, separator) : args;
      const toolArgs = separator >= 0 ? args.slice(separator + 1) : args.slice(3).filter((value, index, all) => {
        const previous = all[index - 1];
        return !["--root", "--cwd", "--timeout", "--build", "--summary"].includes(value) && !["--root", "--cwd", "--timeout", "--build", "--summary"].includes(previous) && value !== "--record";
      });
      const receipt = await runLocalTool({ executable, args: toolArgs, cwd: option(localArgs, "--cwd"), timeoutMs: option(localArgs, "--timeout") }, { root: option(localArgs, "--root") ?? process.cwd() });
      if (localArgs.includes("--record")) {
        const db = openEvidenceDb(config.evidenceDb);
        try { print({ receipt, observation: recordToolObservation(db, option(localArgs, "--build"), receipt, option(localArgs, "--summary")) }); } finally { db.close(); }
      } else print(receipt);
      break;
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
    case "version": case "--version": case "-v": console.log(VERSION); break;
    case "help": case "--help": case "-h": case undefined: help(); break;
    default: throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  console.error(`hexwitness: ${error.message}`);
  process.exitCode = 1;
}
