# Capture pipeline

The production workflow uses [sealed capture packs](CAPTURE-PACKS.md). This page describes the evidence principles behind them.

HexWitness does not prescribe one debugger or packet tool. It prescribes an evidence envelope.

## Controlled capture contract

Every useful capture should include:

1. Exact binary build identity.
2. UTC start and end.
3. One narrow scenario.
4. Timestamped action markers.
5. Semantic hook events.
6. Direction for send/receive events.
7. Hook address and thread when available.
8. Body length and body SHA-256 when raw data exists.
9. Decoded fields with explicit confidence.
10. Terminal cleanup or failure observation.

Keep raw traffic, memory, and screen recordings in private capture packs. Import only reviewed normalized events into shareable evidence repositories.

## Generic Frida flow

Emit one JSON object per event from Frida. Normalize it:

```sh
node adapters/frida-jsonl/normalize.mjs raw-semantic.jsonl runtime.hexwitness.jsonl BUILD_ID CAPTURE_ID
hexwitness ingest runtime.hexwitness.jsonl
```

The normalizer does not retain arbitrary raw fields outside `fields`. Review input before publishing derived output.

## Capture quality

- **accepted:** complete baseline roles, build identity, ordered actions, hashes, and terminal state;
- **incomplete:** explicitly retained exploratory evidence that failed one or more gates;
- **active:** open collection that has not been sealed.

Capture quality belongs in metadata and should affect claim confidence.
