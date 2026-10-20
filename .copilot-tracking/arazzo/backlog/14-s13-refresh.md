Part of {{EPIC}}. **Dedicated PR, separate from the Arazzo feature PRs.**

## Story

**As an** API developer scanning the operations of an API in Microcks,
**I want** the API page laid out like the new Workflows screens, with aligned columns and consistent headers and actions,
**so that** I read samples, workflows and actions per operation at a glance and move between pages without relearning the layout.

## Domain examples

1. On *API Pastry - 2.0*, the *sample(s)* and *workflow(s)* counts of `GET /pastry`, `GET /pastry/{name}` and `PATCH /pastry/{name}` are vertically aligned, and the ⋮ menu of each row is a target of at least 40 px.
2. The header shows *API Pastry - 2.0*, then version *2.0.0* in muted text and the REST pill, in the same place as on a workflow detail page.
3. The Tests card keeps the conformance index B and the score 83.3 %, with *View Tests Runs* and *New Test* grouped in its footer.

## Acceptance criteria

**AC-01: Per-operation counts are aligned across rows**
Given *API Pastry - 2.0* has 3 operations with 1, 3 and 2 samples
When the API developer opens its page
Then the sample and workflow counts of the 3 operations are aligned in fixed columns

**AC-02: Header and sections follow the Workflows screens**
Given the *API Pastry - 2.0* page and the *API Pastry scenarios* workflow page
When the API developer moves from one to the other
Then the breadcrumb, the title with its muted version, and the section headers are laid out the same way

**AC-03: Nothing is lost**
Given the current *API Pastry - 2.0* page
When the refreshed page is displayed
Then every current element is still present and works:
- labels and *Edit Labels*;
- the Contracts, Statistics and MCP properties;
- the conformance card and its actions;
- AI Copilot and Manage Samples;
- operation rows, kebab actions and expansion.

## Technical notes

- Reference: screen 4 of the UI mock-up ("Services & APIs", refreshed version).
- Visual change only, so it is covered by Angular component tests and a screenshot comparison in light and dark themes. No backend change.
- Keep the PatternFly selectors and component inputs/outputs used by other pages (DESIGN.md).

## Dependencies

- None. It can ship before or after the Arazzo stories; if after {{S12}}, it includes the workflow additions.

## Effort

3. One page, no behaviour change.

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
