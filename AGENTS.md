# HexWitness agent contract

HexWitness is an evidence index, not an oracle. Follow this sequence whenever investigating a binary:

1. Call `hexwitness_health`.
2. When diagnosing installation, compatibility, or automation, call `hexwitness_contract`; never depend on package-internal paths.
3. Call `hexwitness_memory_status`, then `hexwitness_builds`; reuse retained evidence before invoking a live viewer.
4. For multi-step work, create or resume a durable investigation and select the closest deterministic playbook. Read failed attempts before repeating a method.
5. Use discovery only to find candidates. Follow its exact query and inspect the source record before treating it as evidence.
6. Use `hexwitness_search` to resolve a name or address.
7. Use `hexwitness_explain` before requesting narrower graph traversals.
8. Use callers, callees, xrefs, paths, dataflow, and slices only after the entity is resolved.
9. Keep class, UUID, type, offset, metadata, and vtable queries scoped to the selected build.
10. For runtime behavior, inspect capture detail, markers, timeline, relationships, and positive/negative comparison.
11. Check `hexwitness_evidence`, `hexwitness_contradictions`, and `hexwitness_evidence_challenge` before stating a conclusion.
12. Label outputs as proven, strongly inferred, provisional, contradicted, or unknown.
13. When evidence is missing, request the smallest bounded export or runtime observation that can close the gap.
14. When a live Binary Ninja or IDA MCP server is available, use it only after the gap is explicit. Prefer read-only inspection, and never rename, patch, comment, or save without user authorization.
15. A live viewer result is provisional until a build-scoped exporter record is ingested and the result can be reconstructed from HexWitness alone.
16. Local analysis tools are agent-callable. Check `hexwitness_local_tool_status`, use `hexwitness_run_local_tool` only for the smallest necessary command, never pass secrets, and treat its output as an observation until independently promoted.
17. Diagnose Binary Ninja, IDA, Ghidra, and Frida through `hexwitness_adapter_diagnostics`. The user's AI host owns provider authentication; never request model API keys through HexWitness.

Never infer that two builds share addresses. Never treat a function name from one build as proof for another build. Never expose private payload bytes or credentials in claims, issues, commits, or chat.

## Good request

> On build `sha256:abc123`, explain `0x140012340`, list direct callers, and identify runtime evidence supporting the claim that it decodes message type 17.

## Bad request

> Search every database and guess what this function probably does.

## Missing-data response

Return:

- known evidence;
- uncertainty;
- exact missing artifact;
- recommended exporter/tool;
- minimum fields to collect;
- whether collection requires static export or controlled runtime capture.

## Agent-led request

Users should be able to state the goal, not a command sequence:

> Determine which function consumes the selected field, prove it against the failing runtime capture, and use the connected live viewer only if HexWitness memory is missing the decisive edge.

The agent owns build selection, evidence reuse, query order, viewer escalation, and the bounded promotion handoff.
