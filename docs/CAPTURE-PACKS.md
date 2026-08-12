# Sealed capture packs

A capture pack is a portable, private evidence envelope for one controlled runtime scenario. It keeps raw artifacts together, generates a safe normalized timeline, and refuses strong acceptance when baseline evidence is missing.

## Baseline

Every default pack requires:

- `bidirectional-wire` — authorized send and receive observations;
- `semantic-events` — narrow hook/debugger events explaining client or process behavior;
- `action-markers` — timestamped operator steps;
- `screen-recording` — short visual record aligned to the markers;
- `context` — build, subject, preconditions, quantities, environment, and written action list.

Scenario-specific required markers can be added at initialization. A project may use a stricter role set but should not weaken the baseline for protocol or client/server work.

Pass `--spec scenario.json` to derive the scenario name, title, required roles, and required step markers from the machine-readable [`scenario-v1`](../schemas/scenario-v1.schema.json) contract.

## Lifecycle

```bash
hexwitness capture init ./captures/login-roundtrip \
  --scenario login-roundtrip \
  --build sha256:0123456789abcdef \
  --sha 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --markers start,request,complete

hexwitness capture add ./captures/login-roundtrip ./private/wire.jsonl --role bidirectional-wire
hexwitness capture add ./captures/login-roundtrip ./private/hooks.jsonl --role semantic-events
hexwitness capture add ./captures/login-roundtrip ./private/screen.mp4 --role screen-recording
hexwitness capture add ./captures/login-roundtrip ./private/context.json --role context

hexwitness capture mark ./captures/login-roundtrip start --note "begin still"
hexwitness capture mark ./captures/login-roundtrip request --note "perform one action"
hexwitness capture mark ./captures/login-roundtrip complete --note "terminal state visible"

hexwitness capture seal ./captures/login-roundtrip
hexwitness capture verify ./captures/login-roundtrip
hexwitness capture import ./captures/login-roundtrip
```

`seal` fails when a role, required marker, artifact, or hash is missing. `--allow-incomplete` exists for exploratory evidence; it labels the pack `incomplete` and must not be treated as proof.

## Directory layout

```text
capture/
├── raw/                         private baseline artifacts
├── probes/                      semantic observer output
├── normalized/
│   └── evidence.hexwitness.jsonl
├── derived/                     optional reports and visualizations
├── manifest.json                build, scenario, roles, hashes, quality
├── operator-markers.jsonl
├── checksums.sha256
├── findings.md
└── active-run.json
```

## Normalization rules

- Raw `body`, `bytes`, `payload`, `buffer`, and `data` values become length and SHA-256 only.
- Credential, cookie, password, secret, token, and authorization fields are removed recursively.
- Addresses become canonical hexadecimal strings.
- Events retain source, direction, kind, name, thread, marker, summary, confidence, and safe structured fields.
- Shared correlation IDs produce request/response or ordered relationships.
- Object, actor, entity, resource, session, type, and UUID fields create evidence relationships.
- Original artifacts remain private inside the pack. Only the normalized JSONL should move into a shareable evidence repository after review.

## Custom collectors

HexWitness does not require Frida or a specific packet stack. A collector can be a debugger extension, DLL, dynamic instrumentation script, proxy, eBPF/ETW consumer, emulator, test harness, or application-native logger.

Collectors declare their role through [`adapter-manifest-v1.schema.json`](../schemas/adapter-manifest-v1.schema.json). Newline-delimited events should use:

```json
{
  "ts_utc": "2026-01-01T00:00:00.000Z",
  "source": "my-observer",
  "kind": "message",
  "name": "request",
  "direction": "client_to_server",
  "address": "0x140001000",
  "thread_id": "42",
  "action_id": "send",
  "fields": { "message_kind": 17, "correlation_id": 9001 }
}
```

Do not put authentication material or unrestricted memory in `fields`.
