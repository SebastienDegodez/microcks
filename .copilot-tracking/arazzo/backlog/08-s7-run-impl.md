# S7 — Run a workflow against implementation endpoints

Part of [the epic](00-epic.md).

## Story

**As an** API provider developer implementing API Pastry,
**I want** to run a workflow against my implementation, with one base URL per source description,
**so that** I check that my service honours the journey and not only each operation on its own.

## Domain examples

1. `readThenReprice` with `pastryApi` = `http://localhost:8080`, `pastry` = *Eclair Cafe* and `newPrice` = 2.6. The steps call `http://localhost:8080/pastry/Eclair%20Cafe`, then `PATCH` it; the run passes.
2. The same run with the secret *pastry-staging-token* selected: each call carries the authorization that the secret defines.
3. *Order fulfilment* run against implementations: `customerApi` = `https://customers.staging.example`, `orderApi` = `https://orders.staging.example`. Each step calls the base URL of its own source.

## Acceptance criteria

**AC-01: Each step calls the base URL set for its source**
Given *Order fulfilment* links `customerApi` and `orderApi`
When the API provider developer runs `placeOrder` against implementations with one base URL for each source
Then `getCustomer` calls the `customerApi` base URL and `createOrder` calls the `orderApi` base URL

**AC-02: A selected secret authenticates every call**
Given the secret *pastry-staging-token* exists in Microcks
When the API provider developer runs `readThenReprice` against `http://localhost:8080` with that secret
Then every call of the run carries the authorization defined by *pastry-staging-token*

**AC-03: The run records which implementation it targeted**
Given a run against `http://localhost:8080`
When the API provider developer opens the run
Then its target shows `pastryApi` → `http://localhost:8080`

## Technical notes

- The secret is resolved like the secrets of contract tests. Only secrets the user may read are offered.
- UI: the *Implementations* option of the run dialog (screen 5).

## Dependencies

- [S5](06-s5-run-mocks.md).

## Effort

3. An extension of the run target and secret resolution.

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
