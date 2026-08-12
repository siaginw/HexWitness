# Contributing

Contributions should improve generic reverse-engineering workflows. Do not submit proprietary binary bytes, vendor database files, leaked symbols, credentials, authentication material, or fixtures derived from software you cannot redistribute.

Every importer must:

1. Emit `hexwitness-jsonl-v1` records.
2. Include build identity and tool provenance.
3. Avoid executable bytes by default.
4. Document optional sensitive fields.
5. Include a synthetic fixture and idempotency test.

Before opening a pull request:

```bash
npm run check
npm run public:audit
npm audit --audit-level=high
npm run test:package
npm run test:upgrade
npm run test:load
npm run release:check
```

Public feature claims need a focused test or an explicit compatibility boundary. See [Quality](docs/QUALITY.md).
