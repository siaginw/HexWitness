import { createServer } from "node:http";
import { basename } from "node:path";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { ActivityLog } from "./activity.mjs";
import {
  analysisSlices, captureDetail, captureGraph, captureSearch, captureTimeline, classDetail, compareCaptures,
  contradictions, coverage, dataflow, evidenceFor, explain, functionInventory, gapReport, gapWorklist,
  compareBuilds, decompSearch, edgeKinds, fieldOffsets, genericQuery, listBuilds, listCaptures, metadataLookup,
  memoryStatus, neighbors, objectModel, reachable, search, shortestPath, stats, typeRegistry, uuidLookup, vtableDetail, xrefs,
} from "./query.mjs";
import { dumpGuide } from "./guides.mjs";
import { VERSION } from "./constants.mjs";
import { publicContract } from "./contract.mjs";
import { adapterDiagnostics } from "./adapters.mjs";
import { getPlaybook, listPlaybooks } from "./playbooks.mjs";
import { challengeEvidence, investigationDetail, investigationReport, listFailedAttempts, listInvestigations } from "./investigations.mjs";
import { discover, discoveryContext } from "./discovery.mjs";
import { dashboardHtml } from "./dashboard.mjs";
import { randomBytes } from "node:crypto";

function send(response, status, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}

function sendHtml(response, body, nonce) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store", "content-security-policy": `default-src 'none'; connect-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`, "x-content-type-options": "nosniff" });
  response.end(body);
}

function selector(params) {
  return {
    buildId: params.get("build_id"),
    address: params.get("address"),
    stableKey: params.get("stable_key"),
    entityId: params.get("entity_id"),
  };
}

function resultCount(result) {
  if (Array.isArray(result)) return result.length;
  if (Array.isArray(result?.edges)) return result.edges.length;
  if (result?.summary) return Object.values(result.summary).reduce((sum, value) => sum + Number(value || 0), 0);
  return result ? 1 : 0;
}

