# Architecture

```mermaid
flowchart LR
  A["Static-analysis adapters"] --> J["hexwitness-jsonl-v1"]
  R["Runtime adapters"] --> P["Sealed capture pack"]
  P --> J
  J --> V["Validator + idempotent importer"]
  V --> E["Evidence SQLite DB"]
  E --> D["Read-only local daemon"]
  D --> H["REST clients"]
  D --> M["MCP stdio adapter"]
  M --> G["Coding agents"]
  D --> L["Privacy-preserving activity DB"]
```

## Distribution boundary

Source remains modular for review and testing. Release builds bundle the Node.js core, daemon, MCP transport, setup wizard, and CLI into `dist/hexwitness.mjs`. The installed package exposes that file through one `hexwitness` command and installs no runtime npm dependency tree.

Viewer exporters remain separate adapter assets because Binary Ninja, IDA, and Ghidra execute extensions inside their own runtimes. `hexwitness adapters [ID]` is the stable discovery boundary; users and agents do not need to know the package layout.

## Boundaries

- **Adapters** know vendor APIs. Core does not.
- **Distribution** exposes one command while preserving replaceable adapters.
- **JSONL** is the stable interchange boundary.
- **Capture packs** keep baseline artifacts, markers, hashes, quality gates, and normalized evidence together.
- **Importer** is the only standard component that mutates evidence state.
- **Daemon** exposes read-only queries.
- **MCP** mirrors daemon semantics. It never bypasses provenance rules.
- **Activity DB** is separate from evidence. It can be deleted without affecting analysis.

## Memory model

The evidence database is durable semantic memory: imported facts, relationships, captures, claims, and provenance survive viewer and agent restarts. The activity database is operational history only: hashed arguments, timing, status, and counts. It intentionally cannot reconstruct sensitive queries or returned evidence.

Live viewer calls are not silently cached. Promotion is explicit—export a bounded result through an adapter, ingest it transactionally, then query it through the daemon. This keeps retention reviewable while ensuring previously promoted work is reused first.

## Why SQLite

Reverse-engineering evidence is local, relational, highly queryable, and usually read-heavy. SQLite provides transactions, indexes, portable single-file storage, and simple backup without operating a separate database service. The interchange format prevents lock-in: rebuild the index from JSONL exports at any time.

Entity and normalized-event text use FTS5 indexes with ordinary indexed-query fallback. The one-time schema migration backfills existing databases; later idempotent imports maintain both indexes through triggers.

Schema changes are versioned. HexWitness 1.0 migrates schema 1 to schema 2 only through a writable open, retains imported evidence, and rejects future schema versions without mutation. Read-only services refuse a database that still needs migration, producing an actionable error instead of querying a partial shape. `hexwitness backup OUTPUT` creates and integrity-checks a consistent SQLite snapshot before an upgrade.

## Stable identity

Binary addresses are strings because 64-bit virtual addresses exceed JavaScript's safe integer range. Entity identity is `build_id + stable_key`. Import-generated IDs are deterministic hashes, making repeated imports idempotent.

## Generic integration boundary

Target knowledge stays outside core. A project supplies symbols, UUID registries, schemas, semantic hooks, decoders, and controlled observations through adapters. Core provides durable storage, graph semantics, validation, comparison, querying, and agent access without knowing what the target is.
