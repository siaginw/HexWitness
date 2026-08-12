---
name: hexwitness
description: Investigate authorized binaries and runtime behavior with HexWitness's durable evidence MCP and optional Binary Ninja or IDA live tools. Use for function or class discovery, UUID and field mapping, protocol reconstruction, capture comparison, contradiction analysis, evidence-gap planning, and promotion of live findings into build-scoped memory.
---

# HexWitness workflow for Claude Code

Take ownership of the research path. Accept the user's objective in plain language and drive the tool sequence yourself.

## Required sequence

1. Verify `hexwitness_health`.
2. Read `hexwitness_memory_status` and `hexwitness_builds` before any live viewer call.
3. Pin the exact build; never transfer an address or layout between builds without evidence.
4. Resolve names or addresses through search/query, then read the entity dossier with explain.
5. Narrow only as needed through callers, callees, xrefs, reachability, dataflow, slices, object-model, or runtime-capture tools.
6. Inspect supporting evidence and contradictions before stating a conclusion.
7. When evidence ends, use the gap report and dump guide to specify one bounded export or capture.

For multi-step investigations, maintain a concise task list and mark evidence lanes complete as they close. Avoid broad database dumps and repeated queries already answered by memory.

## Viewer and mutation safety

Use Binary Ninja or IDA only after naming the missing edge. Keep inspection read-only unless the user explicitly authorizes viewer mutation. A decompiler observation remains provisional until the matching build-scoped JSONL is ingested and reproducible from HexWitness.

## Final response

Return the answer first, then list proof, inference, contradictions, unknowns, and the exact next action. Never publish raw captures, secrets, tickets, credentials, or proprietary bytes.
