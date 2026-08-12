import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