export function startDaemon(overrides = {}) {
  const config = loadConfig(overrides);
  if (!["127.0.0.1", "localhost", "::1"].includes(config.host) && !config.apiToken) {
    throw new Error("refusing non-local bind without HEXWITNESS_API_TOKEN");
  }
  const db = openEvidenceDb(config.evidenceDb, { readOnly: true });
  const activity = new ActivityLog(config.activityDb, { enabled: config.activityLog, retentionDays: config.retentionDays });
  activity.purge();
  const startedAt = new Date().toISOString();
  const routes = [
    "/v1/health", "/v1/contract", "/v1/routes", "/v1/memory", "/v1/builds", "/v1/builds/compare", "/v1/stats", "/v1/search", "/v1/query", "/v1/explain",
    "/v1/gaps", "/v1/gaps/worklist", "/v1/coverage", "/v1/guide/dump", "/v1/callers", "/v1/callees",
    "/v1/xrefs", "/v1/reach", "/v1/dataflow", "/v1/slices", "/v1/functions", "/v1/classes", "/v1/class",
    "/v1/vtable", "/v1/uuid", "/v1/types", "/v1/offsets", "/v1/metadata", "/v1/decomp/search",
    "/v1/path", "/v1/edges/kinds", "/v1/evidence", "/v1/contradictions", "/v1/captures",
    "/v1/captures/detail", "/v1/captures/timeline", "/v1/captures/search", "/v1/captures/graph",
    "/v1/captures/compare", "/v1/activity", "/v1/adapters/diagnostics", "/v1/playbooks", "/v1/playbooks/detail",
    "/v1/investigations", "/v1/investigations/detail", "/v1/investigations/report", "/v1/failed-attempts", "/v1/evidence/challenge",
    "/v1/discover", "/v1/discovery/context", "/dashboard",
  ];

  const server = createServer((request, response) => {
    const started = performance.now();
    const url = new URL(request.url, `http://${request.headers.host ?? `${config.host}:${config.port}`}`);
    const operation = url.pathname;
    const args = Object.fromEntries(url.searchParams.entries());
    let status = "ok";
    let result;
    try {
      if (request.method !== "GET") { status = "method_not_allowed"; return send(response, 405, { error: "read-only daemon; use hexwitness ingest locally" }); }
      if (config.apiToken && request.headers.authorization !== `Bearer ${config.apiToken}`) { status = "unauthorized"; return send(response, 401, { error: "unauthorized" }); }
      if (url.pathname === "/dashboard") {
        if (!["127.0.0.1", "localhost", "::1"].includes(config.host)) return send(response, 403, { error: "dashboard is loopback-only" });
        const nonce = randomBytes(18).toString("base64url"); status = "dashboard"; return sendHtml(response, dashboardHtml(nonce), nonce);
      }
      switch (url.pathname) {
        case "/":
        case "/v1/health":
          result = { ok: true, service: "hexwitness-daemon", version: VERSION, started_utc: startedAt, database: { file: basename(config.evidenceDb), read_only: true }, stats: stats(db) };
          break;
        case "/v1/builds": result = listBuilds(db); break;
        case "/v1/contract": result = publicContract(); break;
        case "/v1/builds/compare": result = compareBuilds(db, url.searchParams.get("left"), url.searchParams.get("right"), { limit: url.searchParams.get("limit") }); break;
        case "/v1/routes": result = { version: VERSION, read_only: true, routes }; break;
        case "/v1/memory": result = { ...memoryStatus(db), activity: activity.summary(10) }; break;
        case "/v1/stats": result = stats(db); break;
        case "/v1/search":
          result = search(db, { q: url.searchParams.get("q"), buildId: url.searchParams.get("build_id"), kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") });
          break;
        case "/v1/explain": result = explain(db, selector(url.searchParams)); break;
        case "/v1/query": result = genericQuery(db, {
          buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q") ?? "",
          kinds: (url.searchParams.get("kinds") ?? "").split(",").filter(Boolean),
          edgeKinds: (url.searchParams.get("edge_kinds") ?? "").split(",").filter(Boolean),
          hasEvidence: url.searchParams.has("has_evidence") ? url.searchParams.get("has_evidence") === "true" : null,
          hasRuntime: url.searchParams.has("has_runtime") ? url.searchParams.get("has_runtime") === "true" : null,
          limit: url.searchParams.get("limit"),
        }); break;
        case "/v1/gaps": result = gapReport(db, selector(url.searchParams), url.searchParams.get("objective") ?? "behavior"); break;
        case "/v1/gaps/worklist": result = gapWorklist(db, { buildId: url.searchParams.get("build_id"), captureId: url.searchParams.get("capture_id"), status: url.searchParams.get("status"), limit: url.searchParams.get("limit") }); break;
        case "/v1/coverage": result = coverage(db, { buildId: url.searchParams.get("build_id") }); break;
        case "/v1/guide/dump": result = dumpGuide(url.searchParams.get("objective") ?? "behavior"); break;
        case "/v1/callers": result = neighbors(db, selector(url.searchParams), "incoming", "call", url.searchParams.get("limit")); break;
        case "/v1/callees": result = neighbors(db, selector(url.searchParams), "outgoing", "call", url.searchParams.get("limit")); break;
        case "/v1/xrefs": result = xrefs(db, selector(url.searchParams), url.searchParams.get("limit")); break;
        case "/v1/reach": result = reachable(db, selector(url.searchParams), { direction: url.searchParams.get("direction") ?? "outgoing", kind: url.searchParams.get("kind"), depth: url.searchParams.get("depth"), limit: url.searchParams.get("limit") }); break;
        case "/v1/dataflow": result = dataflow(db, selector(url.searchParams), { direction: url.searchParams.get("direction") ?? "both", depth: url.searchParams.get("depth"), limit: url.searchParams.get("limit") }); break;
        case "/v1/slices": result = analysisSlices(db, selector(url.searchParams), { kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") }); break;
        case "/v1/functions": result = functionInventory(db, { buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q") ?? "", named: url.searchParams.has("named") ? url.searchParams.get("named") === "true" : null, limit: url.searchParams.get("limit") }); break;
        case "/v1/classes": result = objectModel(db, { buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q") ?? "", limit: url.searchParams.get("limit") }); break;
        case "/v1/class": result = classDetail(db, { buildId: url.searchParams.get("build_id"), name: url.searchParams.get("name"), stableKey: url.searchParams.get("stable_key"), entityId: url.searchParams.get("entity_id") }); break;
        case "/v1/vtable": result = vtableDetail(db, selector(url.searchParams), url.searchParams.get("limit")); break;
        case "/v1/uuid": result = uuidLookup(db, { buildId: url.searchParams.get("build_id"), uuid: url.searchParams.get("uuid"), limit: url.searchParams.get("limit") }); break;
        case "/v1/types": result = typeRegistry(db, { buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q") ?? "", kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") }); break;
        case "/v1/offsets": result = fieldOffsets(db, { buildId: url.searchParams.get("build_id"), owner: url.searchParams.get("owner") ?? "", q: url.searchParams.get("q") ?? "", limit: url.searchParams.get("limit") }); break;
        case "/v1/metadata": result = metadataLookup(db, { buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q"), kinds: (url.searchParams.get("kinds") ?? "").split(",").filter(Boolean), limit: url.searchParams.get("limit") }); break;
        case "/v1/decomp/search": result = decompSearch(db, { buildId: url.searchParams.get("build_id"), q: url.searchParams.get("q"), kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") }); break;
        case "/v1/path": result = shortestPath(db,
          { buildId: url.searchParams.get("build_id"), address: url.searchParams.get("from_address"), stableKey: url.searchParams.get("from_key"), entityId: url.searchParams.get("from_entity") },
          { buildId: url.searchParams.get("build_id"), address: url.searchParams.get("to_address"), stableKey: url.searchParams.get("to_key"), entityId: url.searchParams.get("to_entity") },
          { kind: url.searchParams.get("kind"), direction: url.searchParams.get("direction") ?? "outgoing", depth: url.searchParams.get("depth") }); break;
        case "/v1/edges/kinds": result = edgeKinds(db, { buildId: url.searchParams.get("build_id") }); break;
        case "/v1/evidence":
          result = evidenceFor(db, { buildId: url.searchParams.get("build_id"), source: url.searchParams.get("source"), classification: url.searchParams.get("classification"), limit: url.searchParams.get("limit") });
          break;
        case "/v1/contradictions": result = contradictions(db, { buildId: url.searchParams.get("build_id"), limit: url.searchParams.get("limit") }); break;
        case "/v1/captures": result = listCaptures(db, { buildId: url.searchParams.get("build_id"), scenario: url.searchParams.get("scenario"), status: url.searchParams.get("status"), limit: url.searchParams.get("limit") }); break;
        case "/v1/captures/detail": result = captureDetail(db, url.searchParams.get("capture_id")); break;
        case "/v1/captures/timeline": result = captureTimeline(db, url.searchParams.get("capture_id"), { after: url.searchParams.get("after"), limit: url.searchParams.get("limit"), source: url.searchParams.get("source"), kind: url.searchParams.get("kind"), name: url.searchParams.get("name") }); break;
        case "/v1/captures/search": result = captureSearch(db, { captureId: url.searchParams.get("capture_id"), q: url.searchParams.get("q") ?? "", direction: url.searchParams.get("direction"), kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") }); break;
        case "/v1/captures/graph": result = captureGraph(db, url.searchParams.get("capture_id"), { kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") }); break;
        case "/v1/captures/compare": result = compareCaptures(db, url.searchParams.get("left"), url.searchParams.get("right")); break;
        case "/v1/activity": {
          const requested = Number(url.searchParams.get("limit") ?? 25);
          const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 100) : 25;
          result = activity.summary(limit);
          break;
        }
        case "/v1/adapters/diagnostics": result = adapterDiagnostics(url.searchParams.get("id")); break;
        case "/v1/playbooks": result = listPlaybooks(); break;
        case "/v1/playbooks/detail": result = getPlaybook(url.searchParams.get("id")); break;
        case "/v1/investigations": result = listInvestigations(db, { buildId: url.searchParams.get("build_id"), status: url.searchParams.get("status"), playbookId: url.searchParams.get("playbook_id"), staleDays: url.searchParams.get("stale_days"), limit: url.searchParams.get("limit") }); break;
        case "/v1/investigations/detail": result = investigationDetail(db, url.searchParams.get("investigation_id")); break;
        case "/v1/investigations/report": result = investigationReport(db, { buildId: url.searchParams.get("build_id"), staleDays: url.searchParams.get("stale_days") }); break;
        case "/v1/failed-attempts": result = listFailedAttempts(db, { investigationId: url.searchParams.get("investigation_id"), buildId: url.searchParams.get("build_id"), subject: url.searchParams.get("subject"), limit: url.searchParams.get("limit") }); break;
        case "/v1/evidence/challenge": result = challengeEvidence(db, { investigationId: url.searchParams.get("investigation_id"), buildId: url.searchParams.get("build_id"), subject: url.searchParams.get("subject") }); break;
        case "/v1/discover": result = discover(db, { query: url.searchParams.get("q"), buildId: url.searchParams.get("build_id"), kinds: (url.searchParams.get("kinds") ?? "").split(",").filter(Boolean), limit: url.searchParams.get("limit") }); break;
        case "/v1/discovery/context": result = discoveryContext(db, { query: url.searchParams.get("q"), buildId: url.searchParams.get("build_id"), kinds: (url.searchParams.get("kinds") ?? "").split(",").filter(Boolean), limit: url.searchParams.get("limit"), maxChars: url.searchParams.get("max_chars") }); break;
        default: status = "not_found"; return send(response, 404, { error: "not found", path: url.pathname });
      }
      if (result == null) { status = "not_found"; return send(response, 404, { error: "entity not found" }); }
      send(response, 200, result);
    } catch (error) {
      status = "error";
      send(response, 400, { error: error.message });
    } finally {
      activity.record({ transport: "http", operation, args, session: request.headers["x-hexwitness-session"], durationMs: performance.now() - started, resultCount: resultCount(result), status });
    }
  });

  server.listen(config.port, config.host, () => {
    const boundPort = server.address()?.port ?? config.port;
    console.error(`HexWitness daemon ${VERSION} listening at http://${config.host}:${boundPort}`);
    console.error(`Evidence DB: ${config.evidenceDb}`);
  });
  const close = () => new Promise((resolve) => server.close(() => { db.close(); activity.close(); resolve(); }));
  process.once("SIGINT", () => { void close(); });
  process.once("SIGTERM", () => { void close(); });
  return { server, config, close };
}
