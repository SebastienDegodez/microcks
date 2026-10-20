# S4 — Read the steps of a workflow

Part of [the epic](00-epic.md).

## Story

**As an** API developer reviewing a journey before running it,
**I want** to read the steps of a workflow with the operations they call and how data flows between them,
**so that** I understand what the journey checks without opening the Arazzo YAML.

## Domain examples

1. `readThenReprice` shows 2 steps:
   - `readPastry` calls `GET /pastry/{name}` (`GetPastryByName`), with `name` from input `pastry` and the criterion `$statusCode == 200 && $response.body#/status == 'available'`;
   - `reprice` calls `PATCH /pastry/{name}` (`PatchPastry`), with `name` from `readPastry.outputs.name` and body `/price` replaced by input `newPrice`.
2. Between the two steps, the page states that `readPastry.outputs.name` becomes the `name` path parameter of `reprice`.
3. The inputs `pastry` and `newPrice` are listed with the step and place where each one is used. The workflow outputs `before` and `after` are listed with their expressions.
4. `listThenReadFirst`, whose last run failed, is reachable from a second tab marked as failed.

## Acceptance criteria

**AC-01: Each step shows its operation, parameters, criteria and outputs**
Given *API Pastry scenarios* 1.0.0 is imported and linked to *API Pastry - 2.0*
When the API developer opens the workflow `readThenReprice`
Then step `readPastry` shows `GET /pastry/{name}`, its parameter `name` from input `pastry`, its success criterion, and its outputs `name` and `price`

**AC-02: Data passed between steps is made visible**
Given the workflow `readThenReprice`
When the API developer reads its steps
Then the page states that `readPastry.outputs.name` becomes the `name` path parameter of `reprice`

**AC-03: Inputs and workflow outputs are listed with where they are used**
Given the workflow `readThenReprice`
When the API developer reads it
Then input `newPrice` is shown as used by `reprice` in body `/price` and in a criterion
And the outputs `before` and `after` are shown with their expressions

## Technical notes

- Vertical slice: a detail query use case, its endpoint, and the Angular page (screen 3 of the mock-up), with one tab per workflow.
- Deriving where an input or an output is used is a rule over the parsed workflow; it belongs to the domain, not to the page.
- *Recent runs* stays empty until [S11](12-s11-history.md).

## Dependencies

- [S1](02-s1-import.md), [S2](03-s2-link.md).

## Effort

5. One query with derived data flow, and one page.

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
