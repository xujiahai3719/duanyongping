#!/usr/bin/env python3
"""清洗投资问答录章节：章内去重 + 格式规范化。

按 content/dao 下 wenda-*.md 逐章处理，规则：

R1 中文后的半角标点 : ; ? ! , 转全角
R2 `**网友:...**` 整行加粗改为 `网友：...`（保留内嵌的 **术语** 加粗）
R3 加粗修复：真跨段的加粗（相邻 1-2 段内闭合）补齐配对；孤立的 `**` 残标记删除
R4 正文直引号 " 按段落成对转为 “ ”（奇数个则跳过并报告）
R5 章内完全重复的问答块（问 + 答 + 日期全同）只保留首次出现

用法：
    python3 scripts/clean-qanda.py --dry-run          # 只报告，不写文件
    python3 scripts/clean-qanda.py --file <path>      # 处理单章
    python3 scripts/clean-qanda.py                    # 处理全部章节
"""

import argparse
import glob
import re
import sys
from collections import Counter

CJK = r'一-鿿'
# 半角 -> 全角，仅当紧跟在中文字符或中文引号/括号之后
PUNCT = {':': '：', ';': '；', '?': '？', '!': '！', ',': '，'}
PUNCT_RE = re.compile(rf'(?<=[{CJK}”）】》」])([:;?!,])')

QUESTION_RE = re.compile(r'^\*{0,2}网友')
LINK_RE = re.compile(r'\[([^\]]*)\]\([^)]*\)')


def split_frontmatter(text):
    if not text.startswith('---'):
        return '', text
    end = text.index('\n---\n', 3) + len('\n---\n')
    return text[:end], text[end:]


def normalize(text):
    """用于比对重复：去掉链接、加粗标记和所有空白。"""
    return re.sub(r'\s+', '', LINK_RE.sub(r'\1', text)).replace('*', '')


def fix_punct(para, stats):
    def sub(m):
        stats['R1 半角标点转全角'] += 1
        return PUNCT[m.group(1)]
    return PUNCT_RE.sub(sub, para)


STRAIGHT = '"＂'


def fix_quotes(para, stats, warnings, where):
    n = sum(para.count(c) for c in STRAIGHT)
    if n == 0:
        return para
    if n % 2:
        warnings.append(f'{where}: 直引号数量为奇数({n})，跳过 -> {para[:60]}')
        return para
    out = []
    open_q = True
    for ch in para:
        if ch in STRAIGHT:
            out.append('“' if open_q else '”')
            open_q = not open_q
            stats['R4 直引号转弯引号'] += 1
        else:
            out.append(ch)
    return ''.join(out)


def scan_bold(para):
    """配对段内的 ** 标记，返回未配对标记的 [(下标, 角色)]，角色为 open / close。

    按 Markdown 规则：作为起始标记时后面不能是空白，作为结束标记时前面不能是空白。
    两边都不成立的退化标记（如段首的 `** 正文`）按结束标记处理。
    """
    tokens = []
    for m in re.finditer(r'\*\*', para):
        t = m.start()
        after = para[t + 2:t + 3]
        before = para[t - 1:t] if t else ''
        can_open = bool(after) and not after.isspace()
        can_close = bool(before) and not before.isspace()
        role = 'open' if can_open else 'close'
        tokens.append((t, role, can_close))

    pending = None
    unmatched = []
    for t, role, can_close in tokens:
        if pending is None:
            if role == 'open':
                pending = t
            else:
                unmatched.append((t, 'close'))
        elif can_close:
            pending = None                       # 配对成功
        else:
            unmatched.append((pending, 'open'))  # 前一个起始标记落空
            pending = t
    if pending is not None:
        unmatched.append((pending, 'open'))
    return sorted(unmatched)


def drop_marks(para, marks):
    for t, _ in sorted(marks, reverse=True):
        para = para[:t] + para[t + 2:]
    return re.sub(r' +([。，、！？：；）」》])', r'\1', para).strip()


