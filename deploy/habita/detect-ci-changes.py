"""Detecta apps modificadas y permite reutilizar builds de un CI exitoso ancestro."""
import json
import os
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request


def changed_apps(paths):
    apps = set()
    for path in paths:
        if path.startswith("apps/api/"):
            apps.add("api")
        elif path.startswith("apps/frontend/"):
            apps.add("frontend")
        elif path.endswith(".md") or path.startswith("docs/"):
            continue
        else:
            # Workflows, despliegue y configuración compartida afectan a ambas.
            apps.update(("api", "frontend"))
    return sorted(apps)


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def api(path):
    request = urllib.request.Request(
        os.environ["GITHUB_API_URL"] + "/repos/" + os.environ["GITHUB_REPOSITORY"] + path,
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                 "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def reusable_baseline(branch, sha):
    query = urllib.parse.urlencode({"branch": branch, "event": "push",
                                    "status": "success", "per_page": 30})
    runs = api("/actions/workflows/quality.yml/runs?" + query)["workflow_runs"]
    for run in runs:
        candidate = run["head_sha"]
        if candidate == sha:
            continue
        ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", candidate, sha],
                                  capture_output=True, check=False)
        if ancestor.returncode != 0:
            continue
        artifacts = api(f"/actions/runs/{run['id']}/artifacts?per_page=100")["artifacts"]
        names = {item["name"] for item in artifacts if not item["expired"]}
        if {"habita-build-api", "habita-build-frontend"} <= names:
            return candidate, str(run["id"])
    return "", ""


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    event_name = os.environ["GITHUB_EVENT_NAME"]
    sha = os.environ["GITHUB_SHA"]
    baseline_run = ""
    base = ""
    branch = os.environ["GITHUB_REF_NAME"]
    release_push = event_name == "push" and branch == os.environ.get("RELEASE_BRANCH")
    if release_push:
        base, baseline_run = reusable_baseline(branch, sha)
    elif event_name == "pull_request":
        base = git("merge-base", event["pull_request"]["base"]["sha"], sha)
    elif event_name == "push":
        base = event.get("before", "")
    valid_base = base and set(base) != {"0"}
    apps = changed_apps(git("diff", "--name-only", "--no-renames", base, sha).splitlines()) if valid_base else ["api", "frontend"]
    # Un despacho manual siempre ofrece una verificación completa.
    if event_name == "workflow_dispatch":
        apps = ["api", "frontend"]
    outputs = {
        "apps": json.dumps(apps),
        "api": str("api" in apps).lower(),
        "frontend": str("frontend" in apps).lower(),
        "has_changes": str(bool(apps)).lower(),
        "baseline_run": baseline_run,
        "baseline_sha": base if baseline_run else "",
    }
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        for key, value in outputs.items():
            output.write(f"{key}={value}\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
        summary.write(f"Apps a verificar y compilar: {', '.join(apps) or 'ninguna'}.\n")
        if baseline_run:
            summary.write(f"Base de reutilización verificada: {base}, run {baseline_run}.\n")


if __name__ == "__main__":
    main()
