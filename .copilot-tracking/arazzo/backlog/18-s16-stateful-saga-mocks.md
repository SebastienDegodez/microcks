# S16 — Mocks remember what a saga created

Part of [the epic](00-epic.md). **Consumer side.**

## Story

**As a** developer of an order saga service tested against Microcks mocks,
**I want** a mock to answer with the data that earlier steps of the same saga created,
**so that** my service reads back a coherent state (the order it created, with its customer and amount) rather than a static example that contradicts it.

## What already works, and what this story adds

Microcks templates can already **echo the current request**: `{{ request.path[...] }}` and `{{ request.body/... }}`. So `confirmOrder` on `/orders/o-7f3c/confirm` can already answer for `o-7f3c`.

What is missing is data that the current request does not carry but that **an earlier step of the same saga produced**. For example, reading back an order returns the customer and the amount given when it was created.

## Domain examples

1. In saga `o-7f3c`:
   - `createOrder` was called with customer `c-7` and 25.0 EUR;
   - later, `getOrder` (`GET /orders/o-7f3c`) returns customer `c-7`, 25.0 EUR and status `CREATED`, although the example of `getOrder` was written for `c-1` and 10.0.
2. After `confirmOrder` on `o-7f3c`, `getOrder` on `o-7f3c` returns status `CONFIRMED`.
3. `getOrder` on an order no saga created (`o-0000`) answers with the static example, as today.

## Acceptance criteria

**AC-01: A mock returns the data an earlier step of the saga created**
Given saga `o-7f3c`, whose `createOrder` was called with customer `c-7` and 25.0 EUR
When the service calls `GET /orders/o-7f3c`
Then the mock answers with customer `c-7`, 25.0 EUR and status `CREATED`

**AC-02: A later step updates what the mock returns**
Given saga `o-7f3c`, after `confirmOrder`
When the service calls `GET /orders/o-7f3c`
Then the mock answers with status `CONFIRMED`

**AC-03: Outside a known saga, mocks are unchanged**
Given no saga created order `o-0000`
When the service calls `GET /orders/o-0000`
Then the mock answers exactly as it does today

## Technical notes

- The saga instance comes from the correlation of [S15](17-s15-verify-consumer.md), or from the session of [S18](20-s18-verification-session.md) when one is used.
- What a step writes and what a later step reads is declared in the overlay, next to the correlation. For example, `createOrder` writes `customer` and `amount`, and `confirmOrder` writes `status` = `CONFIRMED`.
- Build on the existing per-service `StateStore`, scoped by saga instance, rather than on a new store.
- Default dispatching is unchanged for any call that belongs to no known saga, which preserves backward compatibility.

## Dependencies

- [S15](17-s15-verify-consumer.md) — recording and saga instances.

## Effort

5. A state per saga instance, declared in the overlay and read by the mocks.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (≤ 8)
- [ ] Technical notes: **overlay syntax for what a step writes, to confirm**
- [x] Dependencies listed

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
