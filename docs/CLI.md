# CLI reference

Run commands through `node bin/hexwitness.mjs`, or run `npm link` once to install the local `hexwitness` command.

## `init`

Create or migrate the evidence database.

```bash
hexwitness init [--db PATH]
```

## `ingest`

Validate and atomically ingest one `hexwitness-jsonl-v1` file.

```bash
hexwitness ingest FILE [--db PATH]
```

Invalid JSON, unknown record types, unsupported formats, unsafe numeric addresses, and missing required fields reject the import. The evidence mutation runs in a transaction.

## `serve`

Start the query-only HTTP daemon.

```bash
hexwitness serve [--db PATH] [--host HOST] [--port PORT]
```

The default is `127.0.0.1:7878`. A non-local host requires `HEXWITNESS_API_TOKEN`.

## `search`

Search names, stable keys, signatures, and address text.

```bash
hexwitness search QUERY [--build BUILD_ID] [--kind ENTITY_KIND]
```

## `explain`

Build a complete evidence dossier for one address.

```bash
hexwitness explain ADDRESS [--build BUILD_ID]
```

When several builds are indexed, always provide `--build`.

## `gaps`

Report missing evidence for an investigation objective.

```bash
hexwitness gaps ADDRESS [--build BUILD_ID] [--objective OBJECTIVE]
```

Objectives: `identity`, `control_flow`, `data_flow`, `object_model`, `protocol`, `runtime`, and `behavior`.

## `guide`

Print the vendor-neutral dump checklist for an objective.

```bash
hexwitness guide [OBJECTIVE]
```

## `contradictions`

List active claims whose subject and predicate match but whose values disagree.

```bash
hexwitness contradictions [--build BUILD_ID]
```

## `stats`

Print evidence table counts.

```bash
hexwitness stats
```

## `doctor`

Check Node.js, bind safety, database presence, schema, and indexed content.

```bash
hexwitness doctor
```

## `demo`

Import the bundled synthetic fixture.

```bash
hexwitness demo [--reset]
```

`--reset` removes the configured demo database before rebuilding it. Do not point `HEXWITNESS_DB` at evidence you want to preserve when using this option.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HEXWITNESS_HOME` | `.hexwitness` | Local state directory |
| `HEXWITNESS_DB` | `$HEXWITNESS_HOME/evidence.db` | Evidence database |
| `HEXWITNESS_ACTIVITY_DB` | `$HEXWITNESS_HOME/activity.db` | Query activity database |
| `HEXWITNESS_HOST` | `127.0.0.1` | Daemon bind host |
| `HEXWITNESS_PORT` | `7878` | Daemon port |
| `HEXWITNESS_API_TOKEN` | unset | Bearer token; required for non-local bind |
| `HEXWITNESS_ACTIVITY_LOG` | `1` | Set `0` to disable activity retention |
| `HEXWITNESS_ACTIVITY_RETENTION_DAYS` | `30` | Activity retention window |
