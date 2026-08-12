# What agents need from a binary

This guide defines useful evidence layers. Start small. Add richer layers only when the investigation needs them.

## Layer 0 — build identity (required)

Export once per analyzed artifact:

- SHA-256 of original executable or library;
- architecture and endianness;
- preferred image base;
- file size and human label;
- exporter name/version;
- analysis timestamp;
- loader options when they alter addresses.

Without this layer, addresses cannot be trusted or compared.

## Layer 1 — minimum static graph (recommended default)

- function start address, size, and stable key;
- discovered name and namespace;
- signature/calling convention when known;
- direct call edges;
- incoming and outgoing code references;
- strings with addresses and references;
- imports and exports.

This supports useful search, call-graph traversal, and most first-pass agent questions without exporting executable bytes.

## Layer 2 — structure and semantics

- user-defined and recovered types;
- class/vtable relationships;
- fields and offsets;
- globals and data references;
- basic-block summaries;
- switch/case targets;
- stack variables and parameter roles;
- confidence and source for renamed symbols.

Use this layer for object reconstruction, serialization, protocol work, and state-machine mapping.

## Layer 3 — decompiler text (opt-in)

Decompiler text greatly improves semantic search but may be sensitive or governed by the analyzed program's license. Keep it out of public fixtures. Enable it only for an authorized private evidence database.

When enabled, retain:

- exact build identity;
- function address;
- decompiler/tool version;
- analysis timestamp;
- text hash;
- optional text body.

## Layer 4 — runtime correlation

For each controlled run:

- capture/scenario ID;
- exact UTC start/end;
- build SHA-256;
- timestamped action markers;
- hook address and thread ID;
- direction and event name;
- decoded semantic fields;
- raw body length and SHA-256;
- confidence/classification;
- optional call stack addresses.

Raw bodies should remain in a private evidence store. The shareable graph needs hashes, lengths, decoded fields, and provenance.

## Layer 5 — claims

Claims are interpretations, not dumps. Each claim needs:

- build-scoped subject;
- predicate and value;
- status;
- confidence;
- supporting/opposing evidence IDs;
- author/tool provenance;
- update timestamp.

Conflicting claims must coexist until evidence resolves them.

## Never dump by default

- executable sections or large byte ranges;
- proprietary database files (`.bndb`, `.i64`, `.idb`, `.gzf`);
- credentials, session tokens, cookies, certificates, or authentication traffic;
- full process-memory dumps;
- raw packet bodies into a public repository;
- personal identifiers from screen recordings or logs;
- third-party symbols or source without redistribution rights.

## Decision table

| Question | Minimum useful layer |
|---|---|
| Who calls this function? | 0 + 1 |
| What field does this method update? | 0 + 1 + 2 |
| Does this request execute at runtime? | 0 + 1 + 4 |
| What does this unnamed function likely do? | 0 + 1; add 3 if authorized |
| Is this protocol field proven? | 0 + 2 + controlled 4 + claim |
| Did behavior change between builds? | Same layers for both builds, separately identified |
