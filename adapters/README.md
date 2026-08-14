# Export adapters

Adapters emit newline-delimited `hexwitness-jsonl-v1` records. They never connect directly to the database.

Discover their installed paths and capabilities without searching package files:

```sh
hexwitness adapters
hexwitness adapters binary-ninja
```

| Adapter | Runs inside | Default export |
|---|---|---|
| `binary-ninja` | Binary Ninja Python console | Functions, strings, imports, calls, references, blocks, types, fields, optional HLIL |
| `ida` | IDAPython | Functions, strings, imports, calls, code references, blocks, optional Hex-Rays pseudocode |
| `ghidra` | Ghidra Script Manager | Functions, strings, imports, calls, code references, blocks, types, fields, enums |
| `frida-jsonl` | Frida plus Node.js normalizer | Narrow semantic calls, markers, normalized runtime events |

All static exporters hash the input executable and include tool/version provenance. Executable bytes and vendor database files are never exported. Decompiled text is disabled by default. Set `HEXWITNESS_DECOMP=1` for Binary Ninja HLIL or IDA Hex-Rays slices when those licensed APIs are available.

The Frida observer uses the Frida 17 `Module.getGlobalExportByName` API. Its normalizer requires an original UTC timestamp for every event and applies the same recursive secret/payload sanitization as capture-pack normalization.

Import output with:

```sh
hexwitness ingest program.exe.hexwitness.jsonl
```

See [Writing an adapter](../docs/ADAPTER-SDK.md) before expanding a vendor exporter.

[`manifest.json`](manifest.json) is the machine-readable catalog. Third-party adapters use the public adapter-manifest schema and may provide wire observers, semantic observers, recorders, marker sources, or normalizers without changing core.
