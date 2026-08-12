# Getting started

This path uses the synthetic fixture included with HexWitness. It proves the importer, SQLite schema, query layer, daemon, and CLI before you introduce private evidence.

## Prerequisites

- Node.js 22.13 or newer
- npm
- Git

Confirm Node:

```bash
node --version
```

## Install from source

```bash
git clone https://github.com/siaginw/HexWitness.git
cd HexWitness
npm install
```

## Build the demo evidence graph

```bash
npm run demo
```

This creates `.hexwitness/evidence.db` and imports `examples/toy-binary/evidence.jsonl`. The fixture contains four entities, three edges, one evidence record, two intentionally conflicting claims, one capture, and two runtime events.

## Verify local state

```bash
npm run doctor
node bin/hexwitness.mjs stats
node bin/hexwitness.mjs search dispatch
node bin/hexwitness.mjs explain 0x401120 --build toy-v1
node bin/hexwitness.mjs contradictions --build toy-v1
```

The contradiction query should return the two synthetic claims about message kinds 7 and 8. That disagreement is deliberate—it demonstrates that HexWitness preserves uncertainty.

## Start the daemon

```bash
npm start
```

Open `http://127.0.0.1:7878/v1/health`, or run:

```bash
curl http://127.0.0.1:7878/v1/health
```

Stop the daemon with `Ctrl+C`.

## Connect MCP

Copy `.mcp.json.example` into the configuration used by your MCP client. Replace the script path with an absolute path on your machine. Start the daemon before opening the agent session.

Ask the agent:

> Use HexWitness to explain `0x401120` in build `toy-v1`. Separate proven evidence from conflicting claims.

The agent should choose and sequence the tools. You should not need to translate the question into CLI commands. Continue with [AI-first workflows](AI-FIRST-WORKFLOWS.md), or connect a [Binary Ninja/IDA live MCP bridge](VIEWER-MCP.md) for bounded fallback inspection.

## Import your first export

Run one adapter from [`adapters/`](../adapters/README.md), then:

```bash
node bin/hexwitness.mjs ingest /path/to/program.hexwitness.jsonl
node bin/hexwitness.mjs search entry --build YOUR_BUILD_ID
```

Keep generated JSONL and databases out of public repositories unless you have explicitly reviewed their provenance and redistribution rights.

## Verify a capture pack

After the synthetic workflow, follow [sealed capture packs](CAPTURE-PACKS.md) with evidence from a binary you are authorized to inspect. A complete pack proves the capture lifecycle, safe normalization, checksums, runtime timeline, and import path independently from any target-specific decoder.
