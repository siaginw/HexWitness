# HexWitness agent contract

HexWitness is an evidence index, not an oracle. Follow this sequence whenever investigating a binary:

1. Call `hexwitness_health`.
2. Call `hexwitness_builds`; select the exact build matching the user's artifact.
3. Use `hexwitness_search` to resolve a name or address.
4. Use `hexwitness_explain` before requesting narrower graph traversals.
5. Use callers, callees, xrefs, paths, dataflow, and slices only after the entity is resolved.
6. Keep class, UUID, type, offset, metadata, and vtable queries scoped to the selected build.
7. For runtime behavior, inspect capture detail, markers, timeline, relationships, and positive/negative comparison.
8. Check `hexwitness_evidence` and `hexwitness_contradictions` before stating a conclusion.
9. Label outputs as proven, strongly inferred, provisional, contradicted, or unknown.
10. When evidence is missing, request the smallest bounded export or runtime observation that can close the gap.

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
