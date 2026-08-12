# CLI reference

Use `node bin/hexwitness.mjs`, or run `npm link` once for the `hexwitness` command.

## Database and service

```bash
hexwitness init [--db PATH]
hexwitness ingest FILE [--db PATH]
hexwitness serve [--db PATH] [--host HOST] [--port PORT]
hexwitness stats
hexwitness memory
hexwitness doctor
hexwitness demo [--reset]
```

`ingest` validates the complete JSONL before applying one atomic, idempotent transaction. `serve` is query-only. Non-local binds require `HEXWITNESS_API_TOKEN`.

`memory` reports durable evidence counts, database size, latest ingest/capture, and the query-before-live-tool reuse policy.

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

Default roles: `bidirectional-wire`, `semantic-events`, `action-markers`, `screen-recording`, and `context`. `seal` rejects missing baseline evidence unless `--allow-incomplete` explicitly labels an exploratory pack.

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
