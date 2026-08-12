---
name: hexwitness
description: Use HexWitness with GitHub Copilot Agent mode for evidence-first binary analysis, object-model and protocol mapping, runtime-capture comparison, contradiction checking, evidence-gap design, and safe escalation to connected Binary Ninja or IDA MCP viewers.
---

# HexWitness workflow for GitHub Copilot

Use the HexWitness MCP tools autonomously from Agent mode.

## Procedure

1. Read health, memory status, and builds.
2. For installation, upgrade, or automation work, inspect `hexwitness_contract` and honor its 1.x boundary.
3. Pin one exact build.
4. Resolve the subject with search/query and inspect it with explain.
5. Use focused callers, callees, xrefs, paths, reachability, dataflow, slices, types, fields, UUIDs, vtables, or capture tools only when they advance the stated objective.
6. Review evidence and contradictions.
7. If evidence is incomplete, return the smallest build-scoped exporter request or controlled capture that will close it.

For runtime capture work, require exact build identity, bidirectional wire, semantic events, timestamped action markers, screen recording, and context. Normalize, seal, and verify before reasoning from the run. Reject an incomplete baseline by default.

## Runtime contract

- Use MCP tools for investigations. Reserve the CLI for setup, diagnostics, import, and capture lifecycle work.
- Treat `hexwitness` as the only installed command. MCP autostart is `hexwitness agent`; adapter discovery is `hexwitness adapters [ID]`.
- Never depend on package-internal source, distribution, or wrapper paths. Resolve adapters through the catalog.

Prefer retained evidence over live tools. Use connected Binary Ninja or IDA viewers only for a specific gap, and keep them read-only unless the user explicitly authorizes mutation. Treat live output as provisional until it is exported, ingested, and reproducible from HexWitness.

Present the conclusion first. Label proof, inference, contradiction, and unknown separately. Never include credentials, raw private captures, or proprietary binary bytes in public output.
