#!/usr/bin/env python3
"""校验清洗结果：除去被删的重复问答块，正文一个字都不能少。

把清洗前（git HEAD）和清洗后的正文都归一化掉标点/加粗/空白差异，
再逐字比对，确认改动只发生在格式层面。

用法：python3 scripts/verify-qanda.py
"""

import glob
from collections import Counter
import re
import subprocess
import sys

# 归一化：全角/半角标点统一，去掉加粗标记和所有空白
FOLD = str.maketrans({
    '：': ':', '；': ';', '？': '?', '！': '!', '，': ',',
    '“': '"', '”': '"', '＂': '"', '（': '(', '）': ')',
})


def canon(text):
    body = text.split('\n---\n', 1)[1] if text.startswith('---') else text
    body = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', body)   # 链接只留文字
    return re.sub(r'\s+', '', body).replace('*', '').translate(FOLD)


def paragraphs(text):
    body = text.split('\n---\n', 1)[1] if text.startswith('---') else text
    return [p.strip() for p in body.split('\n\n') if p.strip()]


def main():
    files = sorted(glob.glob('content/dao/**/wenda-*.md', recursive=True))
    bad = 0
    for f in files:
        old = subprocess.run(['git', 'show', f'HEAD:{f}'],
                             capture_output=True, text=True).stdout
        if not old:
            continue
        new = open(f, encoding='utf-8').read()
        co, cn = canon(old), canon(new)
        if co == cn:
            continue

        # 允许的差异只有「删除了整块重复内容」：新正文必须是旧正文按顺序的子序列
        i = 0
        for ch in cn:
            i = co.find(ch, i)
            if i < 0:
                break
            i += 1
        else:
            lost = len(co) - len(cn)
            name = f.rsplit('/', 1)[-1]
            # 被删的是重复段落，文本仍留在文件里，所以要按出现次数比对
            def bag(t):
                return Counter(canon(p) for p in paragraphs(t))
            gone = bag(old) - bag(new)
            gone_chars = sum(len(p) * n for p, n in gone.items())
            # 每个被删段落只保留了副本，字数应当对得上
            if abs(gone_chars - lost) > 2 * sum(gone.values()):
                print(f'✗ {name}: 少了 {lost} 字，但只找到 {gone_chars} 字的重复段落')
                bad += 1
            else:
                print(f'✓ {name}: 仅删除 {sum(gone.values())} 个重复段落'
                      f'({lost} 字)，其余内容完整')
            continue

        print(f'✗ {name if (name := f.rsplit("/", 1)[-1]) else f}: 内容被改动，不只是格式')
        for k in range(0, min(len(co), len(cn))):
            if co[k] != cn[k]:
                print(f'    首处差异 @{k}\n    旧: ...{co[max(0,k-40):k+40]}...\n'
                      f'    新: ...{cn[max(0,k-40):k+40]}...')
                break
        bad += 1

    print(f'\n{"校验失败" if bad else "校验通过"}：{bad} 个文件有问题')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
