# Security policy

HexWitness is intentionally local-first and read-only over HTTP.

## Safe defaults

- The daemon binds to `127.0.0.1`.
- HTTP exposes query operations only. Ingestion remains a local CLI operation.
- Activity retention stores operation names, argument hashes, latency, and result counts. It does not retain prompts, decompiler text, raw packet bodies, or query arguments.
- Exporters omit executable bytes. Decompiled text is opt-in.
- Unknown evidence records fail closed during validation.
- Capture-pack sealing rejects missing baseline evidence by default.
- Capture normalization recursively removes common credential fields, including objects nested in arrays, and replaces payload-like values with length and SHA-256.
- Artifact paths and checksums are verified before a sealed pack is accepted.
- Empty baseline artifacts are rejected, and normalization failure restores an active, repairable pack.

Do not expose the daemon to another host without setting `HEXWITNESS_API_TOKEN` and placing it behind an authenticated transport. HexWitness is not a sandbox. Import only evidence you are authorized to possess.

## Reporting vulnerabilities

Open a private security advisory in the project repository. Do not attach proprietary binaries, raw captures, credentials, or vendor database files.
