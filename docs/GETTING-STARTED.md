# Getting started

This path uses the synthetic fixture included with HexWitness. It proves the importer, SQLite schema, query layer, daemon, CLI, MCP, and installed agent path before you introduce private evidence.

## Prerequisites

- Node.js 22.13 or newer
- npm
- Git

Confirm Node:

```bash
node --version
```

## Fast install

```bash
npm install --global github:siaginw/HexWitness
hexwitness setup
hexwitness demo
```

Skip to [Verify local state](#verify-local-state).

Inspect the machine-readable 1.x boundary at any time:

```bash
hexwitness contract
```

## Install from source

```bash
git clone https://github.com/siaginw/HexWitness.git
cd HexWitness
npm install
```

`npm install` builds the same single-file runtime used by the installed package.

## Build the demo evidence graph

```bash
npm run demo
```

This creates `.hexwitness/evidence.db` and imports `examples/toy-binary/evidence.jsonl`. The fixture contains four entities, three edges, one evidence record, two intentionally conflicting claims, one capture, and two runtime events.

## Verify local state

```bash
npm run doctor
npx --no-install hexwitness stats
npx --no-install hexwitness search dispatch
npx --no-install hexwitness explain 0x401120 --build toy-v1
npx --no-install hexwitness contradictions --build toy-v1
```

The contradiction query should return the two synthetic claims about message kinds 7 and 8. That disagreement is deliberate—it demonstrates that HexWitness preserves uncertainty.

## Connect your AI

```bash
npm run setup
```

Choose one or more AI clients and an optional Binary Ninja or IDA viewer. The generated MCP entry uses `hexwitness agent`, which initializes local state when needed and starts the read-only daemon automatically.

Use [the setup guide](INSTALLER.md) for non-interactive flags or manual configuration.

Ask the agent:

> Use HexWitness to explain `0x401120` in build `toy-v1`. Separate proven evidence from conflicting claims.

The agent should choose and sequence the tools. You should not need to translate the question into CLI commands. Continue with [AI-first workflows](AI-FIRST-WORKFLOWS.md), or connect a [Binary Ninja/IDA live MCP bridge](VIEWER-MCP.md) for bounded fallback inspection.

## Import your first export

Run one adapter from [`adapters/`](../adapters/README.md), then:

```bash
npx --no-install hexwitness ingest /path/to/program.hexwitness.jsonl
npx --no-install hexwitness search entry --build YOUR_BUILD_ID
```

Keep generated JSONL and databases out of public repositories unless you have explicitly reviewed their provenance and redistribution rights.

Before upgrading an evidence database, create a verified snapshot:

```bash
hexwitness backup ./backups/evidence-before-upgrade.db
```

HexWitness migrates supported older schemas on the next writable command. Newer, unsupported schemas fail closed.

## Verify a capture pack

After the synthetic workflow, place `capture.json`, `wire.jsonl`, `hooks.jsonl`, `screen.mp4`, and `context.json` in one private directory, then run `hexwitness capture DIRECTORY`. Follow [sealed capture packs](CAPTURE-PACKS.md) for the manifest contract and advanced lifecycle controls.
