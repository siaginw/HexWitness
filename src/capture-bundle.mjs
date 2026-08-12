import { existsSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { addCaptureArtifact, addCaptureMarker, initCapturePack, sealCapturePack, verifyCapturePack } from "./capture-pack.mjs";
import { loadConfig } from "./config.mjs";
import { ingestFile } from "./ingest.mjs";

const DEFAULT_ARTIFACTS = Object.freeze([
  { role: "bidirectional-wire", names: ["wire.jsonl", "traffic.jsonl", "wire.pcapng", "wire.pcap"] },
  { role: "semantic-events", names: ["hooks.jsonl", "semantic.jsonl", "events.jsonl"] },
  { role: "screen-recording", names: ["screen.mp4", "recording.mp4", "screen.webm", "recording.mkv"] },
  { role: "context", names: ["context.json"] },
]);

function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }

function validateInput(spec, path) {
  if (spec.schema && spec.schema !== "hexwitness-capture-input-v1") throw new Error(`unsupported capture input schema in ${path}: ${spec.schema}`);
  if (!spec.scenario) throw new Error(`capture input requires scenario: ${path}`);
  if (!spec.build_id) throw new Error(`capture input requires build_id: ${path}`);
  if (!Array.isArray(spec.markers) || spec.markers.length === 0) throw new Error(`capture input requires at least one timestamped marker: ${path}`);
  for (const marker of spec.markers) {
    if (!marker.name) throw new Error(`capture marker requires name: ${path}`);
    if (!marker.ts_utc || !marker.ts_utc.endsWith("Z") || !Number.isFinite(Date.parse(marker.ts_utc))) throw new Error(`capture marker '${marker.name}' requires ISO-8601 UTC ts_utc ending in Z`);
  }
}

function detectArtifacts(source, spec) {
  if (Array.isArray(spec.artifacts) && spec.artifacts.length) return spec.artifacts.map((item) => {
    if (!item.path || !item.role) throw new Error("each capture artifact requires path and role");
    return { ...item, path: resolve(source, item.path) };
  });
  const found = [];
  for (const candidate of DEFAULT_ARTIFACTS) {
    const name = candidate.names.find((item) => existsSync(join(source, item)));
    if (name) found.push({ role: candidate.role, path: join(source, name) });
  }
  return found;
}

export async function packCaptureDirectory(sourcePath, options = {}) {
  const source = resolve(sourcePath);
  if (!existsSync(source) || !statSync(source).isDirectory()) throw new Error(`capture source directory not found: ${source}`);
  const inputPath = resolve(source, options.manifest ?? "capture.json");
  if (!existsSync(inputPath)) throw new Error(`capture input manifest not found: ${inputPath}`);
  const spec = readJson(inputPath);
  validateInput(spec, inputPath);
  const finalOutput = options.output ? resolve(options.output) : spec.output ? resolve(source, spec.output) : join(dirname(source), `${basename(source)}.pack`);
  if (existsSync(finalOutput)) throw new Error(`capture output already exists: ${finalOutput}`);
  const building = `${finalOutput}.building-${process.pid}`;
  if (existsSync(building)) rmSync(building, { recursive: true, force: true });
  try {
    const artifacts = detectArtifacts(source, spec);
    initCapturePack(building, {
      scenario: spec.scenario,
      title: spec.title,
      buildId: spec.build_id,
      executableSha256: spec.executable_sha256,
      startedUtc: spec.started_utc,
      requiredRoles: spec.required_roles,
      requiredMarkers: spec.required_markers,
      context: spec.context,
    });
    for (const artifact of artifacts) addCaptureArtifact(building, artifact.path, artifact.role, {
      description: artifact.description,
      mediaType: artifact.media_type,
    });
    for (const marker of spec.markers) addCaptureMarker(building, marker.name, marker.note, marker.metadata ?? {}, { tsUtc: marker.ts_utc });
    const sealed = sealCapturePack(building, { allowIncomplete: options.allowIncomplete === true });
    const verification = verifyCapturePack(building);
    const explicitlyIncomplete = options.allowIncomplete === true && sealed.manifest.quality === "incomplete" && verification.errors.length === 0;
    if (!verification.passed && !explicitlyIncomplete) throw new Error(`capture verification failed: ${[...verification.errors, ...verification.missing_roles, ...verification.missing_markers].join(", ")}`);
    renameSync(building, finalOutput);
    let imported = null;
    if (options.import !== false && spec.import !== false) {
      const config = loadConfig({ evidenceDb: options.evidenceDb });
      imported = await ingestFile(config.evidenceDb, join(finalOutput, "normalized", "evidence.hexwitness.jsonl"));
    }
    return {
      ok: true,
      source,
      output: finalOutput,
      capture_id: sealed.manifest.capture_id,
      build_id: sealed.manifest.build_id,
      quality: sealed.manifest.quality,
      artifacts: artifacts.map(({ role, path }) => ({ role, path })),
      markers: spec.markers.length,
      verification,
      imported,
    };
  } catch (error) {
    rmSync(building, { recursive: true, force: true });
    throw error;
  }
}
