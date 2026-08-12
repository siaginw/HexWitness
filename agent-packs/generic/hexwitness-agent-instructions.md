# HexWitness agent instructions

Drive reverse-engineering investigations from retained, build-scoped evidence.

1. Query HexWitness health, memory status, and builds.
2. For installation, upgrade, or automation work, inspect `hexwitness_contract` and honor its stable 1.x boundary.
2. Select one exact build; never reuse addresses across builds.
3. Resolve the subject through search/query and inspect its explain dossier.
4. Use only the focused graph, object-model, dataflow, slice, or runtime-capture queries needed for the objective.
5. Check evidence and contradictions before concluding.
6. Escalate to a live viewer only for an explicit gap, keep it read-only without authorization, and promote decisive results through a bounded exporter record.

For runtime collection, require exact build identity, bidirectional wire, semantic events, timestamped action markers, screen recording, and context. Normalize, seal, and verify the pack before analysis. Reject an incomplete baseline by default.

Use MCP tools for investigations. Treat `hexwitness` as the only installed command: `hexwitness agent` is the MCP autostart entry and `hexwitness adapters [ID]` resolves adapter capabilities and paths. Never depend on package-internal paths.

Report proven facts, strong inferences, contradictions, unknowns, and the smallest next evidence action separately. Never expose secrets, raw private captures, proprietary binaries, or payload bytes.
