import { existsSync, readFileSync } from "node:fs";
import { delimiter, extname, isAbsolute, resolve } from "node:path";

const adapterRoot = resolve(import.meta.dirname, "..", "adapters");
const manifestPath = resolve(adapterRoot, "manifest.json");

export function adapterCatalog() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return {
    ...manifest,
    root: adapterRoot,
    adapters: manifest.adapters.map((adapter) => ({
      ...adapter,
      absolute_path: resolve(adapterRoot, adapter.path),
    })),
  };
}

export function adapterDetail(id) {
  const catalog = adapterCatalog();
  const adapter = catalog.adapters.find((entry) => entry.id === id);
  if (!adapter) throw new Error(`unknown adapter: ${id}`);
  return adapter;
}

function executablePath(candidates) {
  const directories = String(process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? String(process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const candidate of candidates ?? []) {
    if (isAbsolute(candidate) && existsSync(candidate)) return candidate;
    for (const directory of directories) {
      const variants = extname(candidate) || process.platform !== "win32" ? [candidate] : extensions.map((extension) => `${candidate}${extension.toLowerCase()}`).concat(extensions.map((extension) => `${candidate}${extension.toUpperCase()}`));
      for (const variant of variants) {
        const path = resolve(directory, variant);
        if (existsSync(path)) return path;
      }
    }
  }
  return null;
}

export function diagnoseAdapter(adapterOrId) {
  const adapter = typeof adapterOrId === "string" ? adapterDetail(adapterOrId) : adapterOrId;
  const diagnostic = adapter.diagnostics ?? {};
  const asset = { path: adapter.absolute_path, present: existsSync(adapter.absolute_path) };
  const executable = adapter.id === "frida-normalizer" ? process.execPath : executablePath(diagnostic.executables_any);
  const environment = (diagnostic.environment_any ?? []).find((name) => Boolean(process.env[name])) ?? null;
  let status = "ready";
  let action = null;
  if (!asset.present) { status = "missing_asset"; action = `Reinstall HexWitness; adapter asset is missing: ${asset.path}`; }
  else if (!executable && !environment && diagnostic.execution === "embedded") { status = "external_host_required"; action = `Open ${diagnostic.host} and run the exporter in its supported embedded environment.`; }
  else if (!executable && !environment && (diagnostic.executables_any?.length ?? 0) > 0) { status = "runtime_not_detected"; action = `Install or expose ${diagnostic.host} on PATH, or configure its documented environment variable.`; }
  return {
    id: adapter.id, kind: adapter.kind, status, usable: asset.present && ["ready", "external_host_required"].includes(status),
    asset, runtime: { execution: diagnostic.execution ?? "unknown", host: diagnostic.host ?? null, executable, environment },
    capabilities: adapter.capabilities, note: diagnostic.note ?? null, recommended_action: action,
  };
}

export function adapterDiagnostics(id = null) {
  const adapters = id ? [adapterDetail(id)] : adapterCatalog().adapters;
  const results = adapters.map(diagnoseAdapter);
  return {
    generated_utc: new Date().toISOString(),
    summary: { total: results.length, ready: results.filter((item) => item.status === "ready").length, external_host_required: results.filter((item) => item.status === "external_host_required").length, unavailable: results.filter((item) => !item.usable).length },
    adapters: results,
    boundary: "Discovery proves local assets and runtime visibility only; licensed-host/API compatibility still requires an adapter acceptance run.",
  };
}
