# Troubleshooting

## `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`

Upgrade to Node.js 22.13 or newer:

```bash
node --version
```

Node 22.13 may print an `ExperimentalWarning` for its built-in SQLite module. SQLite is available without a command-line flag in that release, and the warning does not indicate a failed HexWitness operation.

## `evidence database` does not exist

Initialize or run the demo first:

```bash
hexwitness init
# or
hexwitness demo
```

Confirm the resolved path with `hexwitness doctor`.

## Port 7878 is already in use

Choose another port:

```bash
hexwitness serve --port 8787
```

Set the same URL in `HEXWITNESS_URL` for the MCP adapter.

## MCP starts but tools fail

The recommended `hexwitness agent` entry starts a missing local daemon automatically. First run:

```bash
hexwitness doctor
```

If the MCP entry uses the lower-level `hexwitness mcp` command instead, start the daemon separately and confirm it:

```bash
curl http://127.0.0.1:7878/v1/health
```

Then verify the MCP environment points at that URL.

For an autostart entry, verify `HEXWITNESS_HOME`, `HEXWITNESS_DB`, host, and port are consistent. A remote `HEXWITNESS_URL` is never started automatically.

## Binary Ninja live tools do not appear

Confirm your Binary Ninja edition includes the official MCP server. Enable `ui.mcp.enabled`, restart Binary Ninja, choose **Plugins → MCP → Start Server**, then copy the exact connection info. The default endpoint is `http://127.0.0.1:24642/mcp`.

If using BinAssistMCP instead, pass its endpoint explicitly with `--binary-ninja-url`.

Run `hexwitness adapters --diagnose` or call `hexwitness_adapter_diagnostics` first. A detected executable proves only local visibility; commercial license/API compatibility still requires one bounded acceptance run inside the vendor host.

## Local tool is not found or allowlisted

Run:

```bash
hexwitness tool status
```

The local runner has no environment enable switch. It resolves a fixed RE-oriented command allowlist from the current PATH and accepts a project-local executable whose real path stays under the selected root. Use the exact listed command name or local path. The runner is argv-only and cwd-rooted but not OS-sandboxed. Provider credentials belong to the AI client and must not be passed as tool arguments.

## Import rejected with an unsafe numeric address

JavaScript numbers cannot exactly represent every 64-bit virtual address. Export addresses as strings:

```json
{ "address": "0x140001000" }
```

Do not emit large addresses as JSON numbers.

## An edge has no resolved peer

Emit entity records and edge stable keys for the same `build_id`. HexWitness performs a second edge-resolution pass after ingest, so record ordering does not matter within one file.

## Search returns an entity from the wrong build

Pass `--build` in the CLI or `build_id` through REST/MCP. Addresses are meaningful only within one build.

HexWitness rejects `explain`, caller/callee, xref, and gap queries when the selector matches more than one indexed build and no `build_id` is supplied.

## Public audit fails

Treat the finding as a release blocker. Remove generated binaries, captures, credentials, personal paths, or embedded payloads. Do not weaken the audit merely to make a package pass.
