Part of {{EPIC}}.

## Story

**As an** API developer whose team already mocks *API Pastry - 2.0* in Microcks,
**I want** to import an Arazzo document that describes journeys across those APIs,
**so that** the journeys are kept in Microcks next to the contracts they exercise.

## Domain examples

1. `pastry.arazzo.yaml` declares Arazzo 1.0.1, title *API Pastry scenarios* 1.0.0, one source description `pastryApi`, and the workflows `readThenReprice` and `listThenReadFirst`. It is imported and appears as *API Pastry scenarios 1.0.0* with 2 workflows.
2. A document declaring `arazzo: 2.0.0` is refused with the reason *Unsupported Arazzo version: 2.0.0*.
3. A document where a step uses `onFailure` is refused with the reason *Unsupported step field: onFailure*.
4. *API Pastry scenarios 1.0.0* is re-imported with a third workflow, `repriceAll`. The existing document now has 3 workflows, and no second *API Pastry scenarios 1.0.0* exists.

## Acceptance criteria

**AC-01: A supported document is imported**
Given no Arazzo document named *API Pastry scenarios* exists in Microcks
When the API developer imports `pastry.arazzo.yaml`
Then *API Pastry scenarios 1.0.0* is available with the workflows `readThenReprice` and `listThenReadFirst`

**AC-02: An unsupported version is refused with its reason**
Given a document declaring Arazzo version 2.0.0
When the API developer imports it
Then the import is refused with the reason *Unsupported Arazzo version: 2.0.0*
And no document is added

**AC-03: A feature outside the supported subset is refused with its reason**
Given a document whose step `createOrder` declares `onFailure` actions
When the API developer imports it
Then the import is refused with the reason *Unsupported step field: onFailure*

**AC-04: Re-importing the same title and version updates the document**
Given *API Pastry scenarios 1.0.0* exists with 2 workflows
When the API developer imports a new revision of *API Pastry scenarios 1.0.0* that has 3 workflows
Then *API Pastry scenarios 1.0.0* has 3 workflows
And exactly one document named *API Pastry scenarios 1.0.0* exists

## Technical notes

- Supported subset, from the POC:
  - OpenAPI source descriptions only;
  - path, query and header parameters;
  - request payloads with `replacements`;
  - simple and regex criteria;
  - step and workflow outputs.
- Rejected: AsyncAPI sources, `operationPath`, nested workflows, `onSuccess`, `onFailure`, `successActions`, `failureActions`, `dependsOn`, cookie parameters, `jsonpath` and `xpath` criteria.
- Entry point: the existing artifact upload (`/api/artifact/upload`), recognising a root `arazzo` field, or a dedicated endpoint. Decide at DESIGN.
- Acceptance tests enter through the import use case, with an in-memory document repository. Integration tests cover the Mongo repository (Testcontainers) and the upload endpoint (in-process host).
- The parser and the subset checks move from `poc/arazzo-runner` into the Arazzo domain, driven by these criteria.

## Dependencies

None.

## Effort

5. A new aggregate, its persistence, and an import entry point; the parsing logic already exists in the POC.

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
