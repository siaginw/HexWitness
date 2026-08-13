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
  G -->|"explicit local-tool call"| T["Allowlisted RE utilities"]
  T -->|"observation receipt"| G
  D --> U["Loopback read-only dashboard"]
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
- **Importer** owns structured evidence ingestion. The only additional mutation path is explicit build-bound recording of a local-tool receipt as observation evidence.
- **Daemon** exposes read-only queries.
- **MCP** mirrors daemon evidence queries, exposes truthful closed-world investigation-ledger mutations, and provides one clearly annotated local-process capability. Tool receipts remain observations and never bypass provenance rules.
- **Activity DB** is separate from evidence. It can be deleted without affecting analysis.

## Memory model

The evidence database is durable semantic memory: imported facts, relationships, captures, claims, and provenance survive viewer and agent restarts. The activity database is operational history only: hashed arguments, timing, status, and counts. It intentionally cannot reconstruct sensitive queries or returned evidence.

Live viewer calls are not silently cached. Promotion is explicit—export a bounded result through an adapter, ingest it transactionally, then query it through the daemon. This keeps retention reviewable while ensuring previously promoted work is reused first.

## Why SQLite

Reverse-engineering evidence is local, relational, highly queryable, and usually read-heavy. SQLite provides transactions, indexes, portable single-file storage, and simple backup without operating a separate database service. The interchange format prevents lock-in: rebuild the index from JSONL exports at any time.

Entity and normalized-event text use FTS5 indexes. A cross-record discovery index covers entities, evidence, claims, capture events, investigations, and failed attempts. Discovery results carry no factual authority; they point agents to exact records. One-time migration backfills existing databases; triggers maintain indexes.

Schema changes are versioned. Current schema 3 adds durable investigations, failed-attempt memory, operation usage, and cross-record discovery. Migrations require a writable open, retain imported evidence, and reject future schema versions without mutation. Read-only services refuse a database that still needs migration. `hexwitness backup OUTPUT` creates and integrity-checks a consistent SQLite snapshot before an upgrade.

## Stable identity

Binary addresses are strings because 64-bit virtual addresses exceed JavaScript's safe integer range. Entity identity is `build_id + stable_key`. Import-generated IDs are deterministic hashes, making repeated imports idempotent.

## Generic integration boundary

Target knowledge stays outside core. A project supplies symbols, UUID registries, schemas, semantic hooks, decoders, and controlled observations through adapters. Core provides durable storage, graph semantics, validation, comparison, querying, and agent access without knowing what the target is.
