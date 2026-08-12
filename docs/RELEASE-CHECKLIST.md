# Public release checklist

## Code and tests

- `npm ci`
- `npm run check`
- `npm run public:audit`
- `npm audit --audit-level=high`
- `npm run test:package`
- Confirm the demo runs from the installed package, not only the source checkout.
- Confirm the GitHub Actions operating-system and Node.js matrix passes.

## Legal and provenance

- Confirm all source is original or attribution-compatible.
- Review dependency licenses from `package-lock.json`.
- Confirm synthetic fixtures contain no third-party bytes.
- Confirm vendor names are nominative descriptions only.
- Obtain legal review for release boundary and project name.

## Privacy

- No binary, decompiler database, memory dump, raw capture, video, or screenshot.
- No credentials, tokens, certificates, account identifiers, or private paths.
- No game/application-specific addresses, protocol catalogs, or extracted data.
- `scripts/public-audit.mjs` passes.

## Documentation

- Verify repository URLs and relative documentation links.
- Verify Windows, Linux, and macOS commands through CI or label them unverified.
- State supported Binary Ninja, IDA, Ghidra, Node.js, and MCP-client versions only after real testing.
- Mark preview adapters accurately.
