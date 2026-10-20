Part of {{EPIC}}. **Walking skeleton of the Arazzo minion.**

## Story

**As an** API developer working on a pastry shop front end against Microcks mocks,
**I want** to run a workflow against the mocks of its linked APIs and see whether each step passed,
**so that** I know my journey works on the mocks before I build on it.

## Domain examples

1. `readThenReprice` with `pastry` = *Eclair Cafe* and `newPrice` = 2.6, against the mocks of *API Pastry - 2.0*:
   - `readPastry` answers 200 with price 2.5;
   - `reprice` answers 200 with price 2.6;
   - the run passes with outputs `before` = 2.5 and `after` = 2.6.
2. `listThenReadFirst` against the same mocks:
   - `list` passes and outputs `first` = *Baba Rhum*;
   - `readFirst` calls `/pastry/Baba%20Rhum` and does not get 200, so the run fails at `readFirst` on the criterion `$statusCode == 200`.
3. While the minion is executing `readThenReprice`, the run shows as in progress, and then shows its final result without a page reload.

## Acceptance criteria

**AC-01: A journey consistent with the mocks passes and exposes its outputs**
Given *API Pastry scenarios* is linked to *API Pastry - 2.0*, whose mocks know *Eclair Cafe*
When the API developer runs `readThenReprice` against the mocks with `pastry` = *Eclair Cafe* and `newPrice` = 2.6
Then the run passes with its steps `readPastry` and `reprice` passed
And the run outputs are `before` = 2.5 and `after` = 2.6

**AC-02: The run stops at the first failing step and names the unmet criterion**
Given the mocks of *API Pastry - 2.0* have no detail example for *Baba Rhum*
When the API developer runs `listThenReadFirst` against the mocks
Then the run fails at step `readFirst`
And step `readFirst` reports that the criterion `$statusCode == 200` did not hold
And step `list` is reported as passed with `first` = *Baba Rhum*

**AC-03: A run in progress becomes final without reloading**
Given a run of `readThenReprice` has been launched
When the minion reports the last step
Then the run is no longer in progress and shows its final result

## Technical notes

- **Blocked by {{ADR}}** (where the run is stored).
- Runs execute in a new **Arazzo minion** (Quarkus, `minions/arazzo`, clean architecture modules), following the AsyncAPI minion protocol:
  - the webapp posts the run, then the minion reports the results back to the webapp;
  - each call targets the mocks of the step's API, at `/rest/{service}/{version}`.
- Walking skeleton: the first acceptance test runs `readThenReprice` end to end, from webapp to minion to Microcks mocks and back to the stored run. Then come use-case-level tests for each criterion. The runner and the expression and condition evaluators are rebuilt by TDD from the POC.
- UI: the run dialog with workflow and inputs (screen 5, *Microcks mocks* target only) and a basic result page (screen 6: status and steps).
- Integration tests:
  - minion executed against `microcks-uber` (Testcontainers) with `APIPastry-openapi.yaml`;
  - webapp ↔ minion contract.
- Add the minion to the Docker Compose, Helm and uber distributions in a follow-up issue if needed.

## Dependencies

- {{ADR}} — storage decision.
- {{S2}} — runnable state and linked APIs.

## Effort

8. A new minion and the round trip; split the UI into its own story if it does not fit.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (8, at the ceiling)
- [x] Technical notes
- [ ] Dependencies: **blocked by the ADR**

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
