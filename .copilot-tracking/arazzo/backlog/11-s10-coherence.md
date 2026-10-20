Part of {{EPIC}}.

## Story

**As an** API developer maintaining the examples of API Pastry in Microcks,
**I want** a run against the mocks that fails because an example is missing to tell me which operation lacks which example,
**so that** I fix the contract's examples instead of debugging the journey.

## Domain examples

1. `listThenReadFirst` fails at `readFirst`: `GetPastries` returns *Baba Rhum*, but `GetPastryByName` has no example whose path parameter `name` is *Baba Rhum*. The run says exactly that, and links to `GET /pastry/{name}` on the API page.
2. `readThenReprice` with `pastry` = *Eclair Cafe* passes, so no hint is shown.
3. A run against an **implementation** that answers 404 for *Baba Rhum* shows no example hint, because the hint only applies to mocks.

## Acceptance criteria

**AC-01: A failure caused by a missing example names the operation and the missing value**
Given the mocks of *API Pastry - 2.0* have no `GetPastryByName` example for *Baba Rhum*
When the API developer opens the failed run of `listThenReadFirst`
Then the run explains that `GetPastryByName` has no example for `name` = *Baba Rhum*
And it links to `GET /pastry/{name}` on the *API Pastry - 2.0* page

**AC-02: No hint for a run that passed**
Given a passed run of `readThenReprice`
When the API developer opens it
Then no example hint is shown

**AC-03: No example hint for a run against an implementation**
Given a run of `listThenReadFirst` against `http://localhost:8080` failed at `readFirst`
When the API developer opens it
Then no example hint is shown

## Technical notes

- How the minion recognises "no example matched" (the mock's answer, or a dispatch lookup) is decided when the story is picked up. No spike is planned. The POC only asserted "not 200"; do not assume a 404.
- Optional link to *Generate examples with the AI Copilot* when the copilot is enabled.

## Dependencies

- {{S6}} — run result detail.

## Effort

3. One rule on step failures plus the hint.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (≤ 8)
- [x] Technical notes (no-match signal decided at pickup)
- [x] Dependencies listed

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
