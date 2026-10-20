# S8 — Refuse a workflow run whose inputs are missing

Part of [the epic](00-epic.md).

## Story

**As an** API developer launching a workflow,
**I want** a run whose required inputs are missing to be refused before any call is made,
**so that** I fix my inputs instead of reading a failure deep inside a step.

## Domain examples

1. `readThenReprice` launched with `pastry` = *Eclair Cafe* and no `newPrice` is refused with *Missing input: newPrice*, and no call reaches the mocks.
2. `listThenReadFirst` declares no inputs, so it is launched with none and runs.
3. `readThenReprice` launched with both inputs runs normally.

## Acceptance criteria

**AC-01: A run missing an input is refused and names the input**
Given the workflow `readThenReprice` uses the inputs `pastry` and `newPrice`
When the API developer launches it with only `pastry` = *Eclair Cafe*
Then the run is refused with *Missing input: newPrice*
And no call is made to the mocks

**AC-02: A workflow without inputs runs without inputs**
Given the workflow `listThenReadFirst` uses no input
When the API developer launches it with no input
Then the run starts

## Technical notes

- The inputs a workflow needs are the `$inputs.*` references in its steps and outputs; a declared `inputs` JSON schema is honoured when present.
- Refusal happens in the launch use case, before delegating to the minion.

## Dependencies

- [S5](06-s5-run-mocks.md).

## Effort

2. One validation in the launch use case.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (≤ 8)
- [x] Technical notes
- [x] Dependencies listed

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
