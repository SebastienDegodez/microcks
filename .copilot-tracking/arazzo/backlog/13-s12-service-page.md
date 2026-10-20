# S12 — See the workflows that use an API on its page

Part of [the epic](00-epic.md).

## Story

**As an** API provider developer about to change an operation of API Pastry,
**I want** the API page to show which workflows use this API and each of its operations,
**so that** I know which journeys my change can break before I make it.

## Domain examples

1. The *API Pastry - 2.0* page shows, under Properties, *Workflows: readThenReprice (passed), listThenReadFirst (failed) in API Pastry scenarios 1.0.0*, with a link to the Workflows page.
2. In the Operations list:
   - `GET /pastry/{name}` shows *2 workflow(s)*;
   - `GET /pastry` and `PATCH /pastry/{name}` each show *1 workflow(s)*;
   - each count is next to the existing *sample(s)* count.
3. An API used by no workflow shows neither the Workflows property nor the counts.

## Acceptance criteria

**AC-01: The API page lists the workflows using it with their last result**
Given `readThenReprice` and `listThenReadFirst` call operations of *API Pastry - 2.0*
When the API provider developer opens the *API Pastry - 2.0* page
Then a Workflows property lists `readThenReprice` and `listThenReadFirst` with their last result

**AC-02: Each operation shows how many workflows call it**
Given the same workflows
When the API provider developer reads the Operations list
Then `GET /pastry/{name}` shows 2 workflow(s), and `GET /pastry` and `PATCH /pastry/{name}` show 1 workflow(s) each

**AC-03: No workflow, no addition**
Given *Hello API* is used by no workflow
When the API provider developer opens its page
Then the page is unchanged from today

## Technical notes

- **Additions only.** The service detail page keeps its current layout and style (screen 4 with the *highlightAdditions* view of the mock-up). Its layout refresh is [S13](14-s13-refresh.md).
- One query returning the workflows per service and per operation, read by the existing service detail page.

## Dependencies

- [S2](03-s2-link.md) — links between workflows and APIs.
- [S11](12-s11-history.md) — last result, optional: show *Never run* until it exists.

## Effort

3. One query and three small additions to an existing page.

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