def strip_question_bold(paras, stats):
    """`**网友:...**` 去掉最外层加粗，保留内嵌的 **术语** 加粗。"""
    out = list(paras)
    for i, p in enumerate(out):
        if not p.startswith('**网友'):
            continue
        stripped = p[2:]
        unmatched = scan_bold(stripped)
        if unmatched:
            # 收尾的 ** 就在本段内
            out[i] = drop_marks(stripped, unmatched[-1:])
        else:
            # 本段已配平，说明收尾的 ** 在后面的段落里
            out[i] = stripped
            for j in range(i + 1, min(i + 4, len(out))):
                if out[j].startswith('#'):
                    break
                tail = scan_bold(out[j])
                if tail:
                    out[j] = drop_marks(out[j], tail[:1])
                    break
        stats['R2 网友整行加粗改为纯文本'] += 1
    return out


def fix_bold(paras, stats):
    """真跨段加粗补齐配对；孤立的 ** 残标记删除。"""
    out = list(paras)
    pend = {i: scan_bold(p) for i, p in enumerate(out) if not p.startswith('#')}
    odd = [i for i, u in pend.items() if len(u) == 1]

    paired = set()
    for a in odd:
        if a in paired or pend[a][0][1] != 'open':
            continue
        for b in (x for x in odd if a < x <= a + 2 and x not in paired):
            pos, role = pend[b][0]
            if role != 'close' or any(out[k].startswith('#') for k in range(a + 1, b)):
                break
            # a 段留了个起始标记，b 段留了个结束标记 -> 真跨段加粗
            out[a] += '**'
            for k in range(a + 1, b):
                out[k] = '**' + out[k] + '**'
            # 收尾标记在 b 段开头时，b 段正文在加粗范围之外
            out[b] = drop_marks(out[b], pend[b]) if pos == 0 else '**' + out[b]
            paired.update({a, b})
            stats['R3 跨段加粗补齐配对'] += 1
            break

    for i, u in pend.items():
        if i in paired or not u:
            continue
        out[i] = drop_marks(out[i], u)
        stats['R3 删除孤立加粗标记'] += len(u)
    return out


def dedupe(paras, stats, removed, where):
    """按问答块去重：网友段 + 其后直到下一个网友段/标题的所有段落。"""
    blocks = []
    cur = None
    for p in paras:
        if p.startswith('#'):
            blocks.append(['H', [p]])
            cur = None
        elif QUESTION_RE.match(p):
            cur = [p]
            blocks.append(['Q', cur])
        elif cur is not None:
            cur.append(p)
        else:
            blocks.append(['S', [p]])

    seen = set()
    out = []
    for kind, ps in blocks:
        if kind == 'Q':
            key = normalize('\n'.join(ps))
            if key in seen:
                stats['R5 删除重复问答块'] += 1
                removed.append(f'{where}: {ps[0][:70]}')
                continue
            seen.add(key)
        out.extend(ps)
    return out


def clean(text, where, stats, warnings, removed):
    fm, body = split_frontmatter(text)
    paras = [p.strip() for p in body.split('\n\n') if p.strip()]

    paras = [fix_punct(p, stats) for p in paras]
    paras = strip_question_bold(paras, stats)
    paras = fix_bold(paras, stats)
    paras = [fix_quotes(p, stats, warnings, where) for p in paras]
    paras = dedupe(paras, stats, removed, where)

    return fm + '\n' + '\n\n'.join(paras) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--file')
    args = ap.parse_args()

    files = [args.file] if args.file else sorted(
        glob.glob('content/dao/**/wenda-*.md', recursive=True))
    if not files:
        sys.exit('没有找到章节文件，请在仓库根目录运行')

    total = Counter()
    warnings, removed = [], []
    changed = 0

    for f in files:
        src = open(f, encoding='utf-8').read()
        stats = Counter()
        out = clean(src, f.rsplit('/', 1)[-1], stats, warnings, removed)
        total.update(stats)
        if out != src:
            changed += 1
            detail = '  '.join(f'{k}={v}' for k, v in sorted(stats.items()))
            print(f'{f.rsplit("/", 1)[-1]:38s} {detail}')
            if not args.dry_run:
                open(f, 'w', encoding='utf-8').write(out)

    print(f'\n{"[dry-run] " if args.dry_run else ""}改动章节 {changed}/{len(files)}')
    for k, v in sorted(total.items()):
        print(f'  {k}: {v}')
    if removed:
        print(f'\n删除的重复问答块 {len(removed)} 个:')
        for r in removed:
            print(f'  {r}')
    if warnings:
        print(f'\n需人工确认 {len(warnings)} 处:')
        for w in warnings:
            print(f'  {w}')


if __name__ == '__main__':
    main()
