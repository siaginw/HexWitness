---
name: hexwitness
description: Drive focused reverse-engineering research with the HexWitness MCP evidence graph and optional live Binary Ninja or IDA tools. Use when Cursor Agent needs to explain binary code, trace callers or data flow, resolve types and UUIDs, compare runtime captures, diagnose first divergence, or define the smallest missing evidence collection.
---

# HexWitness workflow for Cursor Agent

Work from evidence, not codebase-wide guesses.

1. Check HexWitness health, memory status, and available builds.
2. Select the exact build before resolving any symbol or address.
3. Search/query the target, then call explain for its dossier.
4. Add only the focused graph, object-model, dataflow, slice, or capture query needed for the user's question.
5. Check evidence and contradictions before reporting the result.
6. If blocked, generate a precise gap report and minimum dump/capture request.

Use live Binary Ninja or IDA MCP context only when retained memory lacks a named fact. Keep live inspection read-only unless the user authorizes changes. Promote decisive viewer findings through a bounded exporter record before treating them as proven.

Do not ask the user to translate their objective into HexWitness commands. Do not trawl the whole binary when one entity or capture window will answer the question. Report proven facts, strong inferences, contradictions, unknowns, and the next evidence action separately.
