# Release readiness

HexWitness 1.0 is a stable public developer product. “Stable” covers the documented CLI, REST v1, MCP, JSONL v1, capture-pack v1, and database migration contracts. It does not claim third-party commercial viewer certification or an external security audit.

## Ready now

- One installed `hexwitness` command with a bundled runtime and no runtime npm dependency tree.
- Build-scoped JSONL interchange, transactional SQLite evidence memory, durable investigations, failed-attempt reuse, deterministic challenge, discovery-only retrieval, read-only daemon/dashboard, MCP, bounded local tools, CLI, sealed captures, and adapter diagnostics.
- Tailored skills or MCP guidance for Codex, Claude Code, Cursor, VS Code/Copilot, Claude Desktop, and generic clients.
- Synthetic source, package, privacy, dependency, setup, and end-to-end MCP gates.
- GitHub installation and source-checkout workflows.
- Stable machine-readable compatibility contract and fail-closed future schema handling.
- Integrity-checked evidence snapshots and installed-package migration verification.
- Concurrent daemon soak gate, CodeQL, CycloneDX SBOM, SHA-256 release checksums, and GitHub provenance/SBOM attestations.

## Release gate

Run from a clean checkout:

```bash
npm ci
npm run check
npm run test:coverage
npm run public:audit
npm audit --audit-level=high
npm run test:package
npm run test:upgrade
npm run test:load
npm run release:check
```

Then require the GitHub Actions Node 22/24 matrix to pass on Windows, Linux, and macOS before tagging the release.

## Compatibility acceptance

Core behavior is automated. Commercial viewer behavior is environment-dependent and must be accepted with the operator's licensed versions:

1. run `hexwitness doctor`;
2. run `hexwitness adapters` and verify the intended adapter path;
3. export one synthetic or authorized target;
4. ingest it and resolve one entity through MCP;
5. verify any optional Binary Ninja or IDA live bridge separately.

## Deliberate boundaries

These are release-roadmap items, not hidden guarantees:

- HexWitness ships a portable bundled Node application, not platform-specific native executables.
- Release archives carry checksums and keyless build-provenance attestations; they are not Authenticode or Apple-notarized binaries because no native binary ships.
- Commercial viewer versions require local acceptance with the operator's license.
- CodeQL and dependency/public-data audits are automated; no independent security audit is claimed.
- The daemon has a sustained concurrent query gate, not enterprise capacity certification.

See [Stability](STABILITY.md), [Compatibility](COMPATIBILITY.md), and [Security](../.github/SECURITY.md) for the exact trust boundary.
