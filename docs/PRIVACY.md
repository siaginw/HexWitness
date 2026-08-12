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

## Publication checklist

- Search for credentials and tokens.
- Search for absolute usernames and private paths.
- Reject large hex/base64 payloads.
- Confirm all fixtures are synthetic.
- Review screenshots and recordings for personal data.
- Audit dependency and adapter licenses.
- Build the package from a clean checkout.
