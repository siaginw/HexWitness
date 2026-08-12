# AI setup wizard

One command connects HexWitness to an AI client:

```bash
hexwitness setup
```

From a source checkout, use `npm run setup`. The wizard can install for one or several clients:

- Codex;
- Claude Code;
- Cursor;
- VS Code / GitHub Copilot;
- Claude Desktop;
- generic MCP JSON.

It can also add optional live-viewer entries for Binary Ninja, IDA, or both.

## What the wizard does

1. asks which AI clients should receive HexWitness;
2. asks whether Binary Ninja or IDA live inspection should be available;
3. shows the complete plan before changing anything;
4. uses the client's native MCP command when available;
5. otherwise merges only HexWitness entries into the existing MCP JSON;
6. creates a timestamped backup before editing an existing JSON file;
7. refuses to replace an existing native MCP entry unless `--force` is explicit;
8. installs the `hexwitness-agent` entrypoint, which starts the local read-only daemon automatically.

The wizard never installs or downloads a commercial viewer. Binary Ninja and IDA integrations remain explicit, local, third-party dependencies.

## Non-interactive examples

```bash
hexwitness setup --client codex --viewer none --yes
hexwitness setup --client codex,cursor --viewer binary-ninja --yes
hexwitness setup --client claude-code --viewer ida --ida-dir C:/tools/ida-pro-mcp --yes
hexwitness setup --client generic --viewer both --output ./team.mcp.json --yes
```

Preview without changing client configuration:

```bash
hexwitness setup --client codex,cursor --viewer both --dry-run
```

Add `--json` when a bootstrapper or another agent needs a machine-readable result.

Use `--force` only when intentionally replacing an existing `hexwitness`, `binary_ninja_live`, or `ida_live` entry.

## First-party versus third-party components

| Component | Ownership |
|---|---|
| HexWitness evidence MCP, daemon, setup wizard, capture packer | First-party HexWitness |
| Binary Ninja and IDA JSONL exporters | First-party HexWitness |
| Binary Ninja live control | Third-party [BinAssistMCP](https://github.com/symgraph/BinAssistMCP) |
| IDA live/headless control | Third-party [`ida-pro-mcp` / `idalib-mcp`](https://github.com/mrexodia/ida-pro-mcp) |

This split avoids maintaining weaker copies of mature viewer control servers. HexWitness owns the durable evidence model, memory, safety policy, promotion contract, and agent workflow.

## Why a few Python files remain

The product core, daemon, MCP server, setup wizard, capture packer, schemas, and query engine run on Node.js. Python is limited to thin adapters executed inside Binary Ninja, IDA, or Ghidra because those viewers expose their supported automation APIs through Python. Users should not have to orchestrate those scripts manually; the AI workflow and viewer bridge choose the bounded exporter when evidence promotion is required.

HexWitness does not currently ship a separate custom live-control MCP plugin for Binary Ninja or IDA. It ships its own evidence MCP and uses the mature upstream viewer MCP projects for live control. The first-party exporters are the stable boundary that converts viewer results into durable HexWitness memory.
