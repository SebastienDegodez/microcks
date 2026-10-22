# S17 — Make a saga step fail on the mocks and verify the compensation

Part of [the epic](00-epic.md). **Consumer side.**

## Story

**As a** developer of an order saga service,
**I want** to make one step fail on the mocks for my test session, and to verify that my service then runs the compensation workflow,
**so that** I prove my saga undoes its work correctly when a downstream service refuses, without breaking a real payment service.

## Domain examples

*Order saga* 1.0.0 also declares the workflow `compensatePaymentRefused`:
- `createOrder`, `reserveStock`, `chargePayment` (refused);
- `releaseStock` — `DELETE /reservations/r-9` on *Stock API* 1.0.0;
- `cancelOrder` — `POST /orders/o-42/cancel` on *Order API* 1.0.0.

1. The test opens a session on `compensatePaymentRefused` and asks that `chargePayment` answer with the *Payment API* example *card refused* (status 402). The saga service then calls `releaseStock` for `r-9` and `cancelOrder` for `o-42`, so the verification passes.
2. Same setup, but the service calls `cancelOrder` and never `releaseStock`. The verification fails: *step `releaseStock` missing*.
3. Same setup, but the service still calls `confirmOrder` after the refusal. The verification fails: *unexpected call `confirmOrder` after `chargePayment`*.
4. In another session without failure injection, `chargePayment` answers normally.

## Acceptance criteria

**AC-01: An injected failure makes the step answer with the chosen example**
Given a session on `compensatePaymentRefused` with `chargePayment` set to answer with the example *card refused*
When the saga service calls `chargePayment`
Then it receives the *card refused* example of *Payment API*

**AC-02: A complete compensation passes the verification**
Given the same session
When the service then calls `releaseStock` for `r-9` and `cancelOrder` for `o-42`
Then the verification of `compensatePaymentRefused` passes

**AC-03: A missing compensation step fails the verification**
Given the same session
When the service calls `cancelOrder` but never `releaseStock`
Then the verification fails, stating that `releaseStock` is missing

**AC-04: A call that should not happen after the failure fails the verification**
Given the same session
When the service calls `confirmOrder` after the refused payment
Then the verification fails, stating that `confirmOrder` was not expected after `chargePayment`

**AC-05: Injection is limited to its session**
Given one session with the injected failure and one session without it
When both call `chargePayment`
Then only the first one receives *card refused*

## Technical notes

- The injection is scoped to a session ([S18](20-s18-verification-session.md)), because the order id of the saga does not exist yet when the test asks for the failure.
- The compensation path is a **separate workflow** of the same Arazzo document, because `onFailure` is outside the supported subset. Supporting `onFailure: goto` later could express the saga as one workflow.
- The injected answer is chosen among the operation's existing examples, by name. No new example is invented.
- "Unexpected call" means a call to an operation of a linked API, inside the session, that matches no remaining step of the workflow.

## Dependencies

- [S15](17-s15-verify-consumer.md) — verification of a saga.
- [S16](18-s16-stateful-saga-mocks.md) — state of the saga across steps.
- [S18](20-s18-verification-session.md) — the session that scopes the injected failure.

## Effort

5. Session-scoped answer override, plus the "unexpected call" rule in the verification.

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
