# HexWitness agent contract

HexWitness is an evidence index, not an oracle. Follow this sequence whenever investigating a binary:

1. Call `hexwitness_health`.
2. When diagnosing installation, compatibility, or automation, call `hexwitness_contract`; never depend on package-internal paths.
3. Call `hexwitness_memory_status`, then `hexwitness_builds`; reuse retained evidence before invoking a live viewer.
4. Use `hexwitness_search` to resolve a name or address.
5. Use `hexwitness_explain` before requesting narrower graph traversals.
6. Use callers, callees, xrefs, paths, dataflow, and slices only after the entity is resolved.
7. Keep class, UUID, type, offset, metadata, and vtable queries scoped to the selected build.
8. For runtime behavior, inspect capture detail, markers, timeline, relationships, and positive/negative comparison.
9. Check `hexwitness_evidence` and `hexwitness_contradictions` before stating a conclusion.
10. Label outputs as proven, strongly inferred, provisional, contradicted, or unknown.
11. When evidence is missing, request the smallest bounded export or runtime observation that can close the gap.
12. When a live Binary Ninja or IDA MCP server is available, use it only after the gap is explicit. Prefer read-only inspection, and never rename, patch, comment, or save without user authorization.
13. A live viewer result is provisional until a build-scoped exporter record is ingested and the result can be reconstructed from HexWitness alone.

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
