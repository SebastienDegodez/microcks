# ADR 2 — Recording the calls an application makes to the mocks

Part of [the epic](00-epic.md). Blocks the consumer-side stories [S15](17-s15-verify-consumer.md), [S16](18-s16-stateful-saga-mocks.md) and [S17](19-s17-saga-compensation.md).

## Decision to take

To check that an application under test (a saga orchestrator, for example) follows an Arazzo workflow, Microcks must know **which calls that application made to the mocks, in which order, with which data**, and must keep them apart from the calls of other tests running at the same time.

Today Microcks:
- counts mock invocations per day (`DailyStatistic`);
- streams live traces (OpenTelemetry, `TraceSubscriptionManager`) without keeping them;
- keeps per-service state for scripted dispatchers (`StateStore`).

It does **not** keep the content of the requests received by the mocks.

## Questions

1. **How a test scopes its calls.** Options:
   - **a.** A *verification session* opened through the API. The application under test sends its id in a header, for example `x-microcks-session: <id>`, propagated by the test.
   - **b.** A time window per API, which is fragile when tests run in parallel.
   - **c.** A dedicated mock endpoint per session, such as `/rest/{service}/{version}` under a session prefix. No header to propagate, but the application's base URLs change per test.
2. **What is kept, and for how long.** Method, path, headers, body, response, and an order index assigned on receipt. Kept until the session is closed plus a retention delay, then purged.
3. **Where it is stored.** A session-scoped collection, never in `TestResult`. The run-storage ADR (`01-adr.md`) is not reused as is.

## Recommendation

**a** for headers the application can propagate, with **c** as a fallback for applications that cannot add a header. The order is the receipt index assigned by Microcks, never a timestamp.

## Decision

_Status: **pending** — to be filled by the maintainer. S15, S16 and S17 stay blocked until this section says `Status: decided`._

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
