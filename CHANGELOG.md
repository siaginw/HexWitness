# Changelog

## 1.0.1 — 2026-08-12

- Added verified npm and official MCP Registry discovery metadata.
- Declared the packaged stdio launch contract as `hexwitness agent`.
- Added release-time MCP Registry publication through GitHub OIDC.
- Made npm the primary installation path in public documentation.

## 1.0.0 — 2026-08-12

- Declared stable 1.x compatibility policies for CLI commands, REST v1, MCP tools, JSONL v1, and database schemas.
- Added the machine-readable `hexwitness contract` command, REST contract route, and MCP contract tool.
- Added fail-closed future database handling, tested schema migration, and consistent integrity-checked `hexwitness backup` snapshots.
- Added installed-package upgrade verification and a configurable concurrent daemon soak gate.
- Added CodeQL security analysis and tag-driven release packaging with SHA-256 checksums and GitHub build-provenance attestations.
- Unified the installed product behind one bundled `hexwitness` command with zero runtime npm dependencies.
- Updated all tailored agent skills and guides for the stable runtime and adapter-discovery contract.

## 0.6.0 — 2026-08-11

- Collapsed four public executables into one `hexwitness` command with `agent`, `mcp`, and `setup` subcommands.
- Added a bundled Node.js distribution; installed packages no longer expose the internal source-module tree.
- Added `hexwitness adapters [ID]` for machine-readable adapter discovery and exact installed paths.
- Kept Python isolated to vendor-native Binary Ninja, IDA, and Ghidra exporters.
- Updated setup-generated MCP entries to invoke the unified runtime.
- Extended the installed-package journey to assert the one-command surface and adapter discovery.
- Updated every tailored agent skill/guide to enforce the unified runtime and adapter-discovery contract.
- Added an explicit public-release versus production-1.0 readiness boundary.

## 0.5.0 — 2026-08-11

- Reframed the public experience around durable RE memory, reproducible proof, and agent-led workflows.
- Added an honest category comparison and machine-verifiable quality contract.
- Switched Binary Ninja setup to the vendor's official MCP endpoint, with a configurable community fallback.
- Added MCP read-only, non-destructive, idempotent, closed-world annotations to every query tool.
- Made `setup --json` fully non-interactive.
- Added `hexwitness --version`.
- Hardened capture privacy by recursively removing sensitive fields inside arrays.
- Rejects empty capture artifacts and rolls failed normalization back to a recoverable active pack.
- Added an installed-package journey covering CLI → DB → daemon autostart → MCP → evidence query.

## 0.4.0 — 2026-08-11

- Client-native HexWitness skills for Codex, Claude Code, Cursor, and GitHub Copilot.
- Tailored MCP guide resources for Claude Desktop and generic MCP agents.
- Safe skill updates with timestamped backups and installed-package discovery checks.

## 0.3.0 — 2026-08-11

- Interactive multi-client MCP setup wizard with safe backups, native client commands, viewer selection, and dry-run support.
- Autostart agent entrypoint eliminating the separate daemon-start step for MCP clients.
- One-command capture packaging from a conventional collector directory and `capture.json` manifest.

## 0.2.0 — 2026-08-11

- AI-first investigation, runtime comparison, and live-finding promotion MCP prompts.
- Goal-driven workflow guide with end-to-end reverse-engineering use cases.
- Optional Binary Ninja BinAssistMCP and IDA `idalib-mcp` integration recipes.
- Generic sealed capture packs with baseline roles, action markers, scenario gates, artifact hashes, audit, verification, and safe normalization.
- Runtime relationship graph, capture inventory, timelines, search, comparison, event-family deltas, and first-divergence analysis.
- Structured daemon query, class/object-model, UUID, type registry, function inventory, vtable, dataflow, slice, reach, coverage, and gap-worklist APIs.
- Expanded MCP and CLI parity for static and runtime investigations.
- Extended JSONL records for capture artifacts, markers, relationships, analysis slices, and persistent gaps.
- Deeper Binary Ninja, IDA, and Ghidra exports plus a generic narrow Frida observer.
- Machine-readable adapter, scenario, and capture-pack schemas.
- Target-agnostic capability matrix and complete capture-pack documentation.
- Visible durable-memory status across CLI, REST, and MCP, with explicit evidence-first reuse and privacy-separated activity history.

## 0.1.0 — 2026-08-11

- Generic, build-scoped SQLite evidence graph.
- Idempotent `hexwitness-jsonl-v1` ingestion.
- Query-only localhost REST daemon.
- Agent-first MCP server and investigation prompt.
- Entity dossiers, call graphs, xrefs, evidence, contradiction, and gap queries.
- Privacy-preserving operation retention.
- Binary Ninja, IDA, Ghidra, and Frida JSONL starter adapters.
- Synthetic end-to-end fixture, tests, public-data audit, and release documentation.
