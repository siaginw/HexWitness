# One-command capture input

Place `capture.json` beside these collector outputs:

```text
wire.jsonl
hooks.jsonl
screen.mp4
context.json
```

Then run:

```bash
hexwitness capture pack ./path/to/folder
```

HexWitness detects the conventional filenames, applies the baseline quality gate, normalizes private payloads, seals and verifies the pack, and imports its evidence. Use an explicit `artifacts` array in `capture.json` only when collector filenames differ.
