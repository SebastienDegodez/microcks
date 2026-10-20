Part of {{EPIC}}.

## Decision to take

How Microcks stores the result of an Arazzo workflow run.

**Maintainer rule:** reuse `TestResult` only if it carries 100% of the information a run needs. Otherwise, revisit.

## Gap analysis of `TestResult` alone (commons/model)

| A workflow run needs | `TestResult` today | Covered |
|---|---|---|
| Several APIs in one run (a workflow spans source descriptions) | one `serviceId` | ❌ |
| One base URL per source description | one `testedEndpoint` | ❌ |
| Arazzo document and workflow run (`workflowId`) | nothing | ❌ |
| Workflow inputs and workflow outputs | nothing | ❌ |
| **Execution order** of steps across APIs, identified by `stepId` | `TestCaseResult` grouped by `operationName` | ❌ |
| The same operation called twice in one run | `testCaseId = IdBuilder.buildTestCaseId(testResult, operationName)`: both calls share one id, so their exchanges merge | ❌ |
| Per step: failed criteria with their evaluated value, step outputs, steps not executed after a failure | `TestStepResult.message` (free text) | ❌ |
| Status code, request and response of each call | `Request` / `Response` linked by `testCaseId` | ✅ |
| Success, in progress, elapsed time, timeout, secret | same fields | ✅ |
| Delegation to a minion with results reported back | `POST /api/tests` on the minion, `POST /api/tests/{id}/testCaseResult` back | ✅ (pattern) |

A side effect also matters. `TestConformanceMetricUpdater` → `MetricsService.updateTestConformanceMetricOnTestResult` updates the conformance index of an API on every completed `TestResult`. A workflow run must not change it, because a workflow does not test that contract alone.

**Verdict: `TestResult` alone does not carry 100% of a run.**

## Options

**A. Dedicated `WorkflowRun` aggregate**
- Holds all run and step data itself, and reuses `Request` / `Response` for exchanges.
- No impact on existing tests or metrics.
- The test detail UI is not reused as is.

**B. Extend `TestResult`**
- Add workflow fields, several services, and per-step evaluation.
- Every consumer of `TestResult` (UI, CLI, metrics, Testcontainers bindings) must learn the new shape. The core model grows for one runner type.

**C. `WorkflowResult` composing `TestResult`s (maintainer proposal)**
`WorkflowResult` carries what `TestResult` cannot:
- document, `workflowId`, inputs, outputs, target per source;
- **the ordered list of steps**. Each step holds its index, `stepId`, operation, evaluated criteria, outputs, and a reference to the `TestResult` (and `testCaseId`) holding its exchange.

`TestResult` keeps what it already does well: status, timing, request/response, the minion reporting endpoint, and the existing test detail UI.

Two granularities:
- **C1, one `TestResult` per API in the run.** The steps of one API become `TestCaseResult`s of the same `TestResult`. ⚠️ Two steps calling the same operation get the same `testCaseId`, and their exchanges merge. Order across APIs exists only in `WorkflowResult`.
- **C2, one `TestResult` per step (recommended if C is chosen).** No `testCaseId` collision; each step's exchange stays isolated. Cost: a run of N steps creates N `TestResult`s in the history of the APIs it touches.

### Risks of option C (found in the code)

1. **Cascade deletion breaks runs.** Deleting an API runs `testResultRepository.deleteAll(testResultRepository.findByServiceId(id))` (`ServiceService`). A workflow run whose steps point to those `TestResult`s loses them whenever one of the APIs it touched is deleted.
2. **Test numbering and history are per API.** `testNumber` is the previous number + 1 for the API, and "Tests Runs" is paged on it. With C2, a 3-step run consumes numbers #12, #13 and #14 of that API and fills its history with fragments that are not contract tests.
3. **Two sources of truth.** Success, in progress and elapsed time live in both `WorkflowResult` and its `TestResult`s. The webapp's Mongo writes are not transactional across collections, so a minion crash between reports leaves them inconsistent, or leaves orphan `TestResult`s.
4. **A `TestResult` means "test of a contract at an endpoint".** `testedEndpoint`, `operationsHeaders` and `runnerType` drive runner selection (`TestRunnerService` switch). An `ARAZZO` step shown as a test carries affordances that make no sense for it: *Run again*, *Add to your CI/CD*.
5. **Little UI reuse in practice.** The run page needs ordered steps, evaluated criteria and outputs. The part of the test detail page worth reusing is the request/response rendering, which reads `Request` / `Response` by `testCaseId`. That needs a `testCaseId`, not a `TestResult`.
6. **Out-of-order reports.** If the minion reports steps asynchronously, the webapp must not infer order from arrival. With C, the step index must be carried in every report anyway.

What C gets right, and should be kept whatever the option: no parallel storage for exchanges, the minion protocol of AsyncAPI tests, and the order invariant below.

## Recommendation

**A′: a dedicated aggregate with targeted reuse.**
- `WorkflowResult` (the name proposed by the maintainer) owns every run and step field.
- Exchanges are stored as `Request` / `Response` under a `testCaseId` built from the run id and the step index, so the existing request/response rendering and `tests/{id}/messages/{testCaseId}`-style reads can be reused.
- It reuses `SecretRef`, the timeout, and the minion reporting pattern.
- No `TestResult` is created, so there is no cascade, numbering or conformance side effect.
- The links to APIs are by reference (service id + name + version), so a run stays readable after an API is deleted.

## Order — invariant whatever the option

- The execution order of a run is owned by `WorkflowResult.steps`: its index **is** the execution order, assigned by the minion when it starts the step and carried in every report.
- It is never rebuilt from `TestResult`s, `TestCaseResult` order, report arrival order, or dates.
- A step not executed after a failure keeps its slot, with the status *not run* and no `TestResult`.
- A step retried or called twice gets its own slot, with no merge.

## Consequences of C to settle

- Runner type `ARAZZO` (new `TestRunnerType`) is excluded from the conformance metric update.
- Whether the step `TestResult`s show in the API's "Tests runs" with a link back to their workflow run, or are hidden there.
- Endpoints for the run stories ({{S5}}, {{S6}}, {{S11}}): the run reads `WorkflowResult`, and the exchanges read through the existing `tests/{id}/messages/{testCaseId}`.

## Definition of done

The chosen option (A, B, C1 or C2) is recorded in this issue with its reasons and consequences, and the run stories reference it.

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
