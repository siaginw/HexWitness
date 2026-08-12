# Contributing

Contributions should improve generic reverse-engineering workflows. Do not submit proprietary binary bytes, vendor database files, leaked symbols, credentials, authentication material, or fixtures derived from software you cannot redistribute.

Every importer must:

1. Emit `hexwitness-jsonl-v1` records.
2. Include build identity and tool provenance.
3. Avoid executable bytes by default.
4. Document optional sensitive fields.
5. Include a synthetic fixture and idempotency test.

Run `npm run check` before opening a pull request.
