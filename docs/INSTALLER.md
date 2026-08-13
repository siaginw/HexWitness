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

It also installs the best supported native guidance for each selected agent and can add optional live-viewer entries for Binary Ninja, IDA, or both.

Automation should call `hexwitness contract` (or MCP tool `hexwitness_contract`) before assuming a command, route, schema, or interchange boundary. That response is the stable machine-readable contract for the 1.x line.

## Agent-native guidance

| Selected client | Installed guidance | Discovery path |
|---|---|---|
| Codex | Native `$hexwitness` skill with OpenAI UI metadata and MCP dependency | `~/.codex/skills/hexwitness/` |
| Claude Code | Native on-demand skill written for Claude's autonomous tool workflow | `~/.claude/skills/hexwitness/` |
| Cursor | Native Agent Skill written for Cursor Agent | `~/.cursor/skills/hexwitness/` |
| VS Code / Copilot | Native portable Agent Skill written for Copilot Agent mode | `~/.copilot/skills/hexwitness/` |
| Claude Desktop | Client-tailored MCP guide resource and prompts | `hexwitness://agent-guide` |
| Generic MCP | Portable guide beside the generated MCP JSON plus MCP guide resource | `hexwitness-agent-instructions.md` |

Native skills load on demand, so they do not consume every conversation's context. Their descriptions trigger on binary analysis, protocol reconstruction, runtime comparison, object-model mapping, evidence gaps, and live-finding promotion. Each pack uses client-native terminology while enforcing the same build identity, evidence, privacy, and read-only escalation contract.

Every shipped pack also enforces the distribution boundary: use MCP for investigations, use the unified `hexwitness` command for operational work, resolve adapters through `hexwitness adapters`, and never rely on package-internal paths.

Skills also teach the selected agent to call adapter diagnostics, use discovery only as candidate retrieval, read failed-attempt memory, challenge evidence before completion, and invoke bounded local tools directly when useful. Model-provider authentication remains owned by the host client. HexWitness never asks an agent to copy provider API keys into MCP arguments, local-tool arguments, or evidence.

## What the wizard does

1. asks which AI clients should receive HexWitness;
2. asks whether Binary Ninja or IDA live inspection should be available;
3. shows the complete plan before changing anything;
4. uses the client's native MCP command when available;
5. otherwise merges only HexWitness entries into the existing MCP JSON;
6. creates a timestamped backup before editing an existing JSON file;
7. refuses to replace an existing MCP entry unless `--force` is explicit when the client exposes entry inspection;
8. installs or updates the selected client's tailored HexWitness skill/guide, backing up an existing copy under `~/.hexwitness/backups/agent-packs/`;
9. installs the unified `hexwitness agent` entrypoint, which starts the local read-only daemon automatically.

In `--json` mode the wizard never prompts, making it safe for bootstrap scripts and agents after `--client` and `--viewer` are supplied.

The wizard never installs or downloads a commercial viewer. Binary Ninja and IDA remain explicit local dependencies. Viewer URLs must resolve to localhost; setup will not connect a powerful live-analysis endpoint over a remote URL.

## Non-interactive examples

```bash
hexwitness setup --client codex --viewer none --yes
hexwitness setup --client codex,cursor --viewer binary-ninja --yes
hexwitness setup --client codex --viewer binary-ninja --binary-ninja-url http://127.0.0.1:24642/mcp --yes
hexwitness setup --client claude-code --viewer ida --ida-dir C:/tools/ida-pro-mcp --yes
hexwitness setup --client generic --viewer both --output ./team.mcp.json --yes
```

Preview without changing client configuration:

```bash
hexwitness setup --client codex,cursor --viewer both --dry-run
```

Add `--json` when a bootstrapper or another agent needs a machine-readable result.

Use `--force` only when intentionally replacing an existing `hexwitness`, `binary_ninja_live`, or `ida_live` entry.

## Component ownership

| Component | Ownership |
|---|---|
| HexWitness evidence MCP, daemon, setup wizard, capture packer, and tailored agent skills | First-party HexWitness |
| Binary Ninja and IDA JSONL exporters | First-party HexWitness |
| Binary Ninja live control | [Official Binary Ninja MCP](https://dev-docs.binary.ninja/guide/mcp.html); community fallback optional |
| IDA live/headless control | Upstream [`ida-pro-mcp` / `idalib-mcp`](https://github.com/mrexodia/ida-pro-mcp), endorsed by Hex-Rays |

This split avoids maintaining weaker copies of mature viewer control servers. HexWitness owns durable evidence, build identity, memory, safety policy, promotion, and agent workflow.

## One installed command, native adapters

The installed package exposes only `hexwitness`. Its service, MCP server, setup wizard, capture packer, and query engine are bundled into one runtime file. Use `hexwitness adapters` to discover the included exporters without searching the package tree.

Python is limited to thin adapters executed inside Binary Ninja, IDA, or Ghidra because those viewers expose their supported automation APIs through Python. Users do not orchestrate those files as HexWitness services; the AI workflow and viewer bridge select the bounded exporter when evidence promotion is required.

HexWitness does not currently ship a separate custom live-control MCP plugin for Binary Ninja or IDA. It ships its own evidence MCP and uses the mature upstream viewer MCP projects for live control. The first-party exporters are the stable boundary that converts viewer results into durable HexWitness memory.
