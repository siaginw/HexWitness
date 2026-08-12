# CLI reference

Install HexWitness and use the single `hexwitness` command. From a source checkout, `npm install` builds the same bundled command and the npm scripts invoke it.

## Database and service

```bash
hexwitness --version
hexwitness setup [--client codex,cursor] [--viewer none|binary-ninja|ida|both]
  [--binary-ninja-url URL] [--ida-dir PATH] [--yes|--dry-run|--json]
hexwitness init [--db PATH]
hexwitness ingest FILE [--db PATH]
hexwitness serve [--db PATH] [--host HOST] [--port PORT]
hexwitness stats
hexwitness memory
hexwitness doctor
hexwitness demo [--reset]
hexwitness agent
hexwitness mcp
hexwitness adapters [ADAPTER_ID]
hexwitness contract
hexwitness backup OUTPUT [--db PATH]
```

`ingest` validates the complete JSONL before applying one atomic, idempotent transaction. `serve` is query-only. Non-local binds require `HEXWITNESS_API_TOKEN`. Machine-readable `setup --json` never prompts when client and viewer are supplied.

`memory` reports durable evidence counts, database size, latest ingest/capture, and the query-before-live-tool reuse policy.

`agent` is the recommended MCP entry: it starts a missing local daemon and serves MCP over stdio. `mcp` serves MCP without daemon autostart. `adapters` returns the installed adapter catalog; pass an ID for its absolute path and capabilities.

`contract` prints the stable 1.x compatibility surface. `backup` creates a consistent evidence-database snapshot, refuses overwrite, runs an integrity check, and returns its SHA-256.

## Static and evidence queries

```bash
hexwitness search QUERY [--build BUILD] [--kind KIND]
hexwitness builds
hexwitness query [TEXT] [--build BUILD] [--kinds function,class] [--edge-kinds call,reads]
hexwitness explain ADDRESS [--build BUILD]
hexwitness gaps ADDRESS [--build BUILD] [--objective behavior]
hexwitness functions [TEXT] --build BUILD
hexwitness classes [TEXT] --build BUILD
hexwitness class NAME [--build BUILD]
hexwitness uuid UUID [--build BUILD]
hexwitness types [TEXT] --build BUILD [--kind KIND]
hexwitness offsets [TEXT] --build BUILD [--owner CLASS]
hexwitness metadata QUERY [--build BUILD] [--kinds asset,codec]
hexwitness decomp-search QUERY --build BUILD [--kind SLICE_KIND]
hexwitness path FROM_ADDRESS TO_ADDRESS --build BUILD [--kind call]
hexwitness edge-kinds [--build BUILD]
hexwitness compare-builds LEFT_BUILD RIGHT_BUILD
hexwitness reach ADDRESS [--build BUILD] [--direction outgoing] [--kind call] [--depth 3]
hexwitness dataflow ADDRESS [--build BUILD] [--direction both]
hexwitness callers|callees|xrefs|vtable|slices ADDRESS [--build BUILD]
hexwitness evidence [--build BUILD] [--source SOURCE]
hexwitness worklist [--build BUILD] [--status open]
hexwitness coverage [--build BUILD]
hexwitness contradictions [--build BUILD]
hexwitness guide [identity|control_flow|data_flow|object_model|protocol|runtime|behavior]
```

## Capture packs

Normal path:

```bash
hexwitness capture SOURCE_DIR [--out PACK_DIR] [--no-import]
```

`SOURCE_DIR/capture.json` contains the scenario, build identity, and timestamped markers. Conventional collector filenames are detected automatically. The command builds in a temporary directory, fails cleanly, then publishes only a verified pack.

Advanced primitives:

```bash
hexwitness capture init DIR --scenario NAME --build BUILD [--sha SHA256] [--markers a,b] [--spec scenario.json]
hexwitness capture add DIR FILE --role ROLE [--description TEXT]
hexwitness capture mark DIR NAME [--note TEXT]
hexwitness capture normalize DIR
hexwitness capture inspect DIR
hexwitness capture seal DIR [--allow-incomplete]
hexwitness capture verify DIR
hexwitness capture import DIR [--db PATH]
```

Default roles: `bidirectional-wire`, `semantic-events`, `action-markers`, `screen-recording`, and `context`. `seal` rejects missing or empty baseline evidence unless `--allow-incomplete` explicitly labels an exploratory pack. Failed normalization restores the active manifest so the operator can repair and retry it.

## Capture queries

```bash
hexwitness captures [--build BUILD] [--scenario TEXT] [--status STATUS]
hexwitness capture-detail CAPTURE_ID
hexwitness capture-timeline CAPTURE_ID [--after ORDINAL] [--source SOURCE] [--kind KIND]
hexwitness capture-search QUERY [--capture CAPTURE_ID]
hexwitness capture-graph CAPTURE_ID [--kind RELATIONSHIP_KIND]
hexwitness capture-compare LEFT_ID RIGHT_ID
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `HEXWITNESS_HOME` | `.hexwitness` | Local state directory |
| `HEXWITNESS_DB` | `$HEXWITNESS_HOME/evidence.db` | Evidence database |
| `HEXWITNESS_ACTIVITY_DB` | `$HEXWITNESS_HOME/activity.db` | Privacy-preserving query activity |
| `HEXWITNESS_HOST` | `127.0.0.1` | Daemon host |
| `HEXWITNESS_PORT` | `7878` | Daemon port |
| `HEXWITNESS_API_TOKEN` | unset | Bearer token, required for non-local bind |
| `HEXWITNESS_ACTIVITY_LOG` | `1` | Set `0` to disable activity retention |
| `HEXWITNESS_ACTIVITY_RETENTION_DAYS` | `30` | Activity retention |
