# S14 — Run a workflow against an implementation through the Microcks API

Part of [the epic](00-epic.md).

## Story

**As an** API provider developer whose CI pipeline deploys API Pastry,
**I want** my pipeline to launch a workflow run against the deployed implementation through the Microcks API, and to read its verdict,
**so that** the pipeline fails as soon as my application stops honouring an Arazzo journey, with no one opening the Microcks UI.

## Domain examples

1. The pipeline asks Microcks to run `readThenReprice` of *API Pastry scenarios* 1.0.0, with:
   - `pastryApi` set to `http://pastry-app:8080`;
   - `pastry` = *Eclair Cafe* and `newPrice` = 2.6.
   It gets the run id back, and reading that run later returns *passed* with the outputs `before` = 2.5 and `after` = 2.6.
2. The same request while the implementation answers `PATCH /pastry/Eclair%20Cafe` with a server error. Reading the run returns *failed at `reprice`*, with the unmet criterion `$statusCode == 200` and the status received.
3. The pipeline asks to run `deleteAll`, which does not exist in *API Pastry scenarios* 1.0.0. The request is refused with the reason *Unknown workflow: deleteAll*, and no run is created.
4. While the run of example 1 is still executing, reading it returns *in progress*, so the pipeline knows to wait.

## Acceptance criteria

**AC-01: A run launched through the API passes, and its verdict and outputs can be read**
Given *API Pastry scenarios* 1.0.0 is imported and linked, and the implementation at `http://pastry-app:8080` behaves as the journey expects
When the pipeline launches `readThenReprice` through the Microcks API with that base URL, `pastry` = *Eclair Cafe* and `newPrice` = 2.6
Then the pipeline receives the id of the run
And reading that run returns *passed* with `before` = 2.5 and `after` = 2.6

**AC-02: A failing implementation is reported with its failing step and reason**
Given the implementation answers the `reprice` call with a server error
When the pipeline launches `readThenReprice` through the API and reads the run once it is finished
Then the run is *failed at `reprice`*, with the criterion `$statusCode == 200` and the status actually received

**AC-03: An unknown workflow is refused without creating a run**
Given *API Pastry scenarios* 1.0.0 has no workflow `deleteAll`
When the pipeline asks to run `deleteAll`
Then the request is refused with the reason *Unknown workflow: deleteAll*
And no run is created

**AC-04: A run still executing says so**
Given a run launched through the API is still executing
When the pipeline reads it
Then the run is reported *in progress*

## Technical notes

- The endpoints are part of the **public Microcks API**:
  - described in the next `api/microcks-openapi-v1.x.yaml`;
  - secured like the test endpoints (Keycloak service account, as `microcks-cli` uses);
  - shaped like the existing tests API: launch returns an id, then the run is read until it is no longer in progress.
- They are the same use cases as the UI (S5, S7). This story adds the documented contract and its tests, not a second implementation.
- Tests:
  - acceptance tests on the launch and read use cases;
  - an API integration test (in-process host) that validates requests and responses against the published OpenAPI description, as Microcks does for its own API.
- Out of scope, still under *Later* in the epic: a `microcks-cli` command, and `runWorkflow(...)` in the Testcontainers bindings (Java, .NET). They will build on this API.

## Dependencies

- [S5](06-s5-run-mocks.md) — runs exist.
- [S7](08-s7-run-impl.md) — runs against implementation base URLs.

## Effort

3. Publishing and securing two use cases that already exist, with contract tests.

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
