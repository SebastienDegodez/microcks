# S3 — Browse workflows

Part of [the epic](00-epic.md).

## Story

**As an** API developer working on a pastry shop front end against Microcks mocks,
**I want** a *Workflows* page listing the imported Arazzo documents and their workflows,
**so that** I can find the journey I need and see at a glance whether it can run and how it last went.

## Domain examples

1. *API Pastry scenarios* 1.0.0 is listed with its file `pastry.arazzo.yaml`, the API *API Pastry - 2.0* 2.0.0, and its 2 workflows. `readThenReprice` last passed on mocks; `listThenReadFirst` last failed at `readFirst`.
2. *Order fulfilment* 1.0.0 is listed with *Customer API* 1.0.0, a warning that `orderApi` is not linked, and *Never run*.
3. With no document imported, the page explains what workflows are and offers to import an Arazzo document.
4. Filtering by *API Pastry - 2.0* leaves only *API Pastry scenarios*.

## Acceptance criteria

**AC-01: Documents are listed with their workflows, APIs and last result**
Given *API Pastry scenarios* 1.0.0 is imported and `listThenReadFirst` last failed at `readFirst`
When the API developer opens the Workflows page
Then *API Pastry scenarios* 1.0.0 is listed with *API Pastry - 2.0* 2.0.0 and its 2 workflows
And `listThenReadFirst` shows *Failed at readFirst*

**AC-02: A document with an unlinked source says so**
Given *Order fulfilment* 1.0.0 is imported with `orderApi` not linked and has never run
When the API developer opens the Workflows page
Then *Order fulfilment* shows that `orderApi` is not linked and *Never run*

**AC-03: An empty page leads to the import**
Given no Arazzo document is imported
When the API developer opens the Workflows page
Then the page explains what workflows are and offers to import an Arazzo document

**AC-04: The list can be filtered by API**
Given *API Pastry scenarios* and *Order fulfilment* are imported
When the API developer filters on *API Pastry - 2.0*
Then only *API Pastry scenarios* is listed

## Technical notes

- Vertical slice: a query use case returning a view model, its REST endpoint, a new *Workflows* entry in the vertical navigation, and the Angular page (screen 1 of the mock-up).
- New screens use the current PatternFly 3 style; no restyling of existing pages ([S13](14-s13-refresh.md)).
- Before the run stories exist, the last result is *Never run*.
- Tests:
  - acceptance tests on the query use case;
  - an API integration test;
  - component tests for the page.

## Dependencies

- [S1](02-s1-import.md) — imported documents.
- [S2](03-s2-link.md) — link state.

## Effort

5. Query, endpoint, navigation entry and one page with filter and empty state.

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
