---
name: hexwitness
description: Run build-scoped, evidence-first reverse-engineering investigations through the HexWitness MCP memory and optional live Binary Ninja or IDA viewers. Use when Codex must explain binary behavior, resolve functions/classes/UUIDs/fields, compare runtime captures, map protocol or data flow, find contradictions, identify missing proof, or promote a bounded live-viewer finding into durable evidence.
---

# HexWitness

Own the investigation. Translate the user's goal into evidence queries; do not make them provide CLI commands or addresses they do not know.

## Investigation order

1. Call `hexwitness_health`.
2. Call `hexwitness_memory_status`, then `hexwitness_builds`.
3. Select one exact build. Never reuse addresses across builds.
4. Resolve the target with `hexwitness_search` or `hexwitness_query`.
5. Read `hexwitness_explain` before traversing callers, callees, xrefs, paths, dataflow, slices, classes, UUIDs, fields, or vtables.
6. For runtime behavior, inspect capture detail and markers, then narrow timeline, search, graph, and comparison queries.
7. Check `hexwitness_evidence` and `hexwitness_contradictions` before concluding.
8. If proof is missing, call the gap and dump-guide tools. Request the smallest static export or controlled runtime observation that closes that exact gap.

## Live viewer escalation

- Query retained HexWitness memory first.
- Use a connected Binary Ninja or IDA MCP only for an explicit unresolved gap.
- Prefer read-only, narrowly bounded inspection.
- Do not rename, patch, comment, or save a viewer database without explicit user authorization.
- Treat live findings as provisional until build-scoped exporter evidence is ingested and re-queried from HexWitness.

## Reporting

Lead with the result. Separate:

- proven facts;
- strong inferences and their supporting evidence;
- contradictions;
- unknowns;
- the smallest next evidence action.

During longer work, send short commentary updates naming the current evidence lane. Never expose credentials, private payload bytes, proprietary binaries, or raw captures in chat, commits, or public artifacts.
