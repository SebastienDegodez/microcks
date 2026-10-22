# S15 — Verify that my application followed a workflow against the mocks

Part of [the epic](00-epic.md). **Consumer side: the application under test calls the Microcks mocks.**

## Story

**As a** developer of an order saga service that calls the Order, Stock and Payment APIs,
**I want** my integration test to ask Microcks whether the calls my service made to the mocks follow the Arazzo workflow `placeOrderSaga`,
**so that** I know my saga runs the right steps, in the right order, with the right data, without a real Order, Stock or Payment service.

## Domain example — the saga

The workflow `placeOrderSaga` of *Order saga* 1.0.0:

1. `createOrder` — `POST /orders` on *Order API* 1.0.0, with customer `c-7`, 2 × `ABC-1`, 25.0 EUR. The mock returns order `o-42`.
2. `reserveStock` — `POST /reservations` on *Stock API* 1.0.0, with `orderId` = the `id` returned by `createOrder`. The mock returns reservation `r-9`.
3. `chargePayment` — `POST /payments` on *Payment API* 1.0.0, with `orderId` = `o-42` and `amount` = 25.0.
4. `confirmOrder` — `POST /orders/o-42/confirm` on *Order API* 1.0.0.

## Domain examples

1. The saga service, given customer `c-7`, makes the 4 calls above in order, through the mocks, in the test's session. The verification passes and lists the 4 steps as matched.
2. The service calls `chargePayment` before `reserveStock`. The verification fails: *step `reserveStock` expected before `chargePayment`*.
3. The service sends `reserveStock` with `orderId` = `o-1` instead of `o-42`, the value returned by `createOrder`. The verification fails: *`reserveStock` path or body `/orderId` should come from `$steps.createOrder.outputs.id` (o-42), got o-1*.
4. The service never calls `confirmOrder`. The verification fails: *step `confirmOrder` missing*.
5. Two tests run the saga at the same time, in two sessions. Each verification only sees the calls of its own session.

## Acceptance criteria

**AC-01: Calls matching the workflow pass, step by step**
Given *Order saga* 1.0.0 is imported and linked to the mocks of *Order API*, *Stock API* and *Payment API* 1.0.0
And a verification session is open for `placeOrderSaga`
When the saga service makes the 4 calls of example 1 through the mocks in that session, and the test asks Microcks to verify the session
Then the verification passes, with `createOrder`, `reserveStock`, `chargePayment` and `confirmOrder` matched in that order

**AC-02: A call out of order fails the verification**
Given the same session setup
When the service calls `chargePayment` before `reserveStock`
Then the verification fails, stating that `reserveStock` was expected before `chargePayment`

**AC-03: Data not taken from the previous step fails the verification**
Given the same session setup
When the service sends `reserveStock` with `orderId` = `o-1` although `createOrder` returned `o-42`
Then the verification fails, naming `reserveStock`, the expected source `$steps.createOrder.outputs.id`, the expected value `o-42`, and the received value `o-1`

**AC-04: A missing step fails the verification**
Given the same session setup
When the service makes the first 3 calls only
Then the verification fails, stating that `confirmOrder` is missing

**AC-05: Sessions are isolated**
Given two sessions open on `placeOrderSaga`
When each session receives the calls of one saga run
Then each verification reports only the calls of its own session

## Technical notes

- **Blocked by [ADR 2](16-adr2-mock-sessions.md)** (how calls are recorded and scoped).
- The same Arazzo document serves both directions:
  - Microcks plays it against a provider (S5, S7);
  - Microcks checks a consumer against it (this story).
- A step is matched by its operation (method + path template of the linked API), in receipt order.
- Matching the data reuses the expression evaluation of the runner: `$steps.*.outputs` resolved from the **mock responses** recorded in the session, compared to the **requests** of the next steps.
- The verification is exposed through the public Microcks API (open a session, verify a session), so that tests can call it. It is also shown in the UI, reusing the result page.
- Out of scope: `Testcontainers` helpers (`verifyWorkflow(...)`), listed under *Later*.

## Dependencies

- [ADR 2](16-adr2-mock-sessions.md).
- [S2](03-s2-link.md) — links to the APIs whose mocks are called.

## Effort

8. A new recording, a matching rule over order and data, and its API. Split by AC (order, data, isolation) if it does not fit.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (8, at the ceiling)
- [x] Technical notes
- [ ] Dependencies: **blocked by ADR 2**

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
