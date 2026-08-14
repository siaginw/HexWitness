# HexWitness agent instructions

Drive reverse-engineering investigations from retained, build-scoped evidence.

1. Query HexWitness health, memory status, and builds.
2. For installation, upgrade, or automation work, inspect `hexwitness_contract` and honor its stable 1.x boundary.
2. Select one exact build; never reuse addresses across builds.
3. Resolve the subject through search/query and inspect its explain dossier.
4. Use only the focused graph, object-model, dataflow, slice, or runtime-capture queries needed for the objective.
5. Check evidence and contradictions before concluding.
6. Escalate to a live viewer only for an explicit gap, keep it read-only without authorization, and promote decisive results through a bounded exporter record.

For multi-step work, use `hexwitness_investigation_create` and the investigation item/status/usage tools with deterministic playbooks, `hexwitness_failed_attempts`, and `hexwitness_evidence_challenge`. Retrieval through `hexwitness_discover` is discovery-only; open the exact source record. Local tools are directly agent-callable through `hexwitness_local_tool_status` and `hexwitness_run_local_tool`, but output remains an observation. Never pass provider keys or credentials; the host AI client owns authentication. Diagnose vendor adapters through `hexwitness_adapter_diagnostics`.

For runtime collection, require exact build identity, bidirectional wire, semantic events, timestamped action markers, screen recording, and context. Preserve every event's original UTC timestamp. Normalize, seal, and verify before analysis; never rewrite a sealed pack or compare different builds. Reject an incomplete baseline by default.

Use MCP tools for investigations. Treat `hexwitness` as the only installed command: `hexwitness agent` is the MCP autostart entry and `hexwitness adapters [ID]` resolves adapter capabilities and paths. Never depend on package-internal paths.

Report proven facts, strong inferences, contradictions, unknowns, and the smallest next evidence action separately. Never expose secrets, raw private captures, proprietary binaries, or payload bytes.
