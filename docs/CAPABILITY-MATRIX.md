# Generic parity contract

HexWitness reproduces the reusable workflow of a mature reverse-engineering evidence daemon without embedding any one project's binaries, addresses, packet layouts, probes, or private captures.

"Parity" means the same investigation can be expressed, retained, queried, compared, and handed to another agent. It does not mean bundling proprietary tool APIs or a target-specific knowledge corpus.

## Capability coverage

| Workflow | Public HexWitness contract | Status |
|---|---|---|
| Exact build identity | SHA-256, architecture, image base, tool/version, immutable `build_id` | Complete |
| Static entity index | Functions, methods, symbols, strings, imports, globals, classes, types, fields, enums, blocks, vtables, slots | Complete |
| Graph index | Calls, code/data references, control flow, ownership, inheritance, type, vtable, and dataflow edges | Complete |
| Deep analysis | Bounded decompiler/IL/SSA/basic-block slices linked to build and entity | Complete |
| Search and dossier | FTS-backed search, structured query, explain, callers, callees, xrefs, bounded reach, shortest path | Complete |
| Object model | Class detail, type registry, UUID/GUID, offsets, metadata/hash/asset/codec lookup, vtable slots | Complete |
| Build evolution | Stable-entity additions, removals, signature changes, and address movement | Complete |
| Evidence discipline | Provenance, confidence, supporting/opposing evidence, claims, contradictions | Complete |
| Evidence gaps | Per-entity gap report plus persistent prioritized worklist | Complete |
| Runtime capture | Build-bound capture, ordered events, directions, hashes, fields, markers | Complete |
| Sealed capture packs | Baseline roles, scenario gates, artifact hashes, audit, normalization, verification | Complete |
| Runtime graph | Correlation, request/response, marker/event, and object-observation relationships | Complete |
| Capture analysis | List, detail, timeline, search, graph, family deltas, first divergence | Complete |
| Coverage | Static depth, evidence classes, runtime captures, open gaps | Complete |
| Agent API | Read-only REST daemon, route manifest, MCP tools, investigation/runtime-comparison/live-promotion prompts | Complete |
| Live viewer orchestration | Memory-first policy and integration recipes for Binary Ninja and IDA MCP bridges | Complete contract; third-party viewer compatibility varies |
| Durable memory | Evidence-first reuse, visible memory status, idempotent promotion, privacy-separated activity history | Complete |
| Human API | CLI for ingest, query, object model, graph, capture lifecycle, compare, and doctor | Complete |
| Static tool bridges | Binary Ninja, IDA, and Ghidra exporters through vendor-neutral JSONL | Complete contract; compatibility varies by vendor version |
| Runtime tool bridge | Generic narrow Frida observer and arbitrary JSONL normalizer | Complete contract |
| External baseline collectors | Adapter manifest supports wire observers, semantic observers, recorders, markers, and normalizers | Complete contract; collectors remain user-supplied |
| Privacy boundary | Local read-only daemon, safe activity log, payload hashing, secret stripping, public audit | Complete |

## Intentional boundaries

- No game, application, protocol, operating-system service, or vendor database is hard-coded.
- No executable, DLL, packet capture, memory dump, credentials, or private evidence ships in the repository.
- HexWitness never guesses target semantics. A target project supplies dictionaries, hooks, decoder schemas, and captures through adapters.
- Vendor mutation—renaming, patching, commenting, saving a proprietary analysis database—stays in the vendor tool. HexWitness stores the resulting durable evidence.
- A baseline collector can be a DLL, debugger plugin, proxy, ETW/eBPF consumer, or another authorized observer. It must emit the adapter contract; it is not part of the core.

## Acceptance definition

A generic workflow reaches parity when it can:

1. identify one exact build;
2. ingest static structure from at least one supported RE tool;
3. collect an isolated runtime scenario with all baseline artifact roles;
4. reject an incomplete pack unless explicitly sealed as incomplete;
5. normalize evidence without retaining raw payloads or secrets;
6. reconstruct a searchable timeline and relationship graph;
7. compare a positive and negative run and locate the first divergence;
8. query the same facts through CLI, REST, and MCP;
9. surface contradictions and the smallest remaining evidence gap;
10. recreate the SQLite index from portable JSONL and sealed pack artifacts.

Automated tests cover these public contracts with synthetic evidence. Real-tool compatibility remains bounded by the versions listed in future compatibility reports.
