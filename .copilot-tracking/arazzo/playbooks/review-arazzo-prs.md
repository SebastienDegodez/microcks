# Playbook — review Arazzo PRs against SKRAFT rules

Followed by the scheduled *reviewer* task on each run. It reviews; it never changes code, merges, or closes anything.

## 0. Setup

1. Attach `SebastienDegodez/microcks` with push access, then clone it. Read-only clone `SebastienDegodez/skraft-plugin`.
2. Load these skraft skills from `plugins/skraft-framework/skills/` and apply them:
   - `acceptance-review-criteria`, `adversarial-review-lenses`, `architecture-review-criteria`;
   - `test-design-mandates`, `clean-architecture-testing`, `clean-architecture-java`;
   - `outside-in-tdd` (sequence and evidence), `mutation-testing`, `craft-discipline`, `skraft-quality-bar`.

## 1. What to review

Open PRs on the fork whose head branch starts with `arazzo/`. Skip a PR when:
- a review containing the marker `skraft-review sha=<current head SHA>` already exists;
- its CI is still running. Review it on a later run.

## 2. Checks (each finding cites file and line, or the missing evidence)

**Scope and behaviour**
- The PR closes exactly one story, and implements no behaviour the story's ACs do not state.
- Every AC has at least one acceptance test whose name mirrors it, entering through the application use case, and asserting an observable outcome (return value or output gateway).

**Tests (skraft mandates)**
- Real domain objects; doubles only on output gateways. No mocked domain object.
- No direct test of constructors, getters, DTOs or simple value objects.
- No domain unit test unless Mandate 4 opens the gate.
- Exactly two test modules per context. Integration tests use real infrastructure (Testcontainers, Microcks as contract mock), never in-memory DB providers.
- No placeholder assertion. No skipped or disabled test.

**Sequence evidence**
- A behaviour RED exists for each AC: a local run output or a CI run on `scratch/arazzo-<n>-red`, linked in the PR body.
- The story branch has no red commit.

**Architecture**
- Layer and module rules of `clean-architecture-java`:
  - no Spring or Quarkus in domain or application;
  - use cases are `final` classes named after the action;
  - typed ids;
  - feature packages, no `port` / `adapter` naming.
- ArchUnit rules present and green.
- Business rules live in the domain, not in handlers (Post-GREEN placement check).

**Quality bar**
- CI green.
- PIT 100% on new code, every survivor resolved.
- Spotless clean.

**Contribution rules**
- Conventional Commits; no AI co-author, `Assisted-by` or `Signed-off-by` trailers.
- AI disclosure present in the PR body.

**Story-specific decisions**
- ADR decision honoured, in particular that the step order is owned by the run.
- Source linking by API name and version through the overlay.

## 3. Verdict and output

- Verdict per `acceptance-review-criteria`: `APPROVED`, `NEEDS_REWORK` (any blocking finding) or `REJECTED` (wrong story or approach).
- Post **one** PR review with event `COMMENT` (the PR author is the same account, so GitHub refuses approve and request changes). Its body has:
  - the verdict;
  - the blocking findings, then the non-blocking ones;
  - a last line `<sub>skraft-review sha=<head SHA> verdict=<VERDICT></sub>`.
- Inline comments only for blocking findings tied to a line.
- Never reply to human comments, never push, never merge.

## 4. Report

End with: PRs reviewed, verdict for each, and PRs skipped with the reason.
