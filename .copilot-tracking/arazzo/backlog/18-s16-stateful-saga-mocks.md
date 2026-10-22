# S16 — Mocks answer consistently along a workflow

Part of [the epic](00-epic.md). **Consumer side.**

## Story

**As a** developer of an order saga service tested against Microcks mocks,
**I want** the mocks to answer each saga step with the values produced by the previous steps of the same session,
**so that** my service sees a coherent conversation, for example the order id it created, rather than static examples that contradict each other.

## Domain examples

1. In a session on `placeOrderSaga`, `createOrder` returns order `o-42`. `confirmOrder` on `/orders/o-42/confirm` gets a confirmation for `o-42`, although the `confirmOrder` example in the OpenAPI document was written for `o-1`.
2. `reserveStock` is sent with `orderId` = `o-42`. The mock reservation `r-9` is returned with `orderId` = `o-42`.
3. Outside any session, the mocks of *Order API* keep answering with their static examples, unchanged.

## Acceptance criteria

**AC-01: A later step reuses an output of an earlier step**
Given a session open on `placeOrderSaga`, in which `createOrder` returned order `o-42`
When the service calls `POST /orders/o-42/confirm`
Then the mock answers with a confirmation of order `o-42`

**AC-02: Values a step receives flow into its response**
Given the same session
When the service calls `reserveStock` with `orderId` = `o-42`
Then the mock reservation is returned with `orderId` = `o-42`

**AC-03: Outside a session, mocks are unchanged**
Given no session is used
When the service calls `POST /orders/o-42/confirm`
Then the mock answers exactly as it does today

## Technical notes

- **Blocked by [ADR 2](16-adr2-mock-sessions.md).**
- The values come from the workflow's expressions:
  - `$steps.*.outputs` of earlier steps;
  - the step's own `parameters` and `requestBody` read in reverse, to know where a value goes in the response.
- The response template is the OpenAPI example of the matching operation.
- Build on the existing per-service `StateStore`, scoped by session, rather than on a new store.
- Only responses inside a session change. Microcks' default dispatching stays the same, which preserves backward compatibility.

## Dependencies

- [S15](17-s15-verify-consumer.md) — sessions and the recording of the calls.

## Effort

5. Session-scoped values injected into existing examples.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (≤ 8)
- [x] Technical notes
- [ ] Dependencies: **blocked by ADR 2**

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
