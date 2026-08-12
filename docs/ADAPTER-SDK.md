# Adapter SDK

Adapters translate one tool's output into portable HexWitness evidence. They never write SQLite directly.

## Contracts

- [`hexwitness-jsonl-v1`](../schemas/hexwitness-jsonl-v1.schema.json) — static and normalized runtime records;
- [`adapter-manifest-v1`](../schemas/adapter-manifest-v1.schema.json) — collector/exporter identity and capabilities;
- [`scenario-v1`](../schemas/scenario-v1.schema.json) — controlled action sequence and required evidence;
- [`capture-pack-v1`](../schemas/capture-pack-v1.schema.json) — sealed artifact manifest.

Runtime validation is fail-closed and canonicalizes addresses.

## Exporter rules

- Emit `build` first and hash the original artifact without embedding bytes.
- Use canonical lowercase hexadecimal addresses.
- Scope every entity to the exact build.
- Use stable keys such as `fn:0x140001000`, `str:0x140900000`, and `type:Widget`.
- Emit entities before edges when possible.
- Include exporter name, version, and analysis options.
- Keep decompiler text opt-in and bounded.
- Produce deterministic output where the vendor API permits.
- Export object-model members, blocks, control flow, and dataflow when the tool exposes them.
- Use `slice` for bounded IL, SSA, decompiler, codec, or block analysis.

## Core records

| Record | Purpose |
|---|---|
| `build`, `artifact` | Exact analyzed artifact and provenance |
| `entity`, `edge` | Static/runtime objects and graph relationships |
| `evidence`, `claim` | Observations and interpretations |
| `capture`, `event` | Controlled runtime session and ordered timeline |
| `capture_artifact`, `marker` | Pack files and operator actions |
| `relationship` | Runtime request/response, marker/event, or object correlation |
| `slice` | Bounded deep-analysis text or operations |
| `gap` | Prioritized missing evidence and collection recommendation |

## Minimal static stream

```jsonl
{"format":"hexwitness-jsonl-v1","record":"build","build_id":"sha256:abc123","label":"sample","sha256":"abc123...","architecture":"x86_64","image_base":"0x140000000","tool":"my-exporter"}
{"format":"hexwitness-jsonl-v1","record":"entity","build_id":"sha256:abc123","kind":"function","stable_key":"fn:0x140001000","name":"entry","address":"0x140001000"}
```

Edges refer to stable keys. Unresolved targets remain representable with source and target addresses, but exporters should emit discovered entities whenever possible.

## Runtime event

```json
{
  "ts_utc": "2026-01-01T00:00:00.000Z",
  "source": "debugger-hook",
  "kind": "call-enter",
  "name": "dispatch",
  "direction": "local",
  "address": "0x140001000",
  "thread_id": "42",
  "action_id": "perform-action",
  "fields": { "message_kind": 17, "correlation_id": 9001 }
}
```

Do not emit credentials, unrestricted memory, or raw proprietary payloads. Capture-pack normalization strips common secret keys and replaces raw payload-like fields with length and SHA-256.

## Semantics rule

Target-specific meaning stays in project adapters and evidence metadata. Promote a concept to a shared entity or edge kind only when it is generally useful across reverse-engineering projects. Unknown behavior remains unknown; an adapter must not guess.
