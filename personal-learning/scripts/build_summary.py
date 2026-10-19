#!/usr/bin/env python3
"""Personal Learning OS — 知识归纳 HTML 构建器（只读学习状态，不写任何学习数据）。

用法：
  python3 scripts/build_summary.py data/projects/<p>/summaries/<topic>.json \
      --state data/projects/<p>/state.md --map data/projects/<p>/knowledge-map.md
  python3 scripts/build_summary.py <cards.json> --check        # 只校验，不生成

输入是 plos-knowledge-summary/1 JSON（字段见 references/knowledge-summary.md 与
assets/knowledge-summary-cards-template.json）；输出是单文件、零外部依赖的 HTML。
state.md 只用于生成只读的掌握度快照：本脚本从不修改 state、log 或任何项目文件。
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

SCHEMA = 'plos-knowledge-summary/1'
ORIGINS = {'source', 'computed', 'outside'}
REL_TYPES = {'prereq', 'contrast', 'apply', 'derive', 'part', 'related'}
FIGURES = {'flow', 'cycle', 'tree', 'compare', 'curve', 'svg'}
ID_RE = re.compile(r'^[a-z0-9][a-z0-9._-]*$')
PENDING = '待按 v1.2 核验：'
HERE = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = HERE.parent / 'assets' / 'knowledge-summary-template.html'


def norm(text):
    return re.sub(r'\s+', ' ', str(text).replace('**', '')).strip().casefold()


def cells(line):
    return [v.strip() for v in re.split(r'(?<!\\)\|', line.strip())[1:-1]]


def tables(md_text, first_header):
    """Yield (header, row) for Markdown tables whose first header cell equals first_header."""
    header = None
    for line in md_text.splitlines():
        if line.startswith('|'):
            row = cells(line)
            if row and row[0] == first_header:
                header = row
                continue
            if header is None or (row and re.fullmatch(r'[- :]+', row[0] or '-')):
                continue
            if len(row) == len(header):
                yield header, row
        elif line.strip():
            header = None


def col(header, row, prefix):
    for i, name in enumerate(header):
        if name.startswith(prefix):
            return row[i]
    return ''


def date_of(text):
    m = re.search(r'\d{4}-\d{2}-\d{2}', text or '')
    return m.group(0) if m else None


def read_state(path):
    text = path.read_text(encoding='utf-8')
    mastery, memory = {}, {}
    for header, row in tables(text, 'Topic'):
        if not any(h.startswith('Mastery') for h in header):
            continue
        grade = col(header, row, 'Mastery')
        evidence = col(header, row, 'Evidence')
        pending = None
        if PENDING in evidence:
            pending = re.split(r'[；;|]', evidence.split(PENDING, 1)[1])[0].strip() or '见 state'
        mastery[norm(row[0])] = {
            'topic': row[0].replace('**', ''),
            'mastery': int(grade) if re.fullmatch(r'[0-5]', grade) else None,
            'pending': pending,
            'evidence': (evidence[:220] + '…') if len(evidence) > 220 else evidence,
            'lastVerified': date_of(col(header, row, 'Last Verified')),
        }
    for header, row in tables(text, 'Knowledge Item'):
        memory[norm(row[0])] = {
            'lastSuccess': date_of(col(header, row, 'Last Success')),
            'lastFail': date_of(col(header, row, 'Last Fail')),
            'nextReview': date_of(col(header, row, 'Next Review')),
        }
    return mastery, memory


def as_list(value):
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def overlay(data, state_path, as_of):
    mastery, memory = read_state(state_path)
    usage = {}
    for card in data['cards']:
        for topic in as_list(card.get('stateTopic')):
            usage[norm(topic)] = usage.get(norm(topic), 0) + 1
    items, warnings = {}, []
    for card in data['cards']:
        topics = as_list(card.get('stateTopic'))
        rows = []
        for topic in topics:
            row = mastery.get(norm(topic))
            if row is None:
                warnings.append(f"{card['id']}: stateTopic 未在 state.md Mastery 表中找到：{topic}（显示为未记录）")
            else:
                rows.append(row)
        if not rows:
            continue
        grades = [r['mastery'] for r in rows if r['mastery'] is not None]
        item = {
            'topic': '；'.join(r['topic'] for r in rows),
            'mastery': min(grades) if grades else None,
            'pending': '；'.join(r['pending'] for r in rows if r['pending']) or None,
            'evidence': ' / '.join(r['evidence'] for r in rows if r['evidence']),
            'merged': len(rows) > 1 or any(usage.get(norm(t), 0) > 1 for t in topics),
        }
        mem_keys = as_list(card.get('memoryItem')) or topics
        for key in mem_keys:
            mem = memory.get(norm(key))
            if not mem:
                continue
            if mem['nextReview'] and (not item.get('nextReview') or mem['nextReview'] < item['nextReview']):
                item['nextReview'] = mem['nextReview']
            if mem['lastFail'] and (not mem['lastSuccess'] or mem['lastFail'] > mem['lastSuccess']):
                item['weak'] = True
                item['weakReason'] = f"最近一次检索失败（Last Fail {mem['lastFail']}）"
        items[card['id']] = item
    data['status'] = {'source': str(state_path), 'asOf': as_of, 'items': items}
    return warnings


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)


def validate(data, map_text=None):
    errors, warnings = [], []
    if data.get('schema') != SCHEMA:
        errors.append(f'schema 必须为 {SCHEMA}')
    meta = data.get('meta') or {}
    for key in ('project', 'title'):
        if not meta.get(key):
            errors.append(f'meta.{key} 缺失')
    sections = data.get('sections') or []
    cards = data.get('cards') or []
    sec_ids = [s.get('id') for s in sections]
    if len(sec_ids) != len(set(sec_ids)):
        errors.append('sections.id 重复')
    for s in sections:
        if not s.get('id') or not s.get('title') or not s.get('n'):
            errors.append(f'section 需要 id / n / title：{s}')
    ids = [c.get('id') for c in cards]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        errors.append(f'cards.id 重复：{sorted(dup)}')
    idset = set(ids)
    for c in cards:
        cid = c.get('id', '?')
        if not ID_RE.match(str(cid)):
            errors.append(f'{cid}: id 只能用小写字母、数字、点、下划线和连字符')
        for key in ('sec', 'title', 'core', 'explain'):
            if not c.get(key):
                errors.append(f'{cid}: 缺少 {key}')
        if c.get('sec') and c['sec'] not in sec_ids:
            errors.append(f'{cid}: sec {c["sec"]} 不存在')
        for field in ('origin',):
            if c.get(field) and c[field] not in ORIGINS:
                errors.append(f'{cid}: origin 只能是 {sorted(ORIGINS)}')
        for sub in [c.get('example')] + list(c.get('formulas') or []) + [c.get('quiz')] + list(c.get('traps') or []):
            if isinstance(sub, dict) and sub.get('origin') and sub['origin'] not in ORIGINS:
                errors.append(f'{cid}: origin 只能是 {sorted(ORIGINS)}')
        quiz = c.get('quiz')
        if quiz and not (quiz.get('q') and quiz.get('a')):
            errors.append(f'{cid}: quiz 需要 q 与 a')
        for rel in c.get('related') or []:
            if rel.get('type') and rel['type'] not in REL_TYPES:
                errors.append(f'{cid}: related.type 只能是 {sorted(REL_TYPES)}')
            if rel.get('id') not in idset and not rel.get('label'):
                errors.append(f'{cid}: related 指向本页不存在的 {rel.get("id")}（本页外节点请加 label）')
        fig = c.get('figure')
        if fig and fig.get('type') not in FIGURES:
            errors.append(f'{cid}: figure.type 只能是 {sorted(FIGURES)}')
        if map_text is not None:
            node = c.get('node')
            if not node:
                warnings.append(f'{cid}: 缺少 node（knowledge-map 节点路径），关联与地图对齐会变弱')
            else:
                leaf = norm(node.split('>')[-1])
                if leaf and leaf not in norm(map_text):
                    warnings.append(f'{cid}: node「{node}」末级未出现在 knowledge-map.md，确认是否需由维护/教学增量补地图')
    for w in data.get('weakFirst') or []:
        if w.get('card') not in idset:
            errors.append(f'weakFirst 指向不存在的卡片 {w.get("card")}')
    for text in strings(data):
        low = text.lower()
        if '<script' in low or 'javascript:' in low or re.search(r'<[^>]*\son\w+\s*=', low):
            errors.append('内容含脚本或事件属性，已拒绝：' + text[:60])
            break
        if re.search(r'(src|href)\s*=\s*["\']?https?://', low):
            warnings.append('内容引用外部资源，离线时将无法显示：' + text[:60])
    return errors, warnings


def inject(template, data, katex_dir=None):
    payload = json.dumps(data, ensure_ascii=False, indent=1)
    payload = payload.replace('</', '<\\/').replace('<!--', '<\\!--')
    pattern = re.compile(r'(<script type="application/json" id="plos-data">)(.*?)(</script>)', re.S)
    if not pattern.search(template):
        raise SystemExit('模板缺少 <script type="application/json" id="plos-data"> 数据区')
    html = pattern.sub(lambda m: m.group(1) + '\n' + payload + '\n' + m.group(3), template, count=1)
    if katex_dir:
        kdir = Path(katex_dir)
        css = (kdir / 'katex.min.css').read_text(encoding='utf-8')
        js = (kdir / 'katex.min.js').read_text(encoding='utf-8')
        if '</script' in js.lower():
            raise SystemExit('katex.min.js 含 </script，无法安全内联')
        html = html.replace('</head>', f'<style>{css}</style>\n<script>{js}</script>\n</head>', 1)
    title = re.sub(r'[<>&]', '', str(data.get('meta', {}).get('title', '知识归纳')))
    return re.sub(r'<title>.*?</title>', f'<title>{title} · 知识归纳</title>', html, count=1, flags=re.S)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cards', type=Path, help='plos-knowledge-summary/1 JSON')
    ap.add_argument('--state', type=Path, help='项目 state.md；只读，用于掌握度快照')
    ap.add_argument('--map', type=Path, help='项目 knowledge-map.md；只读，用于检查 node 对齐')
    ap.add_argument('--out', type=Path, help='输出 HTML（默认与 JSON 同目录同名）')
    ap.add_argument('--template', type=Path, default=DEFAULT_TEMPLATE)
    ap.add_argument('--as-of', default=dt.date.today().isoformat(), help='快照日期，默认今天')
    ap.add_argument('--katex-dir', help='可选：含 katex.min.js / katex.min.css 的本地目录，内联后公式用 KaTeX 渲染')
    ap.add_argument('--check', action='store_true', help='只校验，不生成 HTML')
    args = ap.parse_args()

    data = json.loads(args.cards.read_text(encoding='utf-8'))
    map_text = args.map.read_text(encoding='utf-8') if args.map else None
    errors, warnings = validate(data, map_text)
    if args.state and not errors:
        warnings += overlay(data, args.state, args.as_of)
    for w in warnings:
        print('提示：' + w, file=sys.stderr)
    if errors:
        print('\n'.join('错误：' + e for e in errors), file=sys.stderr)
        return 1
    if args.check:
        print(f'校验通过：{len(data["cards"])} 张卡片，{len(data["sections"])} 个分类。')
        return 0
    data.setdefault('meta', {}).setdefault('generated', args.as_of)
    data['meta'].setdefault('generator', 'build_summary.py')
    out = args.out or args.cards.with_suffix('.html')
    out.write_text(inject(args.template.read_text(encoding='utf-8'), data, args.katex_dir), encoding='utf-8')
    status = data.get('status', {}).get('items', {})
    print(f'已生成 {out}：{len(data["cards"])} 张卡片，{len(status)} 张叠加了 state 快照（{args.as_of}）。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
