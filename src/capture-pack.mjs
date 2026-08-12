import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { CAPTURE_PACK_SCHEMA, FORMAT } from "./constants.mjs";
import { canonicalAddress, nowUtc, sha256, stableId } from "./util.mjs";

export const BASELINE_CAPTURE_ROLES = Object.freeze([
  "bidirectional-wire",
  "semantic-events",
  "action-markers",
  "screen-recording",
  "context",
]);

const SENSITIVE_KEYS = /(^|_)(authorization|cookie|credential|password|secret|steam_ticket|token)($|_)/i;
const PAYLOAD_KEYS = /^(body|bytes|payload|raw|buffer|data)$/i;

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hashFile(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function inside(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !resolve(candidate).includes(`${sep}..${sep}`));
}

function requirePack(root) {
  const path = join(resolve(root), "manifest.json");
  if (!existsSync(path)) throw new Error(`capture pack manifest not found: ${path}`);
  const manifest = readJson(path);
  if (manifest.schema !== CAPTURE_PACK_SCHEMA) throw new Error(`unsupported capture pack schema: ${manifest.schema}`);
  return { root: resolve(root), path, manifest };
}

function uniqueArtifactName(directory, source) {
  const original = basename(source);
  let target = join(directory, original);
  let index = 1;
  while (existsSync(target)) {
    const extension = extname(original);
    const stem = extension ? original.slice(0, -extension.length) : original;
    target = join(directory, `${stem}-${index}${extension}`);
    index += 1;
  }
  return target;
}

function countJsonl(path) {
  if (extname(path).toLowerCase() !== ".jsonl") return null;
  return readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.trim()).length;
}

function mediaType(path) {
  return ({
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".pcap": "application/vnd.tcpdump.pcap",
    ".pcapng": "application/x-pcapng",
    ".txt": "text/plain",
  })[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function sanitizedFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.test(key) || PAYLOAD_KEYS.test(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) out[key] = sanitizedFields(value);
    else out[key] = value;
  }
  return out;
}

function payloadSummary(raw) {
  for (const key of Object.keys(raw)) {
    if (!PAYLOAD_KEYS.test(key) || raw[key] == null) continue;
    const value = typeof raw[key] === "string" ? raw[key] : JSON.stringify(raw[key]);
    return { body_len: Buffer.byteLength(value), body_sha256: sha256(value) };
  }
  return {};
}

function normalizeEvent(raw, context) {
  const timestamp = raw.ts_utc ?? raw.timestamp ?? raw.time;
  if (typeof timestamp !== "string" || !timestamp.endsWith("Z") || !Number.isFinite(Date.parse(timestamp))) throw new Error(`event ${context.source}#${context.ordinal} requires an ISO-8601 UTC timestamp ending in Z`);
  const address = raw.address ?? raw.rva ?? raw.hook_rva ?? raw.pc;
  const payload = payloadSummary(raw);
  return {
    format: FORMAT,
    record: "event",
    build_id: context.buildId,
    capture_id: context.captureId,
    event_id: stableId("event", context.captureId, context.ordinal, context.source, raw.name ?? raw.event ?? raw.kind),
    ordinal: context.ordinal,
    ts_utc: timestamp,
    source: raw.source ?? context.source,
    kind: raw.kind ?? raw.event_type ?? "observation",
    name: raw.name ?? raw.event ?? raw.function ?? raw.hook ?? "unnamed",
    direction: raw.direction ?? "local",
    address: address == null ? undefined : canonicalAddress(address),
    thread_id: raw.thread_id == null ? undefined : String(raw.thread_id),
    body_len: raw.body_len ?? payload.body_len,
    body_sha256: raw.body_sha256 ?? payload.body_sha256,
    confidence: raw.confidence ?? 1,
    action_id: raw.action_id ?? raw.marker,
    summary: raw.summary,
    fields: sanitizedFields(raw.fields ?? raw.args ?? raw),
  };
}

