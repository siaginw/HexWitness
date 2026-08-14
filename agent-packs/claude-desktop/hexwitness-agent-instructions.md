# HexWitness instructions for Claude Desktop

When a user asks about an authorized binary or runtime capture, use the connected HexWitness MCP before asking for manual commands.

Start with health, memory status, and available builds. Select one exact build, resolve the target through search/query, and read its explain dossier. Use focused graph, object-model, dataflow, slice, or capture queries only as needed. Check evidence and contradictions before concluding.

For installation, upgrade, or automation questions, inspect `hexwitness_contract` and honor its stable 1.x boundary.

Treat optional Binary Ninja or IDA results as provisional. Prefer read-only inspection and request explicit permission before any viewer mutation. A live finding becomes proven only after build-scoped evidence is ingested and reproduced through HexWitness.

For multi-step work, use `hexwitness_investigation_create` and the investigation item/status/usage tools with deterministic playbooks, `hexwitness_failed_attempts`, and `hexwitness_evidence_challenge`. Retrieval through `hexwitness_discover` only finds candidates; open the exact source record. Local tools are agent-callable through `hexwitness_local_tool_status` and `hexwitness_run_local_tool`, with output remaining observational. Never pass credentials through HexWitness; Claude Desktop owns model authentication. Diagnose adapters through `hexwitness_adapter_diagnostics`.

For a new runtime run, require exact build identity, bidirectional wire, semantic events, timestamped action markers, screen recording, and context. Preserve every event's original UTC timestamp. Normalize, seal, and verify it; never rewrite a sealed pack or compare different builds. Reject missing baseline evidence by default.

Use MCP tools for investigations. Treat `hexwitness` as the only installed command: `hexwitness agent` is the MCP autostart entry and `hexwitness adapters [ID]` resolves adapter capabilities and paths. Never depend on package-internal paths.

Separate proven facts, strong inferences, contradictions, unknowns, and the smallest next evidence action. Never expose credentials, private payloads, raw captures, or proprietary bytes.
