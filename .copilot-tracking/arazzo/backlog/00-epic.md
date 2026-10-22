# Epic — Arazzo workflows in Microcks

## Goal

Let API developers describe multi-step journeys across the APIs Microcks already knows with [Arazzo](https://spec.openapis.org/arazzo/latest.html), and play them against Microcks mocks or against their implementations, from the Microcks UI.

Two outcomes matter most:

- **Check that the mocks form a coherent scenario.** For example, every pastry that the list operation returns must be readable by the detail operation.
- **Check that implementations honour a journey**, not only each operation on its own.

## Context

- Upstream demand: microcks/microcks#1665 (API workflow testing), microcks/microcks#1635 (Arazzo as input for the AI Copilot), microcks/microcks#1039 (sync → async triggers).
- Proof of concept: branch [`poc/arazzo-runner`](https://github.com/SebastienDegodez/microcks/tree/poc/arazzo-runner). It is a standalone runner with 213/213 PIT mutants killed, and an end-to-end test against `microcks-uber` with the `APIPastry-openapi.yaml` sample.
- Validated UI journey (7 screens): [UI MOCK-UP LINK]

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Store workflow runs as `TestResult`? | Only if `TestResult` carries 100% of a run. Alone, it does not, so the decision is reopened in [ADR](01-adr.md). Options compared there, including `WorkflowResult` composing `TestResult`s. In every option, `WorkflowResult` owns the execution order of the steps. |
| 2 | Where do workflows execute? | In a **dedicated minion**. The webapp delegates the run and receives results back, like the AsyncAPI minion does. |
| 3 | UI style | New screens follow the current Microcks style. Refreshing existing layouts happens in **dedicated PRs** ([S13](14-s13-refresh.md)). |
| 4 | How a source description finds its Microcks API | By API **name and version**, as everywhere in Microcks. Arazzo does not carry them, so they come from a secondary artifact overlay (like `APIExamples`): see [S2](03-s2-link.md). |

## Delivery conventions (SKRAFT)

- **Outside-in TDD, double loop.** The acceptance test of a story enters through the **application use case** and asserts on its return value or its output gateways. It uses real domain objects and in-memory or mocked gateways. No implementation code is written before a behaviour RED.
- **No Gherkin files.** The Given/When/Then criteria of each story file are the approved scenarios, and acceptance test names mirror them.
- **Concentric circles.** Once the use case is GREEN, add integration tests for the API endpoint (in-process host), the Mongo repository (Testcontainers) and the HTTP calls (Microcks as contract mock).
- **Two test modules per bounded context** (`*-unit-test`, `*-integration-test`), plus ArchUnit rules guarding the layers.
- **Quality bar.** 100% PIT mutation score on new code; `mvn spotless:apply` before each commit; Conventional Commits; one PR per story; never commit on red.
- **Minion layout** (Quarkus, like `minions/async`): `minions/arazzo/arazzo-domain`, `-application`, `-infrastructure`, `-api`, plus the two test modules. The POC classes (parser, expression and condition evaluators, runner) move into domain and application by TDD, not by copy.
- **To confirm:** the webapp is a single Spring module. New webapp code lives in a `workflow` feature package with use cases and gateways, and its layers are guarded by ArchUnit rules rather than Maven modules.

## Stories

Delivery order. The ADR blocks the run stories.

This folder is the only backlog: there are no GitHub issues. A story is identified by its key (S1…S13) and its file. Its state is read from git:
- **in progress:** a branch `arazzo/<key>-<slug>` exists, for example `arazzo/s1-import`;
- **done:** that branch's PR is merged into `master`.

The checkboxes below are ticked by the maintainer when merging.

- [ ] [ADR](01-adr.md) ADR — storage of workflow runs
- [ ] [S1](02-s1-import.md) Import an Arazzo document
- [ ] [S2](03-s2-link.md) Link source descriptions to Microcks APIs
- [ ] [S3](04-s3-browse.md) Browse workflows
- [ ] [S4](05-s4-detail.md) Read the steps of a workflow
- [ ] [S5](06-s5-run-mocks.md) Run a workflow against Microcks mocks (walking skeleton of the minion)
- [ ] [S6](07-s6-why-failed.md) Understand why a step failed
- [ ] [S7](08-s7-run-impl.md) Run a workflow against implementation endpoints
- [ ] [S14](15-s14-run-through-api.md) Run a workflow against an implementation through the Microcks API (CI)
- [ ] [S8](09-s8-missing-inputs.md) Refuse a run whose inputs are missing
- [ ] [S9](10-s9-schema.md) Validate step responses against the OpenAPI schema
- [ ] [S10](11-s10-coherence.md) Spot mock examples that do not form a coherent scenario
- [ ] [S11](12-s11-history.md) Follow the runs history
- [ ] [S12](13-s12-service-page.md) See the workflows that use an API on its page
- [ ] [S13](14-s13-refresh.md) Refresh the API page layout (dedicated PR)

## Later (not in this epic)

- AsyncAPI source descriptions (Arazzo 1.1): check that an HTTP call publishes the expected event (#1665).
- `onSuccess` / `onFailure` actions, `dependsOn`, nested workflows, `operationPath`.
- Running a workflow from CI with `microcks-cli`, and the `microcks-testcontainers-java` and `-dotnet` bindings. They build on the API of [S14](15-s14-run-through-api.md).
- Feeding Arazzo workflows to the AI Copilot to generate coherent examples (#1635).

---
_Drafted with AI assistance (Claude) from the POC and the validated UI mock-up; to be reviewed by the maintainer before work starts._
