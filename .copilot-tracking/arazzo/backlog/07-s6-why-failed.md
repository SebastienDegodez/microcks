Part of {{EPIC}}.

## Story

**As an** API developer whose workflow run failed,
**I want** to see the request, the response and the evaluated criteria of the failing step,
**so that** I can tell whether the journey, the mocks or the implementation is wrong without replaying calls by hand.

## Domain examples

1. Run of `listThenReadFirst`:
   - `readFirst` sent `GET /rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum`;
   - the path parameter `name` = *Baba Rhum* came from `$steps.list.outputs.first`;
   - the response status was not 200, and the criterion `$statusCode == 200` is shown as failed with the evaluated value.
2. Step `list` of the same run shows its output `first` = *Baba Rhum* and where it came from (`$response.body#/0/name`).
3. A run of `readThenReprice` that passed shows the workflow outputs `before` = 2.5 and `after` = 2.6.

## Acceptance criteria

**AC-01: The failing step shows what was sent and received**
Given a run of `listThenReadFirst` failed at `readFirst`
When the API developer opens that run
Then step `readFirst` shows the request URL with *Baba%20Rhum*, the response status and the response body

**AC-02: Each criterion shows its evaluated value**
Given the same run
When the API developer opens step `readFirst`
Then the criterion `$statusCode == 200` is shown as failed, next to the status actually received

**AC-03: Values passed between steps show their origin**
Given the same run
When the API developer opens step `readFirst`
Then the parameter `name` shows *Baba Rhum* and its source `$steps.list.outputs.first`

## Technical notes

- Depends on what {{ADR}} decides to store per step: evaluated criteria, resolved parameters, outputs, and the exchange.
- Result page (screen 6): the failing step is expanded by default, and passed steps can be expanded.
- Request/response rendering reuses the existing test detail components where possible.

## Dependencies

- {{S5}} — runs exist.

## Effort

5. Richer step data in the run, plus the result detail page.

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
