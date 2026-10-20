# Arazzo in Microcks — planning workspace

This branch (`planning/arazzo`) is never merged. It keeps the planning material of the Arazzo feature under version control.

| Path | What |
|---|---|
| `backlog/*.md` | Source of the epic, the ADR and the 13 stories. `{{KEY}}` placeholders become issue numbers at publication. |
| `backlog/publish.py` | Publishes them as issues on `SebastienDegodez/microcks`, resolves cross-references, and attaches the stories to the epic. Idempotent, matching on title. |
| `playbooks/implement-next-story.md` | What the scheduled *implementer* task does on each run. |
| `playbooks/review-arazzo-prs.md` | What the scheduled *reviewer* task does on each run. |

Once published, the issues on GitHub are the source of truth; the files under `backlog/` are the initial drafts.

Run: `python3 .copilot-tracking/arazzo/backlog/publish.py` (needs `gh api` with write access to the fork, and Issues enabled on it).
