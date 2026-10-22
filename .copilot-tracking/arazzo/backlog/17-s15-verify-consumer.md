# S15 — Verify a saga against its workflow by its correlation key

Part of [the epic](00-epic.md). **Consumer side: the application under test calls the Microcks mocks.**

## Story

**As a** developer of an order saga service that calls the Order, Stock and Payment APIs,
**I want** my integration test to ask Microcks whether the calls my service made to the mocks for one saga follow the Arazzo workflow `placeOrderSaga`,
**so that** I prove my saga runs the right steps, in the right order, with the right data, with my service tested as it is, without adding any header.

## How a saga instance is found: its correlation key (first choice)

A saga always carries a correlation key, but its place changes from step to step, and Arazzo does not say where it is. The **overlay** introduced by [S2](03-s2-link.md) declares it per workflow and per step:

```yaml
apiVersion: mocks.microcks.io/v1alpha1
kind: APIWorkflowSources          # kind name to confirm
metadata:
  name: Order saga
  version: 1.0.0
sources:
  orderApi:   { name: Order API,   version: 1.0.0 }
  stockApi:   { name: Stock API,   version: 1.0.0 }
  paymentApi: { name: Payment API, version: 1.0.0 }
workflows:
  placeOrderSaga:
    correlation:
      createOrder:   { in: response, pointer: /id }   # the first step produces the key
      reserveStock:  { in: body, pointer: /orderId }
      chargePayment: { in: body, pointer: /orderId }
      confirmOrder:  { in: path, name: orderId }
```

The mock example of `createOrder` returns `"id": "{{ uuid() }}"`, so each saga receives its own key. The `uuid()` template function already exists in Microcks.

## Domain example — the saga

The workflow `placeOrderSaga` of *Order saga* 1.0.0:

1. `createOrder` — `POST /orders` on *Order API* 1.0.0, with customer `c-7`, 2 × `ABC-1`, 25.0 EUR. The mock returns order `o-7f3c`.
2. `reserveStock` — `POST /reservations` on *Stock API* 1.0.0, with `orderId` = `o-7f3c`.
3. `chargePayment` — `POST /payments` on *Payment API* 1.0.0, with `orderId` = `o-7f3c` and `amount` = 25.0.
4. `confirmOrder` — `POST /orders/o-7f3c/confirm` on *Order API* 1.0.0.

## Domain examples

1. The saga service makes the 4 calls above. The test asks Microcks to verify `placeOrderSaga` for order `o-7f3c`. The verification passes with the 4 steps matched in order, without any session or added header.
2. Two tests run in parallel. Their sagas get orders `o-7f3c` and `o-91ab`. Each verification reports only the calls carrying its own key.
3. For `o-7f3c`, the service calls `chargePayment` before `reserveStock`. The verification fails: *step `reserveStock` expected before `chargePayment`*.
4. The service sends `reserveStock` with `orderId` = `o-1`. For `o-7f3c`, `reserveStock` is reported missing, and the call carrying `o-1` is reported as *not attached to any saga*.
5. For `o-7f3c`, the service never calls `confirmOrder`. The verification fails: *step `confirmOrder` missing*.

## Acceptance criteria

**AC-01: A saga is verified by its correlation key, with no session and no added header**
Given *Order saga* 1.0.0 and its overlay declaring the correlation of `placeOrderSaga`
And the mocks of *Order API*, *Stock API* and *Payment API* 1.0.0
When the saga service makes the 4 calls of order `o-7f3c`, and the test asks Microcks to verify `placeOrderSaga` for `o-7f3c`
Then the verification passes, with `createOrder`, `reserveStock`, `chargePayment` and `confirmOrder` matched in that order

**AC-02: Parallel sagas are verified separately**
Given two sagas run at the same time, with orders `o-7f3c` and `o-91ab`
When the test asks to verify `placeOrderSaga` for `o-7f3c`
Then only the calls carrying `o-7f3c` are taken into account

**AC-03: A step out of order fails the verification**
Given the saga of order `o-7f3c`
When the service calls `chargePayment` before `reserveStock`
Then the verification fails, stating that `reserveStock` was expected before `chargePayment`

**AC-04: A call carrying a wrong key is reported as not attached**
Given the saga of order `o-7f3c`
When the service sends `reserveStock` with `orderId` = `o-1`
Then the verification of `o-7f3c` reports `reserveStock` as missing
And it reports the call carrying `o-1` as not attached to any saga

**AC-05: A missing step fails the verification**
Given the saga of order `o-7f3c`
When the service makes the first 3 calls only
Then the verification fails, stating that `confirmOrder` is missing

## Technical notes

- **Recording.**
  - Microcks records the calls received by the mocks of the APIs linked to a workflow whose overlay declares a correlation, and only those: method, path, headers, body, response, and an **order index assigned on receipt**, never a timestamp.
  - Calls are kept in a dedicated collection, never in `TestResult`, with a configurable retention.
- **Order and data.**
  - A step is matched by its operation (method + path template of the linked API), in receipt order.
  - The value of the key reuses the expression evaluation of the runner: `$steps.createOrder.outputs.id` is resolved from the recorded **mock response**, then compared with where the overlay says the key lies in the next requests.
- **API and UI.** Verification by correlation value is exposed through the public Microcks API, so tests can call it, and is shown in the UI by reusing the result page.
- **One document, two directions.** The same Arazzo document is played against a provider (S5, S7) and checked against a consumer here.
- **Out of scope.**
  - Isolation by session, and key collisions: [S18](20-s18-verification-session.md).
  - Asynchronous steps (AsyncAPI sources): under *Later*.
  - `verifyWorkflow(...)` in the Testcontainers bindings: under *Later*.

## Dependencies

- [S2](03-s2-link.md) — the overlay and the links to the APIs whose mocks are called.

## Effort

8. Recording, correlation along the steps, and the order and data rule. Split by AC (order, key, parallel sagas) if it does not fit.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (8, at the ceiling)
- [x] Technical notes
- [x] Dependencies listed

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
