"""Retira solo artefactos de Habita; current y los datos compartidos se conservan."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import shutil


RELEASE = re.compile(r"[0-9]{14}-[a-zA-Z0-9][a-zA-Z0-9._-]*")
LEGACY_PACKAGES = {
    "calendar-colors-overlay-20261103.tar.gz",
    "calendar-fix-overlay-20261103.tar.gz",
    "calendar-lifecycle-overlay.tar.gz",
    "calendar-ux-overlay-20261103.tar.gz",
    "campana-1794334124462.tar.gz",
    "habita-release.tar.gz",
    "lifecycle-ui-final.tgz",
    "netsuite-integration-baseline-20261103.tar.gz",
}


def active_release(root):
    """Un current externo o incompleto impide cualquier borrado."""
    root = Path(root).absolute()
    if any(path.is_symlink() for path in (root, root / "releases", root / "shared")):
        raise ValueError("La raíz de Habita y sus directorios no admiten enlaces.")
    root = root.resolve(strict=True)
    releases = (root / "releases").resolve(strict=True)
    current = (root / "current").resolve(strict=True)
    if current.parent != releases or not RELEASE.fullmatch(current.name):
        raise ValueError("current debe apuntar directamente a un release de Habita.")
    for entry in ("apps/api/dist/main.js", "apps/frontend/dist/index.html"):
        if not (current / entry).is_file():
            raise ValueError("El release activo está incompleto; no se limpia.")
    return root, current


def package_release(name):
    for suffix in (".tar.gz", "-activate.sh"):
        if name.endswith(suffix):
            release = name.removesuffix(suffix)
            if RELEASE.fullmatch(release):
                return release
    return None


def plan(root, before=None, include_legacy=False):
    """Nunca selecciona paquetes posteriores: pueden pertenecer al próximo push."""
    root, current = active_release(root)
    boundary = before or current.name
    if not RELEASE.fullmatch(boundary):
        raise ValueError("Límite de release inválido.")
    targets = [
        path for path in (root / "releases").iterdir()
        if path != current and RELEASE.fullmatch(path.name)
        and (path.name == boundary or path.name[:14] < boundary[:14])
        and not path.is_symlink() and path.is_dir()
    ]
    for path in (root / "shared").iterdir():
        release = package_release(path.name)
        if path.is_file() and not path.is_symlink() and (
            (release is not None and (release == boundary or release[:14] < boundary[:14]))
            or (include_legacy and path.name in LEGACY_PACKAGES)
        ):
            targets.append(path)
    return sorted(targets)


def remove(root, targets):
    """Revalida cada destino; rmtree no sigue el .env enlazado de un release viejo."""
    for path in targets:
        root, current = active_release(root)
        path = Path(path).absolute()
        if path.is_symlink() or path.resolve(strict=True) == current:
            raise ValueError("No se elimina current ni un enlace simbólico.")
        path = path.resolve(strict=True)
        if path.parent == root / "releases" and RELEASE.fullmatch(path.name):
            if path.resolve(strict=True).parent != (root / "releases").resolve():
                raise ValueError("Release fuera de la raíz autorizada.")
            shutil.rmtree(path)
        elif path.parent == root / "shared" and (package_release(path.name) or path.name in LEGACY_PACKAGES):
            if not path.is_file():
                raise ValueError("Un paquete debe ser un archivo regular.")
            path.unlink()
        else:
            raise ValueError("Destino ajeno a los artefactos autorizados de Habita.")


def main():
    # La CLI productiva no permite redirigir la limpieza a otro proyecto.
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--before")
    parser.add_argument("--include-legacy-packages", action="store_true")
    parser.add_argument("--lock-fd", type=int)
    parser.add_argument("--stale-only", action="store_true", help="Solo restos con más de 24 horas; respeta cargas recientes.")
    args = parser.parse_args()
    root = Path("/var/www/habita-crm")
    lock_path = root / "shared/deploy.lock"
    if args.lock_fd is None:
        lock_fd = os.open(lock_path, os.O_RDWR)
    else:
        lock_fd = args.lock_fd
        expected, actual = lock_path.stat(), os.fstat(lock_fd)
        if (expected.st_dev, expected.st_ino) != (actual.st_dev, actual.st_ino):
            raise ValueError("El descriptor no corresponde al bloqueo de Habita.")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _, current = active_release(root)
        cutoff = datetime.now(timezone.utc) - timedelta(days=1)
        boundary = cutoff.strftime("%Y%m%d%H%M%S") + "-retention" if args.stale_only else args.before
        targets = plan(root, boundary, args.include_legacy_packages)
        if args.stale_only:
            targets = [path for path in targets if path.stat().st_mtime < cutoff.timestamp()]
        print(json.dumps({
            "active": current.name, "apply": args.apply,
            "releases": [path.name for path in targets if path.parent.name == "releases"],
            "packages": [path.name for path in targets if path.parent.name == "shared"],
        }), flush=True)
        if args.apply:
            remove(root, targets)
            print(json.dumps({"removed": len(targets), "active": active_release(root)[1].name}), flush=True)
    finally:
        # FD heredado pertenece al activador: no liberar su bloqueo compartido.
        if args.lock_fd is None:
            os.close(lock_fd)


if __name__ == "__main__":
    main()
