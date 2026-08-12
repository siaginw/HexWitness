# Binary Ninja and IDA MCP bridges

HexWitness stores durable, build-scoped evidence. A viewer MCP server gives the agent temporary eyes into an open or headless analysis database. Connecting both lets the agent answer from memory first, inspect a live database only for an explicit gap, and then promote the smallest useful result.

HexWitness does not vendor either project below. Their licenses, vendor requirements, release cadence, and security model remain upstream. The integrations were documentation-checked on 2026-08-11; real compatibility still depends on the installed Binary Ninja or IDA version.

## Recommended pairings

| Viewer | MCP bridge | Why it pairs well | Transport |
|---|---|---|---|
| Binary Ninja | [symgraph/BinAssistMCP](https://github.com/symgraph/BinAssistMCP) | Live decompile/HLIL/MLIL/LLIL, xrefs, types, functions, strings, multi-binary context, guided prompts | Streamable HTTP at `http://127.0.0.1:9090/mcp` by default |
| IDA Pro | [mrexodia/ida-pro-mcp](https://github.com/mrexodia/ida-pro-mcp) | Headless `idalib-mcp`, decompile/disassembly, xrefs, types, stack data, pattern search, multi-database workers | stdio recommended for local agents; local HTTP also available |

`BinAssistMCP` is listed in Vector 35's [community plugin index](https://github.com/Vector35/community-plugins). The IDA project currently recommends `idalib-mcp`; its older in-GUI MCP plugin is marked for eventual deprecation upstream.

## One AI workspace

Run `hexwitness setup`, or copy [`.mcp.ai-first.json.example`](../.mcp.ai-first.json.example) and adjust absolute paths. It declares three distinct roles:

- `hexwitness`: durable, read-only evidence memory;
- `binary_ninja_live`: active Binary Ninja context;
- `ida_live`: active or headless IDA context.

Enable only the viewer you actually use. An MCP client may use a different key than `url` for Streamable HTTP; follow that client's transport syntax while keeping the endpoint unchanged.

## Binary Ninja setup

1. In Binary Ninja, open **Tools → Manage Plugins**.
2. Find **BinAssistMCP**, install it, and restart Binary Ninja.
3. Open **Edit → Preferences → binassistmcp**.
4. Keep host `localhost`, port `9090`, and transport `streamablehttp` unless there is a local conflict.
5. Open the authorized binary and confirm the server starts.
6. Add the endpoint to the same MCP client that runs HexWitness:

```json
{
  "mcpServers": {
    "hexwitness": {
      "command": "node",
      "args": ["C:/tools/HexWitness/bin/hexwitness-agent.mjs"],
      "env": { "HEXWITNESS_AGENT_SESSION": "binary-project" }
    },
    "binary_ninja_live": {
      "url": "http://127.0.0.1:9090/mcp"
    }
  }
}
```

The viewer exposes mutating operations such as rename, comment, and patch. The HexWitness agent contract requires read-only use until the user explicitly authorizes a mutation.

### Binary Ninja investigation example

```text
Find the consumer of the string "invalid frame length". Query HexWitness first.
If the decisive xref or HLIL is missing, use binary_ninja_live read-only to inspect
only that function and its direct callers. Then use the HexWitness promotion prompt
to specify the bounded exporter scope. Do not rename or patch anything.
```

After inspection, run the bundled [Binary Ninja exporter](../adapters/binary-ninja/export_hexwitness.py) for the bounded scope and ingest the resulting JSONL.

## IDA setup

Prerequisites and activation are controlled by the upstream project: Python 3.11 or newer, a supported IDA Pro installation, `uv`, and activated `idalib`. IDA Free is not supported by that project.

Clone or install the upstream MCP bridge, then use its current `idalib-mcp` entry point. A generic local-source configuration is:

```json
{
  "mcpServers": {
    "hexwitness": {
      "command": "node",
      "args": ["C:/tools/HexWitness/bin/hexwitness-agent.mjs"],
      "env": { "HEXWITNESS_AGENT_SESSION": "binary-project" }
    },
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

Use the upstream `ida-pro-mcp --config` command when the MCP client needs a client-specific configuration. `idalib-mcp` can open a database on demand and can adopt a matching running GUI database. Save GUI-only changes before expecting a headless worker to see them.

### IDA investigation example

```text
Resolve UUID 6f9619ff-8b86-d011-b42d-00cf4fc964ff in HexWitness and explain its
retained class model. If a vtable slot target is absent, use ida_live read-only to
resolve exactly that slot, decompile its target, and list direct xrefs. Prepare the
minimum IDA exporter scope required to make the result durable.
```

After inspection, use the bundled [IDA exporter](../adapters/ida/export_hexwitness.py) and verify the finding through HexWitness rather than relying on the transient IDA response.

## Safe orchestration policy

| Stage | Authority | Expected action |
|---|---|---|
| Memory | HexWitness | Select build, search, explain, inspect evidence and contradictions |
| Gap | HexWitness | Name the smallest missing artifact with `gap_report` and `dump_guide` |
| Live read | Viewer MCP | Inspect only the named function, type, references, or slice |
| Promotion | Vendor exporter + local CLI | Emit reviewed `hexwitness-jsonl-v1` and ingest it |
| Verification | HexWitness | Re-run search/explain and confirm the viewer is no longer required |

Keep every service on localhost unless a separately authenticated and encrypted transport is configured. Do not expose Binary Ninja or IDA MCP endpoints to an untrusted network.

## Compatibility boundary

HexWitness CI tests its MCP server, evidence schema, and synthetic exporters. It does not launch commercial viewers in CI. Therefore:

- the integration contract and configurations are first-party;
- the viewer MCP implementations are third-party;
- upstream tool names and transport options can change;
- exact supported viewer versions should be pinned only after testing in your environment;
- `hexwitness doctor`, exporter validation, and a synthetic ingest/query remain the final local acceptance checks.