export function initCapturePack(root, options = {}) {
  const absolute = resolve(root);
  if (existsSync(join(absolute, "manifest.json"))) throw new Error(`capture pack already exists: ${absolute}`);
  for (const folder of ["raw", "probes", "normalized", "derived"]) mkdirSync(join(absolute, folder), { recursive: true });
  const scenarioSpec = options.scenarioSpec ?? null;
  if (scenarioSpec && (scenarioSpec.schema !== "hexwitness-scenario-v1" || !scenarioSpec.id || !Array.isArray(scenarioSpec.steps))) throw new Error("invalid hexwitness-scenario-v1 specification");
  const scenarioName = options.scenario ?? scenarioSpec?.id ?? "controlled-runtime-observation";
  const captureId = options.captureId ?? `CAP-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${String(scenarioName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const requiredRoles = [...new Set(options.requiredRoles ?? scenarioSpec?.required_roles ?? BASELINE_CAPTURE_ROLES)];
  const requiredMarkers = options.requiredMarkers ?? scenarioSpec?.steps.filter((step) => step.required !== false).map((step) => step.id) ?? [];
  const manifest = {
    schema: CAPTURE_PACK_SCHEMA,
    schema_version: 1,
    capture_id: captureId,
    scenario: scenarioName,
    title: options.title ?? scenarioSpec?.title ?? scenarioName,
    status: "active",
    quality: "pending",
    build_id: options.buildId ?? null,
    executable_sha256: options.executableSha256 ?? null,
    started_utc: options.startedUtc ?? nowUtc(),
    finished_utc: null,
    required_roles: requiredRoles,
    required_markers: requiredMarkers,
    context: { ...(options.context ?? {}), scenario_spec: scenarioSpec ?? undefined },
    artifacts: [],
    markers: [],
    quality_report: { passed: false, missing_roles: requiredRoles, missing_markers: [] },
  };
  writeJson(join(absolute, "manifest.json"), manifest);
  writeJson(join(absolute, "active-run.json"), { capture_id: captureId, started_utc: manifest.started_utc, status: "active" });
  writeFileSync(join(absolute, "operator-markers.jsonl"), "", "utf8");
  return manifest;
}

export function addCaptureArtifact(root, sourcePath, role, options = {}) {
  const pack = requirePack(root);
  if (pack.manifest.status !== "active") throw new Error("capture pack is sealed");
  const source = resolve(sourcePath);
  if (!existsSync(source) || !statSync(source).isFile()) throw new Error(`artifact file not found: ${source}`);
  if (!role) throw new Error("artifact role is required");
  const bucket = role.includes("probe") || role === "semantic-events" ? "probes" : "raw";
  const target = uniqueArtifactName(join(pack.root, bucket), source);
  copyFileSync(source, target);
  const entry = {
    role,
    path: relative(pack.root, target).replaceAll("\\", "/"),
    sha256: hashFile(target),
    size_bytes: statSync(target).size,
    media_type: options.mediaType ?? mediaType(target),
    event_count: options.eventCount ?? countJsonl(target),
    description: options.description ?? null,
  };
  pack.manifest.artifacts.push(entry);
  writeJson(pack.path, pack.manifest);
  return entry;
}

export function addCaptureMarker(root, name, note = null, metadata = {}, options = {}) {
  const pack = requirePack(root);
  if (pack.manifest.status !== "active") throw new Error("capture pack is sealed");
  if (!name) throw new Error("marker name is required");
  const marker = { ordinal: pack.manifest.markers.length + 1, ts_utc: options.tsUtc ?? nowUtc(), name, note, metadata };
  pack.manifest.markers.push(marker);
  appendFileSync(join(pack.root, "operator-markers.jsonl"), `${JSON.stringify(marker)}\n`, "utf8");
  writeJson(pack.path, pack.manifest);
  return marker;
}

export function normalizeCapturePack(root) {
  const pack = requirePack(root);
  if (!pack.manifest.build_id) throw new Error("capture pack build_id is required before normalization");
  const records = [{
    format: FORMAT, record: "build", build_id: pack.manifest.build_id,
    label: pack.manifest.context?.build_label ?? pack.manifest.build_id,
    sha256: pack.manifest.executable_sha256 ?? undefined,
    tool: "hexwitness-capture-pack", created_utc: pack.manifest.started_utc,
    metadata: { runtime_only: true },
  }, {
    format: FORMAT, record: "capture",
    capture_id: pack.manifest.capture_id,
    build_id: pack.manifest.build_id,
    scenario: pack.manifest.scenario,
    started_utc: pack.manifest.started_utc,
    finished_utc: pack.manifest.finished_utc,
    status: pack.manifest.status,
    metadata: { title: pack.manifest.title, context: pack.manifest.context, quality: pack.manifest.quality },
  }];
  for (const marker of pack.manifest.markers) records.push({
    format: FORMAT, record: "marker", build_id: pack.manifest.build_id, capture_id: pack.manifest.capture_id, ordinal: marker.ordinal,
    ts_utc: marker.ts_utc, name: marker.name, note: marker.note, metadata: marker.metadata,
  });
  let ordinal = 0;
  const normalizedEvents = [];
  const rawEvents = [];
  let sourceSequence = 0;
  for (const artifact of pack.manifest.artifacts) {
    records.push({ format: FORMAT, record: "capture_artifact", build_id: pack.manifest.build_id, capture_id: pack.manifest.capture_id, ...artifact });
    if (artifact.media_type !== "application/x-ndjson" || artifact.role === "normalized-evidence") continue;
    const path = join(pack.root, artifact.path);
    const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.trim());
    for (const [index, line] of lines.entries()) {
      let raw;
      try { raw = JSON.parse(line); } catch (error) { throw new Error(`${artifact.path}:${index + 1}: ${error.message}`); }
      if (raw.format === FORMAT && raw.record && raw.record !== "event") continue;
      sourceSequence += 1;
      rawEvents.push({ raw, source: artifact.role, sourceSequence });
    }
  }
  rawEvents.sort((left, right) => {
    const leftTime = Date.parse(left.raw.ts_utc ?? left.raw.timestamp ?? left.raw.time ?? "");
    const rightTime = Date.parse(right.raw.ts_utc ?? right.raw.timestamp ?? right.raw.time ?? "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
    return left.sourceSequence - right.sourceSequence;
  });
  for (const item of rawEvents) {
    ordinal += 1;
    const event = normalizeEvent(item.raw, { captureId: pack.manifest.capture_id, buildId: pack.manifest.build_id, ordinal, source: item.source });
    records.push(event);
    normalizedEvents.push(event);
  }
  const markerRefs = new Map(pack.manifest.markers.flatMap((marker) => [[String(marker.ordinal), `marker:${marker.name}`], [marker.name, `marker:${marker.name}`]]));
  const correlated = new Map();
  const relationshipKeys = new Set();
  const addRelationship = (sourceRef, kind, targetRef, evidence) => {
    const key = `${sourceRef}|${kind}|${targetRef}`;
    if (relationshipKeys.has(key)) return;
    relationshipKeys.add(key);
    records.push({ format: FORMAT, record: "relationship", build_id: pack.manifest.build_id, capture_id: pack.manifest.capture_id,
      source_ref: sourceRef, kind, target_ref: targetRef, confidence: 1, evidence });
  };
  for (const event of normalizedEvents) {
    const eventRef = `event:${event.event_id}`;
    if (event.action_id != null && markerRefs.has(String(event.action_id))) addRelationship(markerRefs.get(String(event.action_id)), "marks", eventRef, [event.event_id]);
    const fields = event.fields ?? {};
    const correlation = fields.correlation_id ?? fields.request_id ?? fields.trace_id ?? fields.transaction_id;
    if (correlation != null) {
      const correlationKey = String(correlation);
      const previous = correlated.get(correlationKey);
      if (previous) addRelationship(`event:${previous.event_id}`, previous.direction !== event.direction ? "response_to" : "follows", eventRef, [previous.event_id, event.event_id]);
      correlated.set(correlationKey, event);
    }
    for (const identityKey of ["object_id", "actor_id", "entity_id", "resource_id", "session_id", "type_id", "uuid"]) {
      if (fields[identityKey] != null) addRelationship(eventRef, `observes_${identityKey}`, `${identityKey}:${fields[identityKey]}`, [event.event_id]);
    }
  }
  const output = join(pack.root, "normalized", "evidence.hexwitness.jsonl");
  writeFileSync(output, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  return { output, records: records.length, events: ordinal };
}

export function auditCapturePack(root) {
  const pack = requirePack(root);
  const errors = [];
  const warnings = [];
  const roles = new Set(pack.manifest.artifacts.map((item) => item.role));
  if (pack.manifest.markers.length > 0) roles.add("action-markers");
  const markerNames = new Set(pack.manifest.markers.map((item) => item.name));
  const missingRoles = pack.manifest.required_roles.filter((role) => !roles.has(role));
  const missingMarkers = pack.manifest.required_markers.filter((name) => !markerNames.has(name));
  for (const artifact of pack.manifest.artifacts) {
    const path = join(pack.root, artifact.path);
    if (!inside(pack.root, path)) errors.push(`artifact escapes pack root: ${artifact.path}`);
    else if (!existsSync(path)) errors.push(`artifact missing: ${artifact.path}`);
    else if (hashFile(path) !== artifact.sha256) errors.push(`artifact hash mismatch: ${artifact.path}`);
  }
  if (!pack.manifest.executable_sha256) warnings.push("executable_sha256 missing; exact-build proof is weaker");
  if (!pack.manifest.markers.length) warnings.push("no action markers recorded");
  return { passed: errors.length === 0 && missingRoles.length === 0 && missingMarkers.length === 0, errors, warnings, missing_roles: missingRoles, missing_markers: missingMarkers };
}

export function sealCapturePack(root, { allowIncomplete = false } = {}) {
  const pack = requirePack(root);
  const preflight = auditCapturePack(pack.root);
  if (!preflight.passed && !allowIncomplete) throw new Error(`capture quality gate failed: ${[...preflight.missing_roles, ...preflight.missing_markers, ...preflight.errors].join(", ")}`);
  pack.manifest.finished_utc = nowUtc();
  pack.manifest.status = "sealed";
  pack.manifest.quality = preflight.passed ? "accepted" : "incomplete";
  pack.manifest.quality_report = preflight;
  writeJson(pack.path, pack.manifest);
  const normalized = normalizeCapturePack(pack.root);
  const normalizedPath = relative(pack.root, normalized.output).replaceAll("\\", "/");
  if (!pack.manifest.artifacts.some((item) => item.path === normalizedPath)) {
    pack.manifest.artifacts.push({ role: "normalized-evidence", path: normalizedPath, sha256: hashFile(normalized.output), size_bytes: statSync(normalized.output).size, media_type: "application/x-ndjson", event_count: normalized.records });
    writeJson(pack.path, pack.manifest);
  }
  const report = auditCapturePack(pack.root);
  pack.manifest.quality_report = report;
  writeJson(pack.path, pack.manifest);
  const files = pack.manifest.artifacts.map((artifact) => ({ path: artifact.path, sha256: artifact.sha256 }));
  files.push({ path: "manifest.json", sha256: hashFile(pack.path) });
  writeFileSync(join(pack.root, "checksums.sha256"), `${files.map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`, "utf8");
  writeFileSync(join(pack.root, "findings.md"), `# ${pack.manifest.title}\n\n- Capture: \`${pack.manifest.capture_id}\`\n- Build: \`${pack.manifest.build_id}\`\n- Quality: **${pack.manifest.quality}**\n- Events: ${normalized.events}\n- Artifacts: ${pack.manifest.artifacts.length}\n\n## Findings\n\nAdd evidence-backed findings here. Do not paste sensitive payloads.\n`, "utf8");
  if (existsSync(join(pack.root, "active-run.json"))) writeJson(join(pack.root, "active-run.json"), { capture_id: pack.manifest.capture_id, status: "sealed", finished_utc: pack.manifest.finished_utc });
  return { manifest: pack.manifest, report, normalized };
}

export function verifyCapturePack(root) {
  const pack = requirePack(root);
  const report = auditCapturePack(pack.root);
  const checksumPath = join(pack.root, "checksums.sha256");
  if (pack.manifest.status === "sealed" && !existsSync(checksumPath)) report.errors.push("sealed pack missing checksums.sha256");
  if (existsSync(checksumPath)) {
    const entries = readFileSync(checksumPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of entries) {
      const match = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line);
      if (!match) { report.errors.push(`invalid checksum line: ${line}`); continue; }
      const path = join(pack.root, match[2]);
      if (!inside(pack.root, path) || !existsSync(path) || hashFile(path) !== match[1]) report.errors.push(`checksum verification failed: ${match[2]}`);
    }
  }
  report.passed = report.errors.length === 0 && report.missing_roles.length === 0 && report.missing_markers.length === 0;
  return report;
}

export function inspectCapturePack(root) {
  const pack = requirePack(root);
  return { manifest: pack.manifest, audit: auditCapturePack(root) };
}

export function listPackFiles(root) {
  const output = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else output.push(relative(resolve(root), path).replaceAll("\\", "/"));
    }
  }
  walk(resolve(root));
  return output.sort();
}
