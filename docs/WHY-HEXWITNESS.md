# Why HexWitness

HexWitness is not another decompiler and not a chat history database. It is the durable evidence layer between reverse-engineering tools and AI agents.

## The missing layer

A live viewer answers, “What does this database show right now?”

HexWitness answers:

- Which exact build did this finding come from?
- What static and runtime evidence supports it?
- Which claims disagree?
- Did the same object change in another build?
- Can a different agent reproduce the answer without repeating the live analysis?
- What is the smallest missing observation if proof is incomplete?

The distinction matters because MCP tools are model-controlled interfaces, not durable project knowledge by themselves. The [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture) defines tools, resources, and prompts; each server decides what state it owns. HexWitness owns a build-scoped RE evidence model and makes its retention rules explicit.

## Category comparison

This table compares jobs, not brands.

| Category | Best at | Retention model | Native RE structure | Runtime comparison | HexWitness relationship |
|---|---|---|---|---|---|
| Disassembler/decompiler | Static analysis and interactive exploration | Vendor database | Excellent | Tool-dependent | Evidence source |
| Viewer MCP | Giving an agent live tool access | Usually current viewer/session | Excellent | Tool-dependent | Optional live eyes |
| Debugger or tracer | Observing one execution | Logs and traces | Runtime-first | Manual or tool-dependent | Evidence source |
| Notes/wiki | Human explanation | Documents | Informal | Manual | Can link or summarize results |
| General agent memory | Broad context and preferences | Product-specific memory | Generic | Generic | Complementary |
| HexWitness | Reproducible evidence continuity | Portable JSONL plus SQLite index | Build, address, graph, type, claim, capture, provenance | First-class timeline, graph, and divergence | Durable case file |

## Why pair it with a viewer MCP

Viewer MCP projects already expose rich live analysis. Binary Ninja now ships an [official read-oriented MCP server](https://dev-docs.binary.ninja/guide/mcp.html). The [IDA Pro MCP project](https://github.com/mrexodia/ida-pro-mcp) is built by mrexodia and [endorsed by Hex-Rays](https://hex-rays.com/recon-montreal-2026).

Reimplementing those viewer APIs inside HexWitness would create a smaller, more fragile viewer.

The stronger pairing:

1. HexWitness searches retained evidence.
2. Agent identifies one missing fact.
3. Viewer MCP inspects only that scope.
4. Vendor-native exporter promotes the reviewed result.
5. HexWitness verifies and retains it for the next investigation.

Live access stays live. Durable proof stays portable.

## What is actually different

### Exact builds are mandatory

Addresses, field offsets, vtable slots, and decompiler output can change between builds. HexWitness keys entities by build plus stable identity and refuses ambiguous address resolution.

### Evidence and conclusions are separate

An observation is evidence. An interpretation is a claim. Supporting and opposing evidence can coexist, so disagreement remains queryable instead of being overwritten.

### Static and runtime work share one graph

Functions, types, calls, fields, events, markers, requests, responses, and runtime objects can be traversed through one vocabulary. A capture divergence can lead back to its static consumer.

### Missing proof is useful output

`gap_report` and `dump_guide` turn uncertainty into a bounded work order. The agent asks for one function, type, slice, or controlled runtime action instead of another whole-database dump.

### Capture quality is enforceable

A capture pack can require bidirectional traffic, semantic events, action markers, screen recording, and context. HexWitness checks presence, non-empty artifacts, time markers, hashes, normalization, and sealed integrity.

### Memory remains reviewable

HexWitness does not silently cache every proprietary viewer response. Evidence becomes durable through explicit import. Operational activity stores hashes and counts, not prompts or returned evidence.

## When HexWitness is the better fit

Use it when work spans builds, agents, tools, or days; when runtime and static evidence must line up; or when conclusions need provenance.

Skip it when:

- one quick live lookup is enough;
- no finding needs to survive the current session;
- a normal debugger log already answers the whole question;
- you want an AI to mutate a viewer but do not need a durable evidence trail.

HexWitness adds discipline. Small investigations do not always need it.

## Claims you can verify

The public repository ships synthetic tests for importer idempotency, address safety, graph queries, class and UUID lookup, capture sealing, secret redaction, runtime comparison, contradiction handling, durable investigations, failed-attempt memory, evidence challenges, discovery-only retrieval, local execution receipts, daemon/dashboard read-only behavior, MCP discovery, setup installation, package contents, and the installed CLI → DB → daemon → MCP path.

See [Quality](QUALITY.md) for exact gates and [Capability matrix](CAPABILITY-MATRIX.md) for intentional boundaries.
