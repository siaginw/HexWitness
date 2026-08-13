---
name: hexwitness
description: Run build-scoped, evidence-first reverse-engineering investigations through the HexWitness MCP memory and optional live Binary Ninja or IDA viewers. Use when Codex must explain binary behavior, resolve functions/classes/UUIDs/fields, compare runtime captures, map protocol or data flow, find contradictions, identify missing proof, or promote a bounded live-viewer finding into durable evidence.
---

# HexWitness

Own the investigation. Translate the user's goal into evidence queries; do not make them provide CLI commands or addresses they do not know.

## Investigation order

1. Call `hexwitness_health`.
2. For installation, upgrade, or automation questions, call `hexwitness_contract` and honor its 1.x boundary.
3. Call `hexwitness_memory_status`, then `hexwitness_builds`.
4. Select one exact build. Never reuse addresses across builds.
5. Resolve the target with `hexwitness_search` or `hexwitness_query`.
6. Read `hexwitness_explain` before traversing callers, callees, xrefs, paths, dataflow, slices, classes, UUIDs, fields, or vtables.
7. For runtime behavior, inspect capture detail and markers, then narrow timeline, search, graph, and comparison queries.
8. Check `hexwitness_evidence` and `hexwitness_contradictions` before concluding.
9. If proof is missing, call the gap and dump-guide tools. Request the smallest static export or controlled runtime observation that closes that exact gap.

For multi-step work, use `hexwitness_investigations` to resume matching work or `hexwitness_investigation_create` with a deterministic playbook, then maintain item/status/usage state. Inspect `hexwitness_failed_attempts` and run `hexwitness_evidence_challenge` before completion. Discovery/context results only suggest candidates; follow their exact source query. Local tools are directly agent-callable through `hexwitness_local_tool_status` and `hexwitness_run_local_tool`; use the smallest argv-only command, never pass secrets, and treat output as an observation until promoted. Diagnose vendor runtimes with `hexwitness_adapter_diagnostics`; Codex owns model authentication, so never route provider keys through HexWitness.

For a new runtime capture, require build identity, bidirectional wire evidence, semantic events, timestamped action markers, screen recording, and context. Reject an incomplete baseline unless the user explicitly requests an exploratory pack. Normalize and seal before drawing conclusions from it.

## Runtime contract

- Use MCP tools for investigations. Use the CLI only for setup, diagnostics, import, and capture lifecycle work.
- Treat `hexwitness` as the only installed command. MCP autostart is `hexwitness agent`; adapter discovery is `hexwitness adapters [ID]`.
- Never depend on package-internal source, distribution, or wrapper paths. Resolve adapters through the catalog.

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
