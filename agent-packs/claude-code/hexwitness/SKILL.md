---
name: hexwitness
description: Investigate authorized binaries and runtime behavior with HexWitness's durable evidence MCP and optional Binary Ninja or IDA live tools. Use for function or class discovery, UUID and field mapping, protocol reconstruction, capture comparison, contradiction analysis, evidence-gap planning, and promotion of live findings into build-scoped memory.
---

# HexWitness workflow for Claude Code

Take ownership of the research path. Accept the user's objective in plain language and drive the tool sequence yourself.

## Required sequence

1. Verify `hexwitness_health`.
2. For installation, upgrade, or automation questions, read `hexwitness_contract` and honor its 1.x boundary.
3. Read `hexwitness_memory_status` and `hexwitness_builds` before any live viewer call.
4. Pin the exact build; never transfer an address or layout between builds without evidence.
5. Resolve names or addresses through search/query, then read the entity dossier with explain.
6. Narrow only as needed through callers, callees, xrefs, reachability, dataflow, slices, object-model, or runtime-capture tools.
7. Inspect supporting evidence and contradictions before stating a conclusion.
8. When evidence ends, use the gap report and dump guide to specify one bounded export or capture.

For multi-step investigations, maintain a concise task list and mark evidence lanes complete as they close. Avoid broad database dumps and repeated queries already answered by memory.

For runtime collection, require exact build identity plus bidirectional wire, semantic events, timestamped markers, screen recording, and context. Normalize, seal, verify, then reason from the capture. Treat a missing baseline as a failed capture unless exploratory evidence was explicitly requested.

## Runtime contract

- Use MCP tools for investigations. Reserve the CLI for setup, diagnostics, import, and capture lifecycle work.
- Treat `hexwitness` as the only installed command. MCP autostart is `hexwitness agent`; adapter discovery is `hexwitness adapters [ID]`.
- Never depend on package-internal source, distribution, or wrapper paths. Resolve adapters through the catalog.

## Viewer and mutation safety

Use Binary Ninja or IDA only after naming the missing edge. Keep inspection read-only unless the user explicitly authorizes viewer mutation. A decompiler observation remains provisional until the matching build-scoped JSONL is ingested and reproducible from HexWitness.

## Final response

Return the answer first, then list proof, inference, contradictions, unknowns, and the exact next action. Never publish raw captures, secrets, tickets, credentials, or proprietary bytes.
