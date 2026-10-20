# Playbook — implement the next Arazzo story

Followed by the scheduled *implementer* task on each run. One run delivers at most **one** story, or the rework of the one already in review.

The backlog is the folder `.copilot-tracking/arazzo/backlog/` on branch `planning/arazzo`. **No GitHub issue is ever created, read or referenced**: stories are identified by their key (S1…S13) and their file.

## 0. Setup

1. Attach `SebastienDegodez/microcks` with push access and clone it. Set `remote.origin.fetch` to `+refs/heads/*:refs/remotes/origin/*`, then fetch. Read-only clone `SebastienDegodez/skraft-plugin` for its skills.
2. Read from `origin/planning/arazzo`:
   - `.copilot-tracking/arazzo/README.md`;
   - `backlog/00-epic.md` and `backlog/01-adr.md`;
   - this playbook.
   Read the repository's `AGENTS.md` and `AI-POLICY.md` from `master`.
3. Load these skraft skills from `plugins/skraft-framework/skills/` and follow them:
   - `outside-in-tdd`, `clean-architecture-java`, `clean-architecture-testing`, `test-design-mandates`;
   - `mutation-testing`, `craft-discipline`, `skraft-quality-bar`, `architecture-patterns`.

## 1. One story at a time

Look at the fork's branches `arazzo/*` and the PRs from them.

- **A PR from `arazzo/*` is open:**
  - its latest reviewer verdict for the current head SHA (marker `skraft-review sha=… verdict=…` in a PR review) is `NEEDS_REWORK`: rework it (step 4), then stop;
  - otherwise (waiting for review, `APPROVED` and waiting for the maintainer to merge, or CI running): **stop, doing nothing**.
- **No open PR, but a branch `arazzo/*` that is not merged into `master`:**
  - its last commit is less than 6 hours old: another run is delivering it, so stop;
  - older: resume that story on that branch.
- **Otherwise:** pick the next story (step 2).

## 2. Pick the next story

A story is **done** when its branch `arazzo/<key>-*` is merged into `master`. Walk the *Stories* list of `00-epic.md` in order, and take the first story that:

- is not done and is not the ADR (a decision is never implemented);
- has every story listed under its *Dependencies* done. When the ADR is listed, its **Decision** section must say `Status: decided`;
- has every *DoR* box ticked in its file.

None qualifies: report which story waits on what, and stop.

As soon as a story is picked, push the branch `arazzo/<key lowercase>-<short-slug>` (e.g. `arazzo/s1-import`) from `master`. It is the lock that stops concurrent runs.

## 3. Deliver the story (SKRAFT, outside-in)

- **Approved behaviour.** The story file's Given/When/Then criteria. No `.feature` files. Never invent an outcome the file does not state; report the open question and stop.
- **For each AC, in order:**
  1. Write one acceptance test entering through the **application use case**: real domain objects, mocks or in-memory fakes only on output gateways. Name it after the AC.
  2. Run it and get a **behaviour RED**; a compilation error is not RED. Keep the RED output for the PR.
  3. Name the type and layer that will own the rule.
  4. Synthesize the smallest clean GREEN.
- **Then the outer circles,** one at a time: API endpoint, persistence (Testcontainers), HTTP calls (Microcks as contract mock), Angular component tests for UI stories.
- **Layout.**
  - Minion code in `minions/arazzo/` with modules `arazzo-domain`, `-application`, `-infrastructure`, `-api` and the two test modules `arazzo-unit-test` and `arazzo-integration-test`.
  - Webapp code in a `workflow` feature package with use cases and gateways.
  - ArchUnit rules guard the layers.
- **Builds run locally with Maven** (Maven Central is reachable). If a build needs Docker and none is available, run that circle in GitHub Actions and link the run.
- **Quality bar** before opening the PR:
  - `mvn spotless:apply`;
  - full build green;
  - PIT mutation score 100% on new code, every survivor resolved;
  - ArchUnit green.
- **Commits.** Conventional Commits. **No AI co-author, `Assisted-by` or `Signed-off-by` trailer** (Microcks `AGENTS.md`). Never commit on red.

## 4. Open or update the PR

- **Base:** the fork's `master`. **Title:** a Conventional Commit, e.g. `feat: import an Arazzo document`. **Label:** `arazzo`.
- **Body:**
  - `Story: S<n>`, with a link to its file on `planning/arazzo`;
  - a table mapping each AC to its test(s);
  - the RED evidence, per AC: the failing assertion, local or CI;
  - the mutation score;
  - what is out of scope;
  - an explicit AI disclosure line, as required by `AI-POLICY.md`.
- **Rework.**
  - Address every blocking finding of the latest `skraft-review` verdict with new commits.
  - Do not reply in review threads, and never reply to a human comment (AI policy: no auto-replies).
  - Reflect the changes in commit messages, and update the PR body's *Rework* section.
- Never merge, never push to `master` or `planning/arazzo`, never create a GitHub issue.

## 5. Report

End with: story taken, PR link, AC → test table, mutation score, and anything that blocked or was left out.
