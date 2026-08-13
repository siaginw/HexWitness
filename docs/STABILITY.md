# 1.x stability policy

HexWitness 1.0 establishes stable public contracts. Run `hexwitness contract` or call `hexwitness_contract` to inspect them programmatically.

## Compatibility promises

| Surface | 1.x promise |
|---|---|
| CLI | Existing command names, successful exit behavior, and option semantics remain compatible. New commands and optional fields may be added. |
| REST | `/v1` remains read-only and backward compatible. New routes and response fields may be added. Existing meanings are not silently changed. |
| MCP | Existing tool names and required inputs remain compatible. New tools and optional inputs may be added. Query tools remain read-only; investigation-ledger and execution tools advertise their effects truthfully. |
| JSONL | `hexwitness-jsonl-v1` remains readable throughout 1.x. Additive record fields remain allowed. |
| Database | Supported older schemas migrate forward without evidence loss. A database from a newer unsupported schema fails closed. |
| Capture packs | v1 manifests remain verifiable throughout 1.x. Additive metadata remains allowed. |

Deprecations receive at least one minor release of notice. Removal or incompatible semantic changes wait for the next major version.

## Data safety

Before an upgrade, create a consistent snapshot:

```bash
hexwitness backup ./backups/evidence-before-upgrade.db
```

The command refuses to overwrite an existing file, runs SQLite integrity verification, and returns the snapshot SHA-256. Activity history is intentionally disposable and is not included.

## Not covered

- Third-party viewer APIs and MCP servers follow their own release policies.
- Undocumented package-internal paths are not public API.
- Raw proprietary artifacts are governed by their owners and are never made portable by this policy.
