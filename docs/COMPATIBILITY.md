# Compatibility

## Core runtime

| Component | Supported | Automated gate |
|---|---|---|
| Node.js | 22.13 or newer; CI on current Node 22 and 24 | Exact floor check, cross-platform CI |
| Windows | Current GitHub-hosted Windows runner | Full source suite and public audit |
| Linux | Current GitHub-hosted Ubuntu runner | Full suite, package, upgrade, load, release |
| macOS | Current GitHub-hosted macOS runner | Full source suite and public audit |
| SQLite evidence DB | Schema 1/2/3 migration; schema 4 current | Retention/index migration and future-version rejection |
| MCP | Model Context Protocol stdio through bundled SDK | Installed CLI → daemon → MCP evidence query |

## Reverse-engineering tools

| Tool | HexWitness-owned surface | Live surface | Acceptance status |
|---|---|---|---|
| Binary Ninja | Python JSONL exporter | Official Binary Ninja MCP | Contract complete; licensed-version acceptance required |
| IDA | IDAPython JSONL exporter with optional Hex-Rays pseudocode slices | `ida-pro-mcp` / `idalib-mcp` | Contract complete; licensed-version acceptance required |
| Ghidra | Jython JSONL exporter with strings, imports, references, blocks, and types | External/user-selected | Contract complete; local-version acceptance required |
| Frida | Narrow semantic observer and normalizer | Frida runtime | Synthetic normalizer tested; target hook acceptance required |

Commercial tools are not downloaded into public CI. “Contract complete” means HexWitness validates the interchange and owns the adapter; it does not falsely certify every vendor release.

Run local acceptance:

```bash
hexwitness doctor
hexwitness adapters
hexwitness demo
```

Then export one authorized target and resolve one entity through the configured AI client. Report the viewer version and sanitized output when filing compatibility issues.
