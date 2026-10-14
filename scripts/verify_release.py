#!/usr/bin/env python3
"""Verify both release archives against the current source, byte for byte."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
archives = [root / 'personal-learning-skill.zip', root / 'dist/personal-learning.zip']
if archives[0].read_bytes() != archives[1].read_bytes():
    raise SystemExit('Release archives differ')
expected = {str(p.relative_to(root)): p.read_bytes() for p in (root / 'personal-learning').rglob('*') if p.is_file()}
for archive in archives:
    with zipfile.ZipFile(archive) as package:
        if package.testzip() is not None:
            raise SystemExit(f'Corrupt archive: {archive}')
        names = [i.filename for i in package.infolist() if not i.is_dir()]
        if len(names) != len(set(names)) or set(names) != set(expected):
            raise SystemExit(f'Archive manifest differs from source: {archive}')
        for name, content in expected.items():
            if package.read(name) != content:
                raise SystemExit(f'Stale content: {name} in {archive}')
projects = sorted(p.name for p in (root / 'personal-learning/data/projects').iterdir() if p.is_dir())
print(f'Release verified: two identical archives, {len(expected)} source files; projects: {", ".join(projects)}.')
