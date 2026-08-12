# HTTP API

The daemon exposes read-only JSON endpoints. Ingestion is intentionally excluded; use the local CLI.

Base URL: `http://127.0.0.1:7878`

## Authentication

The default localhost configuration does not require a token. Once `HEXWITNESS_API_TOKEN` is configured, every request—including localhost requests—must send:

```http
Authorization: Bearer YOUR_TOKEN
```

## Endpoints

| Method and path | Parameters | Result |
|---|---|---|
| `GET /v1/health` | — | Service version, start time, database, counts |
| `GET /v1/builds` | — | Indexed builds and provenance |
| `GET /v1/stats` | — | Evidence table counts |
| `GET /v1/search` | `q`, `build_id`, `kind`, `limit` | Matching entities |
| `GET /v1/explain` | entity selector | Complete evidence dossier |
| `GET /v1/callers` | entity selector, `limit` | Direct incoming call edges |
| `GET /v1/callees` | entity selector, `limit` | Direct outgoing call edges |
| `GET /v1/xrefs` | entity selector, `limit` | Incoming and outgoing references |
| `GET /v1/evidence` | `build_id`, `source`, `classification`, `limit` | Evidence records |
| `GET /v1/contradictions` | `build_id`, `limit` | Conflicting active claim groups |
| `GET /v1/gaps` | entity selector, `objective` | Missing-evidence report |
| `GET /v1/guide/dump` | `objective` | Export checklist |
| `GET /v1/activity` | `limit` | Privacy-preserving operation summary |

An entity selector contains one of:

- `entity_id`
- `stable_key`, optionally with `build_id`
- `address`, preferably with `build_id`

## Examples

```bash
curl "http://127.0.0.1:7878/v1/search?q=dispatch&build_id=toy-v1"
curl "http://127.0.0.1:7878/v1/explain?address=0x401120&build_id=toy-v1"
curl "http://127.0.0.1:7878/v1/gaps?address=0x401120&build_id=toy-v1&objective=runtime"
```

## Error behavior

- `400` — invalid or ambiguous selector, address, or query input; add `build_id` when a selector exists in several builds
- `401` — missing or incorrect configured token
- `404` — route or entity not found
- `405` — mutation attempted against the read-only daemon

Responses use `application/json` and `Cache-Control: no-store`.
