# Export adapters

Adapters emit newline-delimited `hexwitness-jsonl-v1` records. They never connect directly to the database.

| Adapter | Runs inside | Default export |
|---|---|---|
| `binary-ninja` | Binary Ninja Python console | Functions, strings, call edges, code references |
| `ida` | IDAPython | Functions and direct call edges |
| `ghidra` | Ghidra Script Manager | Functions and direct call edges |
| `frida-jsonl` | Node.js after a capture | Normalized runtime events |

All static exporters hash the input executable and include tool/version provenance. Executable bytes and vendor database files are never exported. Decompiled text is disabled by default.

Import output with:

```sh
hexwitness ingest program.exe.hexwitness.jsonl
```

See [Writing an adapter](../docs/ADAPTER-SDK.md) before expanding a vendor exporter.
