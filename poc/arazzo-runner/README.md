# Arazzo workflow runner — proof of concept

This folder checks whether [Arazzo](https://spec.openapis.org/arazzo/latest.html) workflows can be played by
Microcks against the OpenAPI contracts it already knows. It is standalone on purpose: it is not a module of the root
build and changes nothing in the existing Microcks code.

## What it does

`WorkflowRunner` loads an Arazzo document and the OpenAPI descriptions it references, then runs a workflow:

- steps run in order; each one calls its OpenAPI operation (`operationId`, or `$sourceDescriptions.<name>.<operationId>`
  when the same id exists in several descriptions);
- path, query and header parameters, request payloads and `replacements` (JSON pointers) are filled from runtime
  expressions: `$inputs.*`, `$steps.<id>.outputs.*`, `$statusCode`, `$method`, `$url`, `$response.body#/pointer`,
  `$response.header.*`, and `{$expr}` embedded in strings;
- `successCriteria` support simple conditions (`== != < <= > >=`, `&&`, `||`, literals) and `regex` criteria;
- step and workflow `outputs` are extracted; the first failing step ends the workflow with a report of what failed.

The base URL of each source description can be overridden, which is how a workflow is played against Microcks mocks
(`/rest/<service>/<version>`) instead of the real implementation.

Rejected explicitly (`ArazzoException`) rather than ignored: AsyncAPI sources, `operationPath`, nested workflows,
`onSuccess` / `onFailure` / `successActions` / `failureActions`, `dependsOn`, cookie parameters, `jsonpath` / `xpath`
criteria.

## Use cases demonstrated

`PastryMocksE2ETest` imports the unmodified `samples/APIPastry-openapi.yaml` into a running Microcks and plays
`src/test/resources/arazzo/pastry.arazzo.yaml` against its mocks:

- `readThenReprice` chains `GetPastryByName` and `PatchPastry` with values from the first response: the mocks support
  a coherent scenario;
- `listThenReadFirst` reads the first pastry of the list and fails, because the sample has no detail example for
  `Baba Rhum`: a workflow detects mock examples that do not form a coherent scenario.

## Tests

The suite follows the testing trophy:

| Layer | What | Where |
|---|---|---|
| Static | `javac -Xlint:all -Werror`, Microcks spotless formatting | `pom.xml` |
| Unit | conditions, JSON pointers, expressions, parser, OpenAPI index | `*Test` |
| Integration (bulk) | real Arazzo and OpenAPI files, real HTTP server, real JDK transport | `*IntegrationTest` |
| End-to-end | workflows against a running Microcks | `PastryMocksE2ETest` (needs `MICROCKS_URL`) |

Mutation testing runs with PIT (`DEFAULTS` mutators) on unit and integration tests; the build fails below 100% killed
mutants.

```bash
mvn verify                                   # static checks, tests, mutation testing
MICROCKS_URL=http://localhost:8585 mvn test -Dtest='*E2ETest'
```

CI: `.github/workflows/poc-arazzo-runner.yml`.

## Next steps toward Microcks

- Validate each step response against the OpenAPI schema with the existing Microcks validators.
- Store Arazzo documents as secondary artifacts of a service and expose the runner as a new test runner type.
- AsyncAPI sources (Arazzo 1.1) to check that an HTTP call publishes the expected event.
