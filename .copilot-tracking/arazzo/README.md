# Arazzo in Microcks — planning workspace

This branch (`planning/arazzo`) is never merged. It is the **only backlog** of the Arazzo feature: no GitHub issues are created. Everything starts from these files.

| Path | What |
|---|---|
| `backlog/00-epic.md` | Goal, decisions, delivery conventions, and the ordered list of stories. |
| `backlog/01-adr.md` | Storage of workflow runs. Its **Decision** section unblocks the run stories once it says `Status: decided`. |
| `backlog/16-adr2-mock-sessions.md` | Recording the calls an application makes to the mocks. Its **Decision** section unblocks the consumer-side stories S15 to S17. |
| `backlog/02-…` to `19-…` | Stories S1 to S17: persona, examples, Given/When/Then criteria, technical notes, dependencies (by story key), effort, DoR. |
| `playbooks/implement-next-story.md` | What the scheduled *implementer* task does on each run. |
| `playbooks/review-arazzo-prs.md` | What the scheduled *reviewer* task does on each run. |

## State of a story, read from git

| State | Evidence |
|---|---|
| Ready | Its file has every DoR box ticked, and all its dependencies are done. |
| In progress | Branch `arazzo/<key>-<slug>` exists on the fork, for example `arazzo/s1-import`. |
| In review | A PR from that branch is open against `master`. |
| Done | That PR is merged into `master`. |

Only the maintainer edits this branch: story content, DoR boxes, ADR decision, epic checkboxes. The scheduled tasks only read it.
