# Agent quickstart

## Connect once

Start the query daemon:

```sh
hexwitness serve
```

Configure the MCP server using [`.mcp.json.example`](../.mcp.json.example). The MCP process talks to the daemon; it does not open the database itself.

To add live Binary Ninja or IDA inspection, use [`.mcp.ai-first.json.example`](../.mcp.ai-first.json.example). HexWitness remains the memory authority; the viewer is consulted only for explicit gaps.

## Ask a goal, not a command sequence

```text
Use HexWitness to determine what validates this message before dispatch. Drive the
investigation, reuse retained evidence, and use the connected live viewer read-only
only if a gap report proves it is needed. Make any new result durable with the
smallest possible exporter scope.
```

The `hexwitness_start_investigation` MCP prompt gives an agent the complete sequence below. More examples: [AI-first workflows](AI-FIRST-WORKFLOWS.md).

## Investigation recipe

```text
health → builds → search/query → explain → focused graph or capture query → evidence → contradictions → gaps
```

### 1. Establish build identity

Every address is build-scoped. Select by executable SHA-256 whenever possible. Labels are for humans; hashes provide identity.

### 2. Resolve before traversing

Use search for incomplete symbols, strings, signatures, or address fragments. Pass the returned `entity_id` to `explain` when names are ambiguous.

### 3. Read the dossier

`explain` aggregates static structure, graph edges, evidence, claims, and runtime hits. Prefer it over several disconnected calls.

### 4. Test the claim

Use callers/callees for control flow, dataflow/slices for value movement, class/UUID/types for object models, and capture timeline/graph/compare for runtime behavior. Then inspect evidence and contradictions.

### 5. Ask for a bounded new dump

When blocked, do not ask for “more data.” Specify:

- build SHA-256;
- target function/type/address;
- required relation or field;
- suitable adapter;
- whether decompiler text is necessary;
- a short runtime action sequence if dynamic proof is required.

## Confidence language

| Label | Meaning |
|---|---|
| Proven | Direct static or dynamic evidence; build identity matches |
| Strong inference | Multiple independent observations agree |
| Provisional | Plausible interpretation with incomplete support |
| Contradicted | Active evidence supports incompatible values |
| Unknown | Required observation has not been captured |

Never upgrade confidence solely because a symbol name sounds descriptive.
