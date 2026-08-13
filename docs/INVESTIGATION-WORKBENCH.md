# Investigation workbench

HexWitness can now run the complete research loop without pretending retrieval or tool output is proof.

## Durable investigations

An investigation is pinned to one exact build and optionally seeded from a deterministic playbook: `binary`, `firmware`, `network`, `protocol`, or `runtime`.

```bash
hexwitness investigation create "Prove frame dispatch" --build sha256:abc --playbook protocol --budget 40
hexwitness investigation add INVESTIGATION evidence "Captured discriminator" --ref EVIDENCE_ID --required
hexwitness investigation item INVESTIGATION ITEM_ID done
hexwitness investigation use INVESTIGATION explain --units 1
hexwitness investigation show INVESTIGATION
```

Completion fails closed until every required check is done, at least one evidence/claim/capture is linked, and every linked gap is closed. Budgets measure explicit agent-operation units, not provider tokens or money. Staleness and exhausted budgets are warnings; they never manufacture completion.

## Failed-attempt memory

Record methods that did not work, their expected and actual results, the lesson, tool version, and supporting evidence:

```bash
hexwitness attempt record "decoder 17" --build sha256:abc \
  --method "assume field is little-endian" --expected "fixture parses" \
  --actual "fragment boundary shifts by two" --lesson "test mode byte first" \
  --tool tshark --tool-version 4.4 --evidence EVIDENCE_ID
```

Failed attempts remain searchable and appear in challenges. They are evidence about a failed method, not proof that every related hypothesis is false.

## Evidence challenge

```bash
hexwitness challenge --investigation INVESTIGATION_ID
hexwitness challenge "fn:0x140001000" --build sha256:abc
```

The challenge is deterministic. It gathers direct evidence, supporting and opposing claim links, unsupported claims, contradictions, open gaps, and prior failed attempts. It never changes confidence, treats agent agreement as evidence, or auto-promotes a result.

## Agent-callable local tools

Agents can run local reverse-engineering utilities directly:

```bash
hexwitness tool status
hexwitness tool run strings ./sample.bin
hexwitness tool run tshark -- -r ./trace.pcapng -Y "tcp"
```

No environment enable flag exists. Execution is a first-class local capability. The runtime still enforces:

- argv execution with no shell;
- a built-in executable allowlist plus real-path-checked project-local executables;
- a real-path boundary for the process working directory and identified input artifacts;
- timeout and output caps;
- credential-like argument rejection;
- removal of credential-shaped environment variables from the child process;
- executable path/hash/size/mtime, arguments, input hashes, timestamps, exit state, and output hash in the receipt.

This is a bounded command launcher, not an operating-system sandbox. A launched tool can access anything the current user can access; the root limits cwd selection and input-receipt accounting, not kernel filesystem authority. Interpreters such as Python and Node are allowlisted because agents and vendor tools rely on them. MCP annotations and client permission UX must reflect that truth.

MCP advertises `hexwitness_run_local_tool` as open-world, non-read-only, non-idempotent, and potentially destructive so an AI client can apply its own permission UX. Output is always an observation. It does not become a claim automatically. The executable hash/mtime and observation timestamp make stale-tool review possible. Set MCP `record=true` with an exact `build_id`, or use CLI `--record --build BUILD`, to retain only the bounded receipt as `tool-observation` evidence. Then challenge and promote it through normal claim/evidence links.

Provider credentials are not part of HexWitness. The selected AI client supplies its own model. Agent skills should diagnose viewer/runtime availability with `hexwitness_adapter_diagnostics`; they must never request or forward provider keys through MCP or local-tool arguments.

## Discovery-only retrieval

```bash
hexwitness discover "uniform scale actor" --build sha256:abc
hexwitness context "failed storage initialization" --build sha256:abc --max-chars 12000
```

The local FTS index retrieves entities, evidence, claims, capture events, investigations, and failed attempts. This is retrieval-augmented discovery, not semantic authority. Every result carries an exact follow-up query. The agent must open that source record, verify build identity and provenance, inspect freshness, and challenge the claim before relying on it.

## Local dashboard

Start `hexwitness serve`, then open `http://127.0.0.1:7878/dashboard`.

The dashboard is loopback-only and read-only. It shows health, investigation progress, adapter readiness, and discovery candidates. It has no mutation controls and cannot execute local tools.

## Deliberate omission: embedded agent swarm

HexWitness does not contain an internal planner/reviewer/executor swarm. Codex, Claude Code, Cursor, Copilot, and other MCP clients already orchestrate agents. Duplicating that layer would split authority, cost accounting, and audit history. Deterministic playbooks, persistent investigations, challenges, and receipts provide the useful coordination primitives without hiding another autonomous system inside the evidence store.
