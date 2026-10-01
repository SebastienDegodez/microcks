#!/usr/bin/env python3
"""Turns the results of the POC build into GitHub Actions annotations: build errors, failed tests, surviving
mutants and the mutation score. Annotations stay readable through the checks API once the run is over."""
import glob
import os
import xml.etree.ElementTree as ET

MAX_LEN = 600


def escape(text):
    return text[:MAX_LEN].replace("%", "%25").replace("\r", "").replace("\n", "%0A")


def annotate(level, message, title, file=None, line=None):
    location = f"file={file},line={line}," if file else ""
    print(f"::{level} {location}title={title}::{escape(message)}")


if os.path.exists("build.log"):
    errors = [l.strip() for l in open("build.log", encoding="utf-8", errors="replace") if l.startswith("[ERROR]")]
    for line in errors[:15]:
        annotate("error", line, "Build")

for report in glob.glob("target/surefire-reports/TEST-*.xml"):
    for case in ET.parse(report).getroot().iter("testcase"):
        for problem in list(case.findall("failure")) + list(case.findall("error")):
            annotate("error", f"{case.get('classname')}.{case.get('name')}: {problem.get('message')}\n"
                     f"{(problem.text or '')[:300]}", "Test")
        for skipped in case.findall("skipped"):
            annotate("warning", f"{case.get('classname')}.{case.get('name')} skipped: {skipped.get('message')}",
                     "Test skipped")

mutations = "target/pit-reports/mutations.xml"
if os.path.exists(mutations):
    all_mutations = list(ET.parse(mutations).getroot().iter("mutation"))
    killed = [m for m in all_mutations if m.get("detected") == "true"]
    annotate("notice", f"{len(killed)}/{len(all_mutations)} mutants killed", "Mutation score")
    for m in all_mutations:
        if m.get("detected") != "true":
            path = "poc/arazzo-runner/src/main/java/" + m.findtext("mutatedClass").rsplit(".", 1)[0].replace(".", "/") \
                + "/" + m.findtext("sourceFile")
            annotate("error", f"{m.get('status')} {m.findtext('mutator').rsplit('.', 1)[-1]} in "
                     f"{m.findtext('mutatedMethod')}: {m.findtext('description')}", "Surviving mutant", path,
                     m.findtext("lineNumber"))
