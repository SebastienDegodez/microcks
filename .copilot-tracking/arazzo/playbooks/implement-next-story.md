# Playbook — implement the next Arazzo story

Followed by the scheduled *implementer* task on each run. One run delivers at most **one** story, or the rework of the one already in review.

## 0. Setup

1. Attach `SebastienDegodez/microcks` with push access, then clone it. Read-only clone `SebastienDegodez/skraft-plugin` for its skills.
2. Read this playbook from branch `planning/arazzo`, plus the repository's `AGENTS.md` and `AI-POLICY.md`.
3. Load these skraft skills from `plugins/skraft-framework/skills/` and follow them:
   - `outside-in-tdd`, `clean-architecture-java`, `clean-architecture-testing`, `test-design-mandates`;
   - `mutation-testing`, `craft-discipline`, `skraft-quality-bar`, `architecture-patterns`.
4. Stop and report if Issues are disabled on the fork or the epic *Epic: Arazzo workflows in Microcks* does not exist.

## 1. One story at a time

List the open PRs on the fork whose head branch starts with `arazzo/`.

- **One is open:**
  - its latest reviewer verdict for the current head SHA (marker `skraft-review` in a PR review, see the reviewer playbook) is `NEEDS_REWORK`: rework it (step 4), then stop;
  - otherwise (waiting for review, `APPROVED` and waiting for the maintainer to merge, or CI running): **stop, doing nothing**.
- **None is open:** pick the next story (step 2).

## 2. Pick the next story

Walk the epic's sub-issues **in their order**. Take the first open one that:

- is not the ADR (a decision is never implemented);
- has every issue listed under *Dependencies* closed (an ADR counts as closed only once its decision is recorded);
- has every *DoR* checkbox ticked.

None qualifies: post nothing, and report which story waits on what.

## 3. Deliver the story (SKRAFT, outside-in)

- **Approved behaviour.** The issue's Given/When/Then criteria. No `.feature` files. Never invent an outcome the issue does not state; stop and report instead.
- **Branch.** `arazzo/<issue-number>-<short-slug>` from the fork's `master`.
- **For each AC, in order:**
  1. Write one acceptance test entering through the **application use case**: real domain objects, mocks or in-memory fakes only on output gateways. Name it after the AC.
  2. Get a **behaviour RED**; a compilation error is not RED.
  3. Name the type and layer that will own the rule.
  4. Synthesize the smallest clean GREEN.
- **Then the outer circles,** one at a time: API endpoint, persistence (Testcontainers), HTTP calls (Microcks as contract mock), Angular component tests for UI stories.
- **Layout.**
  - Minion code in `minions/arazzo/` with modules `arazzo-domain`, `-application`, `-infrastructure`, `-api` and the two test modules `arazzo-unit-test` and `arazzo-integration-test`.
  - Webapp code in a `workflow` feature package with use cases and gateways.
  - ArchUnit rules guard the layers.
- **Builds.**
  - Maven Central reachable: run `mvn` locally.
  - Not reachable: drive every build through GitHub Actions. RED runs go on a throwaway branch `scratch/arazzo-<issue-number>-red`, deleted once captured. The story branch only ever receives green commits.
- **Quality bar** before opening the PR:
  - `mvn spotless:apply`;
  - full build green;
  - PIT mutation score 100% on new code, every survivor resolved;
  - ArchUnit green.
- **Commits.** Conventional Commits. **No AI co-author, `Assisted-by` or `Signed-off-by` trailer** (Microcks `AGENTS.md`). Never commit on red.

## 4. Open or update the PR

- **Base:** the fork's `master`. **Title:** a Conventional Commit, e.g. `feat: import an Arazzo document`. **Label:** `arazzo`.
- **Body:**
  - `Closes #<issue>`;
  - a table mapping each AC to its test(s);
  - links to the RED evidence (local output or CI run);
  - the mutation score;
  - what is out of scope;
  - an explicit AI disclosure line, as required by `AI-POLICY.md`.
- **Rework.**
  - Address every blocking finding of the latest `skraft-review` verdict with new commits.
  - Do not reply in review threads, and never reply to a human comment (AI policy: no auto-replies).
  - Reflect the changes in commit messages, and update the PR body's *Rework* section.
- Never merge, never close an issue, never push to `master` or `planning/arazzo`.

## 5. Report

End with: story taken, PR link, AC → test table, mutation score, and anything that blocked or was left out.
