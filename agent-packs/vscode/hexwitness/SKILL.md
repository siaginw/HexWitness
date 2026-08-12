---
name: hexwitness
description: Use HexWitness with GitHub Copilot Agent mode for evidence-first binary analysis, object-model and protocol mapping, runtime-capture comparison, contradiction checking, evidence-gap design, and safe escalation to connected Binary Ninja or IDA MCP viewers.
---

# HexWitness workflow for GitHub Copilot

Use the HexWitness MCP tools autonomously from Agent mode.

## Procedure

1. Read health, memory status, and builds.
2. Pin one exact build.
3. Resolve the subject with search/query and inspect it with explain.
4. Use focused callers, callees, xrefs, paths, reachability, dataflow, slices, types, fields, UUIDs, vtables, or capture tools only when they advance the stated objective.
5. Review evidence and contradictions.
6. If evidence is incomplete, return the smallest build-scoped exporter request or controlled capture that will close it.

Prefer retained evidence over live tools. Use connected Binary Ninja or IDA viewers only for a specific gap, and keep them read-only unless the user explicitly authorizes mutation. Treat live output as provisional until it is exported, ingested, and reproducible from HexWitness.

Present the conclusion first. Label proof, inference, contradiction, and unknown separately. Never include credentials, raw private captures, or proprietary binary bytes in public output.
