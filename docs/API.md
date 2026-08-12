# HTTP API

The daemon exposes read-only JSON. Ingestion and capture mutation remain local CLI operations.

Base URL: `http://127.0.0.1:7878`

## Core and static analysis

| Path | Key parameters | Result |
|---|---|---|
| `/v1/health` | — | Service, version, database, indexed counts |
| `/v1/routes` | — | Machine-readable route manifest |
| `/v1/memory` | — | Durable evidence counts, size, latest ingest/capture, reuse and activity policy |
| `/v1/builds` | — | Exact builds and provenance |
| `/v1/builds/compare` | `left`, `right`, `limit` | Cross-build stable-entity diff |
| `/v1/stats` | — | All evidence-table counts |
| `/v1/search` | `q`, `build_id`, `kind`, `limit` | Entity resolution |
| `/v1/query` | `q`, `build_id`, `kinds`, `edge_kinds`, coverage flags | Safe structured cross-index query |
| `/v1/explain` | entity selector | Full evidence dossier |
| `/v1/callers`, `/v1/callees` | entity selector, `limit` | Direct call edges |
| `/v1/xrefs` | entity selector, `limit` | Incoming and outgoing references |
| `/v1/reach` | entity selector, `direction`, `kind`, `depth`, `limit` | Bounded graph traversal |
| `/v1/dataflow` | entity selector, `direction`, `depth`, `limit` | Reads/writes/defines/uses/alias flow |
| `/v1/slices` | entity selector, `kind`, `limit` | IL/SSA/decompiler/block analysis slices |
| `/v1/functions` | `build_id`, `q`, `named`, `limit` | Function inventory |
| `/v1/classes` | `build_id`, `q`, `limit` | Object-model search |
| `/v1/class` | `build_id`, `name` or stable selector | Class members and relationships |
| `/v1/vtable` | entity selector, `limit` | Vtable slots and functions |
| `/v1/uuid` | `uuid`, `build_id`, `limit` | UUID/GUID resolution |
| `/v1/types` | `build_id`, `q`, `kind`, `limit` | Type registry |
| `/v1/offsets` | `build_id`, `owner`, `q`, `limit` | Field offsets |
| `/v1/metadata` | `q`, `build_id`, `kinds`, `limit` | Generic hash/asset/codec/ID metadata lookup |
| `/v1/decomp/search` | `build_id`, `q`, `kind`, `limit` | Decompiled text and bounded-slice search |
| `/v1/path` | build plus from/to selectors, `kind`, `depth` | Shortest graph path |
| `/v1/edges/kinds` | `build_id` | Relationship taxonomy and coverage |

An entity selector contains `entity_id`, `stable_key`, or `address`; add `build_id` whenever more than one build may match.

## Evidence and worklists

| Path | Parameters | Result |
|---|---|---|
| `/v1/evidence` | `build_id`, `source`, `classification`, `limit` | Provenance-bearing observations |
| `/v1/contradictions` | `build_id`, `limit` | Active incompatible claims |
| `/v1/gaps` | entity selector, `objective` | Smallest missing evidence for one entity |
| `/v1/gaps/worklist` | `build_id`, `capture_id`, `status`, `limit` | Persistent prioritized gaps |
| `/v1/coverage` | `build_id` | Static, evidence, and runtime coverage |
| `/v1/guide/dump` | `objective` | Vendor-neutral collection checklist |

## Capture analysis

| Path | Parameters | Result |
|---|---|---|
| `/v1/captures` | `build_id`, `scenario`, `status`, `limit` | Capture inventory and counts |
| `/v1/captures/detail` | `capture_id` | Manifest metadata, artifacts, markers, relationships, event families |
| `/v1/captures/timeline` | `capture_id`, `after`, source/kind/name filters | Ordered normalized events |
| `/v1/captures/search` | `q`, `capture_id`, `direction`, `kind`, `limit` | Safe event-field search |
| `/v1/captures/graph` | `capture_id`, `kind`, `limit` | Runtime relationship graph |
| `/v1/captures/compare` | `left`, `right` | Event-family deltas and first divergence |

## Authentication and errors

The default localhost bind needs no token. If `HEXWITNESS_API_TOKEN` is set, every request sends:

```http
Authorization: Bearer YOUR_TOKEN
```

- `400` — invalid/ambiguous selector or query;
- `401` — missing or incorrect configured token;
- `404` — route or entity absent;
- `405` — mutation attempted against the read-only daemon.

Responses use `application/json` and `Cache-Control: no-store`.
