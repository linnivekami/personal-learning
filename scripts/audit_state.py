#!/usr/bin/env python3
"""Read-only structural/evidence audit; does not assess teaching effectiveness."""
import argparse
from pathlib import Path
import re
import sys
import json
import hashlib
import subprocess
import tempfile


def cells(line):
    return [v.strip() for v in re.split(r'(?<!\\)\|', line.strip())[1:-1]]


def mastery_rows(path):
    header = None
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if line.startswith('| Topic |'):
            candidate = cells(line)
            header = candidate if any(c.startswith('Mastery') for c in candidate) else None
            continue
        if header is None:
            continue
        if not line.startswith('|'):
            if line.strip():
                header = None
            continue
        row = cells(line)
        if row and re.fullmatch(r'[- :]+', row[0]):
            continue
        yield number, header, row


def audit(source):
    errors = []
    count = pending = 0
    baseline_path = source / 'data/legacy-audit-baseline.json'
    baseline = json.loads(baseline_path.read_text()).get('projects', {}) if baseline_path.exists() else {}
    for path in sorted((source / 'data/projects').glob('*/state.md')):
        seen = set()
        for line, header, row in mastery_rows(path):
            location = f'{path.parent.name}/state.md:{line}'
            if len(row) != len(header):
                errors.append(f'{location}: table has {len(row)} cells; expected {len(header)}')
                continue
            topic = row[0]
            key = re.sub(r'\s+', ' ', topic.replace('**', '')).casefold()
            if key in seen:
                errors.append(f'{location}: duplicate topic {topic}')
            seen.add(key)
            mi = next(i for i, c in enumerate(header) if c.startswith('Mastery'))
            grade = row[mi]
            if not re.fullmatch('[0-5]', grade):
                errors.append(f'{location}: Mastery must be integer 0–5: {grade}')
                continue
            count += 1
            if 'Evidence' not in header:
                errors.append(f'{location}: Evidence column missing')
                continue
            evidence = row[header.index('Evidence')]
            if not evidence or evidence == '-':
                errors.append(f'{location}: missing evidence or explicit untested description')
            waiting = '待按 v1.2 核验：' in evidence
            if waiting:
                pending += 1
                if not evidence.split('待按 v1.2 核验：', 1)[1].strip():
                    errors.append(f'{location}: historical verification gap missing')
            if int(grade) >= 2 and not waiting:
                fingerprint = hashlib.sha256(json.dumps(row, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
                grandfathered = baseline.get(path.parent.name, {}).get(topic) == fingerprint
                evidence_path = path.parent / 'evidence.json'
                structured = json.loads(evidence_path.read_text()).get('topics', {}).get(topic) if evidence_path.exists() else None
                if not grandfathered:
                    if not structured:
                        errors.append(f'{location}: structured evidence required for new or changed independent grade')
                    else:
                        try:
                            with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as handle:
                                json.dump(structured.get('events', []), handle)
                                handle.flush()
                                result = subprocess.run(['node', str(source / 'scripts/state.mjs'), 'grade', '--events', handle.name], capture_output=True, text=True, check=True)
                            actual = json.loads(result.stdout)['mastery']
                            if actual != int(grade):
                                errors.append(f'{location}: structured evidence derives {actual}, claimed {grade}')
                        except (ValueError, subprocess.CalledProcessError, OSError) as exc:
                            errors.append(f'{location}: invalid structured evidence: {type(exc).__name__}')
    return errors, count, pending


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent / 'personal-learning')
    args = parser.parse_args()
    errors, count, pending = audit(args.source)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'State audit passed: {count} topics; {pending} historical evidence gaps explicitly marked.')
    print('Static descriptions only; teaching behavior and evidence truth require case/log review.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
