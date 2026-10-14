#!/usr/bin/env python3
"""Read-only structural/evidence audit; does not assess teaching effectiveness."""
import argparse
from pathlib import Path
import re
import sys


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
            if int(grade) >= 3 and not waiting:
                linked_history = int(grade) == 3 and 'v1.2 累积证据来源：' in evidence
                # Future entries must explicitly describe covered capabilities and interval.
                documented = all(word in evidence for word in ['解释', '应用', '无提示', '间隔'])
                if int(grade) >= 4:
                    documented = documented and '变式' in evidence
                if int(grade) >= 5:
                    documented = documented and '迁移' in evidence
                if not (linked_history or documented):
                    errors.append(f'{location}: high grade lacks cumulative evidence description or historical pending marker')
            if int(grade) >= 2 and '经提示后' in evidence and not waiting:
                errors.append(f'{location}: assisted historical success needs independent-evidence verification')
    active = [source / 'SKILL.md', source / 'TEACHING-HANDOFF.md']
    active += list((source / 'references').glob('*.md'))
    active += list((source / 'assets').glob('*.md'))
    active += list((source / 'data/projects').glob('*/state.md'))
    obsolete = ['每轮必做', '每次答题后追问', '每次作答后询问 Confidence',
                '含提示后答对', '不跳级', 'Confidence 必填',
                'Confidence ≥ 7 且 Mastery ≤ 2', 'Confidence ≤ 4 且 Mastery ≥ 4',
                '这是识别"熟悉感幻觉"的唯一手段', 'Mastery: 2 → 2.5']
    for path in active:
        content = path.read_text()
        for old in obsolete:
            if old in content:
                errors.append(f'{path.relative_to(source)}: obsolete active rule {old}')
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
