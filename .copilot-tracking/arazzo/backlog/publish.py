#!/usr/bin/env python3
"""Create the Arazzo epic, ADR and stories on the fork, resolve {{KEY}} references, attach sub-issues.

Idempotent: an issue whose exact title already exists on the repo is reused, never duplicated.
"""
import json
import os
import re
import subprocess
import sys

REPO = "SebastienDegodez/microcks"
DIR = os.path.dirname(os.path.abspath(__file__))

ISSUES = [
    ("EPIC", "00-epic.md", "Epic: Arazzo workflows in Microcks", ["arazzo", "type/feature", "priority/P1", "effort/21"]),
    ("ADR", "01-adr.md", "ADR: storage of workflow runs (TestResult, WorkflowResult or both)", ["arazzo", "type/question", "priority/P1", "effort/2"]),
    ("S1", "02-s1-import.md", "Import an Arazzo document", ["arazzo", "type/feature", "priority/P1", "effort/5", "area/domain", "area/api"]),
    ("S2", "03-s2-link.md", "Link Arazzo source descriptions to Microcks APIs", ["arazzo", "type/feature", "priority/P1", "effort/5", "area/domain", "area/ui"]),
    ("S3", "04-s3-browse.md", "Browse workflows", ["arazzo", "type/feature", "priority/P1", "effort/5", "area/api", "area/ui"]),
    ("S4", "05-s4-detail.md", "Read the steps of a workflow", ["arazzo", "type/feature", "priority/P1", "effort/5", "area/domain", "area/ui"]),
    ("S5", "06-s5-run-mocks.md", "Run a workflow against Microcks mocks (Arazzo minion walking skeleton)", ["arazzo", "type/feature", "priority/P1", "effort/8", "area/domain", "area/infra", "area/ui"]),
    ("S6", "07-s6-why-failed.md", "Understand why a workflow step failed", ["arazzo", "type/feature", "priority/P1", "effort/5", "area/api", "area/ui"]),
    ("S7", "08-s7-run-impl.md", "Run a workflow against implementation endpoints", ["arazzo", "type/feature", "priority/P2", "effort/3", "area/infra", "area/ui"]),
    ("S8", "09-s8-missing-inputs.md", "Refuse a workflow run whose inputs are missing", ["arazzo", "type/feature", "priority/P2", "effort/2", "area/domain"]),
    ("S9", "10-s9-schema.md", "Validate workflow step responses against the OpenAPI schema", ["arazzo", "type/feature", "priority/P2", "effort/5", "area/domain", "area/infra"]),
    ("S10", "11-s10-coherence.md", "Spot mock examples that do not form a coherent scenario", ["arazzo", "type/feature", "priority/P2", "effort/3", "area/domain", "area/ui"]),
    ("S11", "12-s11-history.md", "Follow the workflow runs history", ["arazzo", "type/feature", "priority/P2", "effort/3", "area/api", "area/ui"]),
    ("S12", "13-s12-service-page.md", "See the workflows that use an API on its page", ["arazzo", "type/feature", "priority/P2", "effort/3", "area/ui"]),
    ("S13", "14-s13-refresh.md", "Refresh the API page layout", ["type/feature", "priority/P3", "effort/3", "area/ui"]),
]


def gh(*args, payload=None):
    cmd = ["gh", "api", *args]
    if payload is not None:
        cmd += ["--input", "-"]
    out = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                         capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"gh api {' '.join(args)} failed: {out.stdout} {out.stderr}")
    return json.loads(out.stdout) if out.stdout.strip() else None


def existing_by_title():
    issues = gh(f"repos/{REPO}/issues?state=all&per_page=100")
    return {i["title"]: i for i in issues if "pull_request" not in i}


def main():
    existing = existing_by_title()
    created = {}
    for key, file, title, labels in ISSUES:
        if title in existing:
            created[key] = existing[title]
            print(f"reuse  #{existing[title]['number']} {title}")
            continue
        body = open(os.path.join(DIR, file), encoding="utf-8").read()
        issue = gh("-X", "POST", f"repos/{REPO}/issues", payload={"title": title, "body": body, "labels": labels})
        created[key] = issue
        print(f"create #{issue['number']} {title}")

    refs = {key: f"#{issue['number']}" for key, issue in created.items()}
    for key, file, title, _ in ISSUES:
        body = open(os.path.join(DIR, file), encoding="utf-8").read()
        resolved = re.sub(r"\{\{(\w+)\}\}", lambda m: refs[m.group(1)], body)
        if created[key].get("body") != resolved:
            gh("-X", "PATCH", f"repos/{REPO}/issues/{created[key]['number']}", payload={"body": resolved})
            print(f"refs   #{created[key]['number']}")

    epic = created["EPIC"]["number"]
    attached = {i["number"] for i in (gh(f"repos/{REPO}/issues/{epic}/sub_issues?per_page=100") or [])}
    for key, *_ in ISSUES[1:]:
        if created[key]["number"] not in attached:
            gh("-X", "POST", f"repos/{REPO}/issues/{epic}/sub_issues", payload={"sub_issue_id": created[key]["id"]})
            print(f"sub    #{created[key]['number']} → #{epic}")
    print(json.dumps({k: v["number"] for k, v in created.items()}))


if __name__ == "__main__":
    main()
