# Privacy model

HexWitness uses three evidence zones:

| Zone | Contents | Shareability |
|---|---|---|
| Raw | binaries, memory, packets, recordings, vendor databases | Private |
| Derived | hashes, addresses, decoded fields, graph relations, provenance | Project-controlled |
| Public fixture | synthetic or explicitly redistributable evidence | Public |

The repository contains only public fixtures. `.gitignore` excludes common analysis databases, raw capture directories, private directories, and local databases.

## Query retention

Activity history stores:

- UTC timestamp;
- transport and operation;
- SHA-256 of canonical arguments;
- optional hashed session label;
- duration, result count, and status.

It does not store argument values, prompts, returned evidence, raw bytes, decompiler text, or agent conversations. Default retention is 30 days.

This separation defines HexWitness memory: the evidence database retains findings that a user intentionally exports and ingests; the activity database records that a query occurred without retaining the query or answer. Live viewer results are not silently copied into either database.

## Local tool receipts

The agent-callable local-tool runner has no environment enable gate. It runs with the current local user's permissions and is not an OS sandbox, so only authorized workspaces and targets belong in scope. It uses no shell, enforces an executable allowlist and real-path cwd root, caps time/output, rejects credential-like arguments, removes credential-shaped environment variables from the child, and returns a receipt. Recording retains command identity, argv, input hashes, output hash, timing, and exit state—not automatic semantic claims. Do not include sensitive output in public reports.

The loopback dashboard is read-only and unavailable on non-local binds. It does not expose a tool-execution control.

## Publication checklist

- Search for credentials and tokens.
- Search for absolute usernames and private paths.
- Reject large hex/base64 payloads.
- Confirm all fixtures are synthetic.
- Review screenshots and recordings for personal data.
- Audit dependency and adapter licenses.
- Build the package from a clean checkout.
