Part of {{EPIC}}.

## Story

**As an** API provider developer implementing API Pastry,
**I want** each step response checked against the OpenAPI schema of its operation when I ask for it,
**so that** a journey that passes its criteria with a non-conformant response is still reported as failing.

## Domain examples

1. With validation on, `reprice` gets 200 with `{"price": "2.6"}`. The criterion `$statusCode == 200` holds, but `price` must be a number, so the step fails on a schema violation for `/price`.
2. With validation off, the same response passes `reprice`.
3. With validation on, `readPastry` gets a response conformant to the `Pastry` schema, so the step passes.

## Acceptance criteria

**AC-01: A non-conformant response fails the step even when its criteria hold**
Given validation against the OpenAPI schema is on
When `reprice` receives `{"price": "2.6"}` with status 200
Then step `reprice` fails and reports that `/price` does not match the `Pastry` schema

**AC-02: Without validation, only criteria decide**
Given validation is off
When `reprice` receives `{"price": "2.6"}` with status 200
Then step `reprice` passes

**AC-03: A conformant response passes**
Given validation is on
When `readPastry` receives a pastry conformant to the `Pastry` schema
Then step `readPastry` passes

## Technical notes

- Reuse the OpenAPI schema validation of contract tests (`OpenAPISchemaValidator` in `commons/util`). The minion needs the OpenAPI contract of each linked API, sent with the run like the AsyncAPI spec is sent to the async minion.
- Option in the run dialog: *Validate each response against its OpenAPI schema*.

## Dependencies

- {{S5}}.

## Effort

5. A first integration of the schema validator in the minion.

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
