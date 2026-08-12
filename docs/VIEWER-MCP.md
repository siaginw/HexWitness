# Live viewer MCP bridges

HexWitness stores durable, build-scoped evidence. A viewer MCP gives the agent temporary eyes inside a live or headless analysis database. Together they support a memory-first loop: reuse proof, inspect one missing fact, then promote the bounded result.

HexWitness does not vendor these viewers or bridges. Licenses, editions, security, and release cadence remain upstream. Links and configuration were reviewed on 2026-08-11; accept real compatibility in your own licensed environment.

## Recommended pairings

| Viewer | Live bridge | Role | Default transport |
|---|---|---|---|
| Binary Ninja | [Official Binary Ninja MCP](https://dev-docs.binary.ninja/guide/mcp.html) | Read-oriented file, BinaryView, analysis, function, IL, decompile, type, and xref access | GUI HTTP at `http://127.0.0.1:24642/mcp` or headless stdio |
| IDA Pro | [mrexodia/ida-pro-mcp](https://github.com/mrexodia/ida-pro-mcp) | GUI/headless IDA and idalib analysis | `idalib-mcp --stdio` recommended for local agents |

The IDA bridge is [endorsed by Hex-Rays](https://hex-rays.com/recon-montreal-2026). Binary Ninja's official MCP is not included with Free or Personal editions. Those users can evaluate a community bridge such as [BinAssistMCP](https://github.com/symgraph/BinAssistMCP), subject to its own compatibility and security model.

## Let the wizard connect them

```bash
hexwitness setup
```

Select Binary Ninja, IDA, or both. The generated workspace keeps roles separate:

- `hexwitness` — durable read-only memory;
- `binary_ninja_live` — current Binary Ninja context;
- `ida_live` — current or headless IDA context.

The wizard configures the viewer entry. It does not install, license, enable, or launch commercial software.

## Binary Ninja official MCP

1. Open Binary Ninja settings.
2. Enable `ui.mcp.enabled` and restart Binary Ninja.
3. Optional: configure `ui.mcp.host`, `ui.mcp.port`, `ui.mcp.endpoint`, and `ui.mcp.token`.
4. Choose **Plugins → MCP → Start Server**.
5. Choose **Plugins → MCP → Copy Connection Info**.
6. Confirm the copied URL matches your agent configuration.

Default GUI URL:

```text
http://127.0.0.1:24642/mcp
```

If a bearer token is enabled or the port is dynamic, use Binary Ninja's copied connection data instead of guessing. HexWitness setup accepts an alternate URL:

```bash
hexwitness setup --client codex --viewer binary-ninja \
  --binary-ninja-url http://127.0.0.1:24642/mcp --yes
```

The official headless `binaryninja_mcp` executable uses stdio and requires an edition that includes it. Configure that entry manually when headless analysis is preferred.

### Community fallback

BinAssistMCP commonly uses `http://127.0.0.1:9090/mcp`. Point the same option at that endpoint:

```bash
hexwitness setup --client cursor --viewer binary-ninja \
  --binary-ninja-url http://127.0.0.1:9090/mcp --yes
```

Community bridges may expose mutation. HexWitness guidance keeps live inspection read-only unless the user explicitly authorizes a change.

## IDA Pro MCP

Prerequisites are controlled upstream: supported IDA Pro, Python, `uv`, and activated idalib. Clone the current bridge into the directory passed to setup:

```bash
hexwitness setup --client codex --viewer ida \
  --ida-dir C:/tools/ida-pro-mcp --yes
```

Equivalent generic entry:

```json
{
  "mcpServers": {
    "ida_live": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "C:/tools/ida-pro-mcp",
        "idalib-mcp",
        "--stdio"
      ]
    }
  }
}
```

Use the upstream project's current configuration command when its launch contract changes. Save GUI-only changes before expecting a headless worker to observe them.

## Safe orchestration

| Stage | Authority | Action |
|---|---|---|
| Memory | HexWitness | Select build, search, explain, inspect evidence and contradictions |
| Gap | HexWitness | Name the smallest missing fact with gap report and dump guide |
| Live read | Viewer MCP | Inspect only that function, type, xref, field, or slice |
| Promotion | Viewer exporter + CLI | Emit reviewed `hexwitness-jsonl-v1` and ingest it |
| Verification | HexWitness | Re-run the original query and confirm the answer is durable |

Example:

```text
Find the consumer of "invalid frame length". Query HexWitness first.
If one decisive xref is missing, use the connected viewer read-only to inspect
that function and its direct callers. Export only the bounded result, ingest it,
and reproduce the answer from HexWitness.
```

Keep every MCP endpoint on localhost unless separately authenticated and encrypted. Viewer MCPs can expose powerful analysis or mutation operations and should not be placed on an untrusted network.

## Tested boundary

HexWitness CI tests its own MCP server, evidence schemas, setup definitions, exporters with synthetic fixtures, and installed-package journey. CI does not download or launch commercial viewers.

Therefore:

- HexWitness configuration and promotion contracts are first-party;
- Binary Ninja's MCP is vendor-owned;
- IDA Pro MCP is upstream-owned and vendor-endorsed;
- community bridge behavior remains community-owned;
- exact viewer compatibility must be tested locally.

See [Quality](QUALITY.md) and [Troubleshooting](TROUBLESHOOTING.md).
