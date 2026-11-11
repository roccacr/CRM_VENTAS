"""Calcula lotes a partir del inventario real de Vitest; no mantiene listas manuales."""
import json
import math
import os
from pathlib import Path
import sys
import importlib.util

FILES_PER_SHARD = 40


def plan(inventory, durations=None, root=None, app="frontend"):
    if not isinstance(inventory, list) or not inventory:
        raise ValueError("El inventario de Vitest debe contener archivos de prueba.")
    files = [item.get("file") if isinstance(item, dict) else None for item in inventory]
    if any(not isinstance(file, str) or not file.strip() for file in files) or len(set(files)) != len(files):
        raise ValueError("Inventario de Vitest inválido o duplicado.")
    if root:
        files = [Path(file).resolve().relative_to(root.resolve()).as_posix() for file in files]
        if any(not file.startswith("test/") for file in files):
            raise ValueError("Las pruebas deben estar dentro de test/.")
    durations = durations or {}
    weights = {}
    for file in files:
        measured = durations.get(file)
        if isinstance(measured, (int, float)) and not isinstance(measured, bool) and 0 < measured <= 600000 and math.isfinite(measured):
            weights[file] = max(1000, measured)
        else:
            # El tamaño solo guía el primer reparto; nunca omite archivos sin historial.
            weights[file] = max(1000, (root / file).stat().st_size / 5) if root else 1000
    maximum_files = 80 if app == "api" else FILES_PER_SHARD
    count = max(math.ceil(len(files) / maximum_files), math.ceil(sum(weights.values()) / 180000) if durations else 1)
    count = min(count, len(files))
    if count > 256:
        raise ValueError("La suite supera el límite de 256 jobs de la matriz; revisar FILES_PER_SHARD.")
    # LPT: primero los archivos lentos, cada uno al lote con menor carga estimada.
    groups = [[] for _ in range(count)]
    loads = [0 for _ in range(count)]
    for file in sorted(files, key=lambda item: (-weights[item], item)):
        index = min((index for index in range(count) if len(groups[index]) < maximum_files), key=lambda index: (loads[index], len(groups[index]), index))
        groups[index].append(file)
        loads[index] += weights[file]
    return {"matrix": {"shard": list(range(1, count + 1))}, "shard_count": count,
            "file_count": len(files), "sizes": [len(group) for group in groups],
            "groups": groups, "weights": weights, "estimated_ms": loads}


def export_timings(report, manifest, root, destination):
    expected = {file for group in manifest["groups"] for file in group}
    measured = {}
    for result in report["testResults"]:
        file = Path(result["name"]).resolve().relative_to(root.resolve()).as_posix()
        if file in measured:
            raise ValueError("Un archivo se ejecutó más de una vez.")
        measured[file] = max(1000, min(600000, result["endTime"] - result["startTime"] + 1000))
    if set(measured) != expected or report.get("numFailedTests", 0) or report.get("numFailedTestSuites", 0):
        raise ValueError("El reporte no acredita todas las pruebas del plan.")
    destination.write_text(json.dumps(measured, sort_keys=True), encoding="utf-8")


def history_run(app):
    """Solo metadatos de runs push exitosos de la rama release del mismo repo; nunca ejecuta su contenido."""
    spec = importlib.util.spec_from_file_location("changes", Path(__file__).with_name("detect-ci-changes.py"))
    changes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(changes)
    branch = os.environ.get("RELEASE_BRANCH", "")
    if not branch:
        return ""
    from urllib.parse import urlencode
    try:
        runs = changes.api("/actions/workflows/quality.yml/runs?" + urlencode({"branch": branch, "event": "push", "status": "success", "per_page": 5}))["workflow_runs"]
        for run in runs:
            artifacts = changes.api(f"/actions/runs/{int(run['id'])}/artifacts?per_page=100")["artifacts"]
            if any(item["name"] == f"ci-timings-{app}" and not item["expired"] for item in artifacts):
                return str(int(run["id"]))
    except (OSError, KeyError, ValueError, TypeError):
        print("::warning::No fue posible recuperar los tiempos previos; se usará la estimación inicial.")
    return ""


def verify_reports(directory, count):
    expected = {f"shard-{index}.json" for index in range(1, count + 1)}
    actual = {file.name for file in directory.iterdir()}
    if count < 1 or actual != expected or any(not (directory / name).is_file() or (directory / name).stat().st_size == 0 for name in expected):
        raise ValueError("Faltan reportes de lotes o hay archivos inesperados; no se permite cobertura parcial.")


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--history-run":
        run = history_run(sys.argv[2])
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as file:
            file.write(f"run={run}\n")
        return
    if len(sys.argv) == 5 and sys.argv[1] == "--export-timings":
        export_timings(json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")), json.loads(Path(sys.argv[3]).read_text(encoding="utf-8")), Path.cwd(), Path(sys.argv[4]))
        return
    if len(sys.argv) == 4 and sys.argv[1] == "--verify-reports":
        verify_reports(Path(sys.argv[2]), int(sys.argv[3]))
        return
    history = Path("test-results/history/timings.json")
    durations = {}
    if history.is_file():
        try:
            value = json.loads(history.read_text(encoding="utf-8"))
            if isinstance(value, dict):
                durations = value
        except (ValueError, OSError):
            print("::warning::Historial de tiempos inválido; se usará la estimación inicial.")
    result = plan(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), durations, Path.cwd(), os.environ.get("CI_TEST_APP", "frontend"))
    Path("test-results/plan.json").write_text(json.dumps(result), encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("matrix", "shard_count", "file_count", "sizes", "estimated_ms")}))
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as file:
            for key in ("matrix", "shard_count", "file_count"):
                file.write(f"{key}={json.dumps(result[key], separators=(',', ':'))}\n")
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as file:
            seconds = [round(value / 1000, 1) for value in result["estimated_ms"]]
            file.write(f"{os.environ.get('CI_TEST_APP', 'frontend')}: {result['file_count']} archivos, {result['shard_count']} lotes por carga: {result['sizes']}; segundos de trabajo estimados: {seconds}. Máximo 6 lotes simultáneos por app.\n")


if __name__ == "__main__":
    main()
