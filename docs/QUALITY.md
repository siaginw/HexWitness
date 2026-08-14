# Quality contract

HexWitness publishes only claims that have a visible test, audit, or documented compatibility boundary.

## Release gates

| Gate | What it proves |
|---|---|
| `npm run check` | Syntax, local documentation links, and full Node test suite |
| `npm run test:coverage` | Coverage report for core, interfaces, setup, and adapters |
| `npm run public:audit` | No obvious credentials, private paths, proprietary binary formats, captures, dumps, oversized payloads, or target-specific corpus references |
| `npm audit --audit-level=high` | No known high-or-critical npm dependency advisory in the resolved tree |
| `npm run test:package` | Packed artifact installs in isolation, exposes one executable with no runtime dependency tree or source internals, discovers adapters, executes the installed Frida normalizer, and completes CLI → DB → daemon autostart → MCP → evidence query |
| `npm run test:upgrade` | Installed 1.0 migrates a schema-1 database without evidence loss and creates a verified backup |
| `npm run test:load` | Mixed concurrent read-only daemon queries complete without request failures |
| `npm run test:scale` | A generated large static export streams through atomic ingest and indexed UUID lookup with exact counts |
| `npm run release:check` | Runtime, package, changelog, and release tag versions agree |
| CodeQL | JavaScript security-extended analysis on pushes, pull requests, and a weekly schedule |
| Tagged release | Release archive, CycloneDX SBOM, SHA-256 manifest, and GitHub provenance/SBOM attestations |
| CI matrix | Node 22 and 24 on current Ubuntu, Windows, and macOS runners |

Run the same gates locally:

```bash
npm ci
npm run check
npm run test:coverage
npm run public:audit
npm audit --audit-level=high
npm run test:package
npm run test:upgrade
npm run test:load
npm run test:scale
npm run release:check
```

## Connected-system coverage

The automated suite checks these boundaries together:

1. Synthetic JSONL validates and imports transactionally.
2. Repeated import remains idempotent.
3. SQLite preserves canonical 64-bit addresses and exact build scope.
4. CLI creates demo state and diagnoses it.
5. Unified `hexwitness agent` starts a missing local daemon.
6. MCP evidence tools advertise read-only annotations; investigation-ledger mutations advertise closed-world write effects; the isolated local executor advertises its open-world and non-idempotent boundary truthfully.
7. MCP queries the same database created by the installed CLI.
8. Setup installs client-tailored guidance and preserves existing configuration through backups.
9. Capture packaging detects the standard artifact set, rejects missing or empty baseline data, normalizes secrets recursively, seals hashes, verifies integrity, and imports.
10. A normalization failure rolls the pack back to an active, recoverable state.
11. The installed tarball contains one bundled runtime, one command, and discoverable vendor adapters without shipping the internal source/test tree.
12. Every native agent skill declares the unified runtime contract; Codex metadata declares its HexWitness MCP dependency.
13. Older supported databases migrate without evidence loss; newer schemas fail closed.
14. Consistent snapshots pass SQLite integrity verification and never overwrite an existing backup.
15. Concurrent mixed daemon queries complete under a configurable sustained-load gate.
16. Durable investigations cannot complete without required checks, a proof link, and closed linked gaps.
17. Failed attempts, evidence challenges, discovery-only retrieval, local execution receipts, and the loopback dashboard have focused tests.
18. Streaming ingest, disk-backed capture normalization, provenance-preserving evidence upserts, timeout handling, Host validation, and runtime/schema parity have regression tests.

## Evidence correctness checks

- Ambiguous addresses across builds fail closed.
- Claims and opposing claims remain independently retained.
- Entity dossiers include provenance and related evidence.
- Graph traversal is bounded.
- Capture timelines are ordered by timestamp with stable fallback order.
- Correlation IDs create request/response or follow relationships.
- Capture comparison reports event-family changes and first divergence.
- Payload-like values become length plus SHA-256.
- Sensitive field names are removed recursively, including objects inside arrays.

## Security boundary

The daemon is query-only over HTTP. It binds to localhost by default. A non-local bind requires an API token, but operators must still supply trusted TLS transport. Import and capture mutation stay in local CLI commands.

MCP annotations are safety hints, not an authorization system. HexWitness enforces read-only daemon behavior independently. The local-tool MCP capability intentionally creates an unsandboxed local process and is not read-only; argv, allowlist, cwd-root, timeout, output, credential-argument, and receipt constraints are enforced in runtime code.

See [Security](../.github/SECURITY.md) and [Privacy](PRIVACY.md).

## Compatibility boundary

The core interchange, database, CLI, REST, MCP, installer, and synthetic adapters are first-party and CI-tested.

Commercial viewer compatibility is different:

- Binary Ninja editions and releases determine official MCP availability.
- IDA and idalib behavior depends on licensed components, Python, and plugin release.
- Ghidra, Binary Ninja, and IDA exporter APIs can change.
- CI does not download or launch commercial viewers.

Therefore viewer configuration is documentation-verified, while real viewer compatibility must be accepted in the user's licensed environment. `hexwitness doctor`, a bounded exporter run, and a synthetic ingest/query are the local acceptance path.

## Release discipline

- New record types require schema, fixture, ingestion, query, and documentation coverage.
- New adapters require synthetic output and provenance.
- New public claims require a gate or a stated limitation.
- Raw proprietary evidence never belongs in this repository.
- Regressions should add a focused test before release.

Current detailed scope: [Capability matrix](CAPABILITY-MATRIX.md).
