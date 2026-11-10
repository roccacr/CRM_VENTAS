"""Package CI builds once. Each environment receives the same archive."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

root = Path(__file__).resolve().parents[2]
output = Path(sys.argv[1]).resolve()
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
if commit != os.environ["GITHUB_SHA"]:
    raise SystemExit("El checkout no coincide con el commit de CI.")
run = os.environ["GITHUB_RUN_ID"]
attempt = os.environ["GITHUB_RUN_ATTEMPT"]
if not re.fullmatch(r"[0-9]+", run) or not re.fullmatch(r"[0-9]+", attempt):
    raise SystemExit("Identificador de ejecución inválido.")
release = f"{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{commit[:7]}-ci-{run}-{attempt}"

runtime = (
    "apps/api/package.json",
    "apps/api/pnpm-lock.yaml",
    "apps/api/certs/rds-global-bundle.pem",
    "deploy/habita/activate-release.sh",
    "deploy/habita/verify-release.py",
)
output.mkdir(exist_ok=False, parents=True)
with tempfile.TemporaryDirectory() as scratch:
    payload = Path(scratch)
    sources = {}
    artifacts = {}
    for name in runtime:
        target = payload / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
        with target.open("rb") as file:
            sources[name] = hashlib.file_digest(file, "sha256").hexdigest()
    for app, entry in (("api", "main.js"), ("frontend", "index.html")):
        folder = f"apps/{app}/dist"
        if not (root / folder / entry).is_file():
            raise SystemExit(f"Build incompleto de {app}.")
        for source in sorted((root / folder).rglob("*")):
            if source.is_symlink():
                raise SystemExit(f"Enlace inesperado: {source}")
            if source.is_file():
                name = source.relative_to(root).as_posix()
                target = payload / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
                with target.open("rb") as file:
                    artifacts[name] = hashlib.file_digest(file, "sha256").hexdigest()
    (payload / "deployment-manifest.json").write_text(
        json.dumps({
            "baseCommit": commit,
            "sourceFiles": sources,
            "artifactFiles": artifacts,
            "changedApps": json.loads(os.environ.get("HABITA_CHANGED_APPS", '["api","frontend"]')),
            "reusedBuild": {
                "run": os.environ.get("HABITA_BASELINE_RUN", ""),
                "commit": os.environ.get("HABITA_BASELINE_SHA", ""),
            },
        }, indent=2),
        encoding="utf-8",
    )
    archive = output / f"{release}.tar.gz"
    with tarfile.open(archive, "w:gz") as package:
        package.add(payload, arcname=".")
    shutil.copyfile(payload / "deploy/habita/activate-release.sh", output / "activate-release.sh")

with archive.open("rb") as file:
    digest = hashlib.file_digest(file, "sha256").hexdigest()
(output / "release.txt").write_text(f"{release} {digest} {commit}\n", encoding="ascii")
