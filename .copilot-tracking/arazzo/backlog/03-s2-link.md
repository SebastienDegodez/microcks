# S2 — Link Arazzo source descriptions to Microcks APIs

Part of [the epic](00-epic.md).

## Story

**As an** API developer importing an Arazzo document,
**I want** each source description linked to the API with the same name and version in Microcks,
**so that** I know before running which workflows can run and which API is still missing.

## Why an overlay

Microcks identifies an API by **name and version** everywhere. An Arazzo source description only carries `name` (a local identifier such as `pastryApi`), `url` and `type`: no API name or version. Following the Microcks convention for complementary information (`APIMetadata`, `APIExamples`), a **secondary artifact overlay** gives that information without changing the Arazzo document:

```yaml
apiVersion: mocks.microcks.io/v1alpha1
kind: APIWorkflowSources          # kind name to confirm
metadata:
  name: API Pastry scenarios      # Arazzo info.title
  version: 1.0.0                  # Arazzo info.version
sources:
  pastryApi:
    name: API Pastry - 2.0
    version: 2.0.0
```

## Domain examples

1. *API Pastry scenarios* 1.0.0 comes with an overlay mapping `pastryApi` to *API Pastry - 2.0* 2.0.0. `pastryApi` is linked, and the 3 operations its steps call (`GetPastries`, `GetPastryByName`, `PatchPastry`) are found.
2. *Order fulfilment* 1.0.0 comes with an overlay mapping:
   - `customerApi` to *Customer API* 1.0.0, which exists, so it is linked;
   - `orderApi` to *Order API* 1.0.0, which does not exist in Microcks, so it is not linked.
   `searchThenRead` is runnable; `placeOrder` is not runnable because `orderApi` is not linked.
3. *Order fulfilment* 1.0.0 is imported **without** an overlay. No source is linked, and both workflows are not runnable, with the reason *no API name and version for this source*.
4. A step of `readThenReprice` calls `DeletePastry`, which *API Pastry - 2.0* 2.0.0 does not define. `readThenReprice` is not runnable, with the reason *Operation DeletePastry not found in API Pastry - 2.0 2.0.0*.
5. *Order API* 1.0.0 is imported later. `orderApi` becomes linked, and `placeOrder` becomes runnable.

## Acceptance criteria

**AC-01: The overlay links a source to the API with that name and version**
Given *API Pastry - 2.0* 2.0.0 exists in Microcks
When the API developer imports *API Pastry scenarios* 1.0.0 with an overlay mapping `pastryApi` to *API Pastry - 2.0* 2.0.0
Then `pastryApi` is linked to *API Pastry - 2.0* 2.0.0
And `readThenReprice` and `listThenReadFirst` are runnable

**AC-02: A source mapped to an API absent from Microcks stays unlinked**
Given *Customer API* 1.0.0 exists and *Order API* 1.0.0 does not
When the API developer imports *Order fulfilment* 1.0.0 with its overlay
Then `customerApi` is linked and `orderApi` is not linked
And `searchThenRead` is runnable and `placeOrder` is not runnable because `orderApi` is not linked

**AC-03: Without overlay, sources are not linked**
Given *Order fulfilment* 1.0.0 has no overlay
When the API developer imports it
Then no source is linked, and its workflows are not runnable, with the reason *no API name and version for this source*

**AC-04: A step calling an operation the linked API does not define is reported**
Given `pastryApi` is linked to *API Pastry - 2.0* 2.0.0
When a document whose step calls `DeletePastry` is imported
Then its workflow is not runnable, with the reason *Operation DeletePastry not found in API Pastry - 2.0 2.0.0*

**AC-05: Importing the missing API later links the source**
Given `orderApi` of *Order fulfilment* 1.0.0 is mapped to *Order API* 1.0.0, which does not exist yet
When *Order API* 1.0.0 is imported in Microcks
Then `orderApi` is linked and `placeOrder` is runnable

## Technical notes

- The overlay is a secondary artifact (`mainArtifact=false`), imported like `APIMetadata` / `APIExamples`. It is matched to its Arazzo document by `metadata.name` and `metadata.version` = Arazzo `info.title` / `info.version`.
- The `kind` name (`APIWorkflowSources`) is a proposal to confirm.
- [S15](17-s15-verify-consumer.md) extends the same overlay with a `workflows.<id>.correlation` section, which says where each step carries the saga's correlation key, and [S16](18-s16-stateful-saga-mocks.md) with what a step writes. This story only parses and keeps `sources`.
- Links are recomputed when an API or an overlay is imported or deleted.
- Acceptance tests enter through the import use cases (document and overlay), with in-memory gateways for documents and services.
- Out of scope: resolving the `url` of a source to read its OpenAPI `info.title` / `info.version`.

## Dependencies

- [S1](02-s1-import.md) — provides the imported document.

## Effort

5. One new secondary artifact, the name-and-version matching rule, and a "runnable" state derived from the links and operations.

## DoR

- [x] Problem statement is a user problem
- [x] Specific persona
- [x] 3+ domain examples with real values
- [x] Given/When/Then scenarios
- [x] Each AC traces to an example
- [x] Right-sized (≤ 8)
- [x] Technical notes (overlay `kind` name to confirm)
- [x] Dependencies listed

---
_Drafted with AI assistance (Claude); to be reviewed by the maintainer._
