Part of {{EPIC}}.

## Story

**As an** API developer iterating on API Pastry,
**I want** the history of the runs of a document's workflows, filterable by workflow, target and result,
**so that** I see whether a journey regressed and against which target.

## Domain examples

Runs of *API Pastry scenarios*:

| Run | Workflow | Target | Result |
|---|---|---|---|
| #1 | `readThenReprice` | mocks | passed |
| #2 | `readThenReprice` | `http://localhost:8080` | failed at `reprice` |
| #3 | `listThenReadFirst` | mocks | failed at `readFirst` |

1. The history lists #3, #2, #1, newest first.
2. Filtering on *Failed* lists #3 and #2.
3. Filtering on `readThenReprice` and *Implementations* lists #2 only.

## Acceptance criteria

**AC-01: Runs are listed newest first with their outcome**
Given runs #1, #2 and #3 of *API Pastry scenarios*
When the API developer opens its runs history
Then #3, #2 and #1 are listed in that order, each with its workflow, target, result, failed step and duration

**AC-02: Runs can be filtered by result**
Given the same runs
When the API developer filters on *Failed*
Then only #3 and #2 are listed

**AC-03: Filters combine**
Given the same runs
When the API developer filters on `readThenReprice` and *Implementations*
Then only #2 is listed

## Technical notes

- A query use case with paging, an endpoint, and the history page (screen 7).
- The workflow detail page (*Recent runs*) and the Workflows list (*last result*) read the same query.
- Run numbering is per document, independent of the API test numbers. The order of steps inside a run is not this story's concern (see {{ADR}}).

## Dependencies

- {{S5}} — runs exist.

## Effort

3. One paged query with filters, and one page.

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
