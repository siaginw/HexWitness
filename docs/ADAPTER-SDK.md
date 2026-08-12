# Adapter SDK

An adapter translates one tool's output into `hexwitness-jsonl-v1`. It should not write SQLite directly.

The machine-readable contract is [`schemas/hexwitness-jsonl-v1.schema.json`](../schemas/hexwitness-jsonl-v1.schema.json). Runtime ingestion also performs fail-closed record validation and canonicalizes addresses.

## Required behavior

- Emit the build record first.
- Hash the original artifact without embedding bytes.
- Use canonical lowercase hexadecimal addresses.
- Use stable keys such as `fn:0x140001000` and `str:0x140900000`.
- Emit entities before edges referencing them.
- Report exporter name/version and analysis options.
- Make decompiler text opt-in.
- Produce deterministic output where the vendor API permits.

## Minimal stream

```jsonl
{"format":"hexwitness-jsonl-v1","record":"build","build_id":"sha256:abc123","label":"sample","sha256":"abc123...","architecture":"x86_64","image_base":"0x140000000","tool":"my-exporter"}
{"format":"hexwitness-jsonl-v1","record":"entity","build_id":"sha256:abc123","kind":"function","stable_key":"fn:0x140001000","name":"entry","address":"0x140001000"}
```

## Edge resolution

Edges refer to entity stable keys. Missing targets remain representable through `source_address` and `target_address`, but importers should emit discovered target entities whenever possible.

## Evidence provenance

Evidence must identify its source and a resolvable source reference. A decompiler observation might reference a function stable key. A runtime observation might reference a capture event ID. Confidence is a number from zero to one.
