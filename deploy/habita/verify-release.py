"""Verifica el overlay local antes de activarlo; no accede a bases de datos."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
assert root.parent == Path('/var/www/habita-crm/releases'), 'Unexpected release root'
meta = json.loads((root / 'deployment-manifest.json').read_text())
for name, digest in {**meta['sourceFiles'], **meta['artifactFiles']}.items():
    file = (root / name).resolve()
    assert file.is_relative_to(root) and file.is_file(), 'Invalid release file'
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest, 'Release checksum mismatch: ' + name
tracked = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z']).decode().split('\0')
removed = set(meta['deletedFiles']) | {name for name in tracked if name and name not in meta['sourceFiles']}
for name in removed:
    file = (root / name).resolve()
    assert file.is_relative_to(root), 'Invalid removed path'
    if file.exists():
        assert file.is_file(), 'Not a regular removed file'
        file.unlink()
print(json.dumps({'verifiedSourceFiles': len(meta['sourceFiles']), 'verifiedArtifacts': len(meta['artifactFiles']), 'baseCommit': meta['baseCommit'], 'prunedCloneFiles': len(removed)}))
