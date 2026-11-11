"""Calcula lotes a partir del inventario real de Vitest; no mantiene listas manuales."""
import json
import math
import os
from pathlib import Path
import sys

FILES_PER_SHARD = 40


def plan(inventory):
    if not isinstance(inventory, list) or not inventory:
        raise ValueError("El inventario de Vitest debe contener archivos de prueba.")
    files = [item.get("file") if isinstance(item, dict) else None for item in inventory]
    if any(not isinstance(file, str) or not file.strip() for file in files) or len(set(files)) != len(files):
        raise ValueError("Inventario de Vitest inválido o duplicado.")
    count = math.ceil(len(files) / FILES_PER_SHARD)
    if count > 256:
        raise ValueError("La suite supera el límite de 256 jobs de la matriz; revisar FILES_PER_SHARD.")
    base, remainder = divmod(len(files), count)
    return {"matrix": {"shard": list(range(1, count + 1))}, "shard_count": count,
            "file_count": len(files), "sizes": [base + (index < remainder) for index in range(count)]}


def verify_reports(directory, count):
    expected = {f"shard-{index}.json" for index in range(1, count + 1)}
    actual = {file.name for file in directory.iterdir()}
    if count < 1 or actual != expected or any(not (directory / name).is_file() or (directory / name).stat().st_size == 0 for name in expected):
        raise ValueError("Faltan reportes de lotes o hay archivos inesperados; no se permite cobertura parcial.")


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "--verify-reports":
        verify_reports(Path(sys.argv[2]), int(sys.argv[3]))
        return
    result = plan(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    print(json.dumps(result))
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as file:
            for key in ("matrix", "shard_count", "file_count"):
                file.write(f"{key}={json.dumps(result[key], separators=(',', ':'))}\n")
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as file:
            file.write(f"Frontend: {result['file_count']} archivos, {result['shard_count']} lotes automáticos: {result['sizes']}. Máximo 4 lotes simultáneos.\n")


if __name__ == "__main__":
    main()
