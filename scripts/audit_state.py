#!/usr/bin/env python3
"""Read-only structural, evidence, mode and privacy audit; does not assess teaching effectiveness."""
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


CUMULATIVE = '累积证据：'
REQUIRED = {
    2: ['无提示'],
    3: ['解释', '应用', '无提示', '复测'],
    4: ['解释', '应用', '无提示', '复测', '变式'],
    5: ['解释', '应用', '无提示', '复测', '变式', '迁移'],
}


def markdown_evidence_ok(evidence, grade):
    """Markdown path for file-based tutors: an explicit cumulative-evidence segment naming every required ability."""
    if CUMULATIVE not in evidence:
        return False
    segment = evidence.split(CUMULATIVE, 1)[1]
    return all(word in segment for word in REQUIRED[grade])


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
                    documented = markdown_evidence_ok(evidence, int(grade))
                    if not structured and not documented:
                        errors.append(f'{location}: new or changed Level {grade} needs `累积证据：` ({"/".join(REQUIRED[int(grade)])}) or structured evidence; otherwise keep a `待按 v1.2 核验：` gap')
                    elif structured:
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


OBSOLETE = ['每轮必做', '每次答题后追问', '每次作答后询问 Confidence', '含提示后答对', '不跳级', 'Confidence 必填',
            'Confidence ≥ 7 且 Mastery ≤ 2', 'Confidence ≤ 4 且 Mastery ≥ 4', '这是识别"熟悉感幻觉"的唯一手段',
            'Mastery: 2 → 2.5', '读取 `references/mind-map.md`', 'CodeBuddy', '~/.codebuddy']
MODE_FILES = ['references/knowledge-summary.md', 'assets/knowledge-summary-template.html',
              'assets/knowledge-summary-cards-template.json', 'scripts/build_summary.py']
EXTERNAL = re.compile(r'(?:src|href)\s*=\s*["\']?(?:https?:)?//|@import|url\(\s*["\']?https?:', re.I)
COURSE_ID = re.compile(r'^([a-z]{2,5})(\d{3,5}[a-z]?)$')
PUBLIC_PATHS = ['README.md', 'SYSTEM-MAINTENANCE.md', 'docs', 'scripts', 'personal-learning']
PRIVATE_PREFIXES = ['personal-learning/data/projects/', 'personal-learning/data/learner-profile.md',
                    'personal-learning/data/handoff-status.md', 'personal-learning/data/legacy-audit-baseline.json']


def public_files(root):
    """Files that git would publish under the protocol paths (falls back to a plain walk without git)."""
    try:
        out = subprocess.run(['git', '-C', str(root), 'ls-files', '--cached', '--others', '--exclude-standard', '--', *PUBLIC_PATHS],
                             capture_output=True, text=True, check=True).stdout.splitlines()
        return [root / f for f in out if (root / f).is_file()]
    except (OSError, subprocess.CalledProcessError):
        files = []
        for base in PUBLIC_PATHS:
            path = root / base
            files += [path] if path.is_file() else [p for p in path.rglob('*') if p.is_file()]
        return [p for p in files if not any(str(p.relative_to(root)).startswith(x) for x in PRIVATE_PREFIXES)
                and '__pycache__' not in p.parts and p.suffix not in {'.zip', '.pyc'}]


def audit_protocol(source):
    errors = []
    root = source.parent
    for rel in MODE_FILES:
        if not (source / rel).is_file():
            errors.append(f'missing knowledge-summary file: {rel}')
    for rel in ['SKILL.md', 'TEACHING-HANDOFF.md', 'references/modes.md']:
        if 'knowledge-summary' not in (source / rel).read_text() and '知识归纳' not in (source / rel).read_text():
            errors.append(f'{rel}: does not route to the knowledge-summary mode')
    active = [source / 'SKILL.md', source / 'TEACHING-HANDOFF.md']
    active += [p for p in (source / 'references').glob('*.md') if p.name != 'mind-map.md']
    active += list((source / 'assets').glob('*.md')) + list((source / 'data/projects').glob('*/state.md'))
    for path in active:
        if path.name.startswith('._'):
            continue
        content = path.read_text(encoding='utf-8')
        for old in OBSOLETE:
            if old in content:
                errors.append(f'{path.relative_to(source)}: obsolete active rule {old}')
    template = source / 'assets/knowledge-summary-template.html'
    if template.is_file():
        html = template.read_text()
        if EXTERNAL.search(html):
            errors.append('assets/knowledge-summary-template.html: external resource reference (template must work offline)')
        if 'id="plos-data"' not in html:
            errors.append('assets/knowledge-summary-template.html: missing plos-data block')
    builder = source / 'scripts/build_summary.py'
    if builder.is_file():
        summaries = sorted(source.glob('examples/*/cards.json')) + sorted(source.glob('data/projects/*/summaries/*.json'))
        for path in summaries:
            result = subprocess.run([sys.executable, str(builder), str(path), '--check'], capture_output=True, text=True)
            if result.returncode:
                errors.append(f'{path.relative_to(source)}: knowledge summary invalid: {result.stderr.strip()[:300]}')
    codes = []
    for project in (source / 'data/projects').iterdir() if (source / 'data/projects').is_dir() else []:
        m = COURSE_ID.match(project.name)
        if m:
            codes.append(re.compile(rf'(?<![A-Za-z]){m.group(1)}[ _-]?{m.group(2)}(?!\d)', re.I))
    if codes:
        for path in public_files(root):
            rel = str(path.relative_to(root))
            if any(rel.startswith(x) for x in PRIVATE_PREFIXES):
                errors.append(f'{rel}: private learner data would be published')
                continue
            try:
                text = path.read_text()
            except (UnicodeDecodeError, OSError):
                continue
            for pattern in codes:
                hit = pattern.search(text)
                if hit:
                    errors.append(f'{rel}: public file mentions private course id "{hit.group(0)}"')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent.parent / 'personal-learning')
    args = parser.parse_args()
    errors, count, pending = audit(args.source)
    errors += audit_protocol(args.source)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'State audit passed: {count} topics; {pending} historical evidence gaps explicitly marked.')
    print('Static descriptions only; teaching behavior and evidence truth require case/log review.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
