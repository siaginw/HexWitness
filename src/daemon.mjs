import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { basename } from "node:path";
import { loadConfig } from "./config.mjs";
import { openEvidenceDb } from "./db.mjs";
import { ActivityLog } from "./activity.mjs";
import { contradictions, evidenceFor, explain, gapReport, listBuilds, neighbors, search, stats, xrefs } from "./query.mjs";
import { dumpGuide } from "./guides.mjs";
import { VERSION } from "./constants.mjs";

function send(response, status, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
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
  const db = openEvidenceDb(config.evidenceDb);
  const activity = new ActivityLog(config.activityDb, { enabled: config.activityLog, retentionDays: config.retentionDays });
  activity.purge();
  const startedAt = new Date().toISOString();

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
      switch (url.pathname) {
        case "/":
        case "/v1/health":
          result = { ok: true, service: "hexwitness-daemon", version: VERSION, started_utc: startedAt, database: { file: basename(config.evidenceDb), read_only: true }, stats: stats(db) };
          break;
        case "/v1/builds": result = listBuilds(db); break;
        case "/v1/stats": result = stats(db); break;
        case "/v1/search":
          result = search(db, { q: url.searchParams.get("q"), buildId: url.searchParams.get("build_id"), kind: url.searchParams.get("kind"), limit: url.searchParams.get("limit") });
          break;
        case "/v1/explain": result = explain(db, selector(url.searchParams)); break;
        case "/v1/gaps": result = gapReport(db, selector(url.searchParams), url.searchParams.get("objective") ?? "behavior"); break;
        case "/v1/guide/dump": result = dumpGuide(url.searchParams.get("objective") ?? "behavior"); break;
        case "/v1/callers": result = neighbors(db, selector(url.searchParams), "incoming", "call", url.searchParams.get("limit")); break;
        case "/v1/callees": result = neighbors(db, selector(url.searchParams), "outgoing", "call", url.searchParams.get("limit")); break;
        case "/v1/xrefs": result = xrefs(db, selector(url.searchParams), url.searchParams.get("limit")); break;
        case "/v1/evidence":
          result = evidenceFor(db, { buildId: url.searchParams.get("build_id"), source: url.searchParams.get("source"), classification: url.searchParams.get("classification"), limit: url.searchParams.get("limit") });
          break;
        case "/v1/contradictions": result = contradictions(db, { buildId: url.searchParams.get("build_id"), limit: url.searchParams.get("limit") }); break;
        case "/v1/activity": {
          const requested = Number(url.searchParams.get("limit") ?? 25);
          const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 100) : 25;
          result = activity.summary(limit);
          break;
        }
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) startDaemon();
