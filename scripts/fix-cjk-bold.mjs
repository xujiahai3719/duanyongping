#!/usr/bin/env node
/**
 * 修复中文标点导致的 ** 加粗失效。
 *
 * CommonMark 把中文标点算作 punctuation，`…很多。**所以` 这样的闭合标记
 * 不满足 right-flanking，会原样输出字面的 **。修法是只挪动标记位置、
 * 不改动任何可见文字，并用 markdown-it 实际渲染来判定是否修好。
 *
 * 用法：
 *   node scripts/fix-cjk-bold.mjs --dry-run
 *   node scripts/fix-cjk-bold.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const dryRun = process.argv.includes('--dry-run');

// 闭合标记挪到它前面的中文标点之前：`很多。**` -> `很多**。`
const MOVE_CLOSE = /([。，、！？：；）》」』…·])\*\*/g;
// 起始标记挪到它后面的中文标点之后：`**《书名》` -> `《**书名》`
const MOVE_OPEN = /\*\*([《“「『（【。，、！？：；])/g;
// 说话人标签，规则三要先把它摘出来
const LABEL = /^(\*\*(?:段永平|网友|大道)[^*]*\*\*\s*)/;

const visible = (s) => s.replace(/\*\*/g, '');
const literal = (s) => (md.renderInline(s).match(/\*\*/g) || []).length;

/** 规则三：整段加粗里内嵌的 **术语** 是冗余的，删掉只保留最外层一对 */
function dropInner(para) {
  const m = para.match(LABEL);
  const head = m ? m[1] : '';
  const rest = head ? para.slice(head.length) : para;
  const marks = [...rest.matchAll(/\*\*/g)].map((x) => x.index);
  if (marks.length < 4 || marks[0] !== 0) return para;
  const last = marks[marks.length - 1];
  const inner = marks.slice(1, -1);
  let body = rest;
  for (const i of inner.reverse()) body = body.slice(0, i) + body.slice(i + 2);
  return head + body;
}

/**
 * 只做整段级别的安全改写：挪动闭合/起始标记、去掉整段加粗内的冗余内层标记。
 * 不做「删掉落单标记」这类猜测——那会改变作者想强调的范围，交给人工判断。
 */
function repair(para) {
  let best = para;
  let bestScore = literal(para);
  if (bestScore === 0) return null;

  const moves = [[MOVE_CLOSE], [MOVE_OPEN], [MOVE_CLOSE, MOVE_OPEN],
                 [MOVE_OPEN, MOVE_CLOSE]];
  for (const base of [para, dropInner(para)]) {
    for (const rules of [[], ...moves]) {
      let cand = base;
      for (const re of rules) {
        cand = cand.replace(re, (m, p) => (re === MOVE_CLOSE ? `**${p}` : `${p}**`));
      }
      if (visible(cand) !== visible(para)) continue;  // 可见文字必须完全不变
      const score = literal(cand);
      if (score < bestScore) {
        best = cand;
        bestScore = score;
      }
    }
  }
  return bestScore === 0 ? best : (best !== para ? best : null);
}

const files = globSync('content/dao/**/wenda-*.md');
let fixed = 0, left = 0, touched = 0;
const unresolved = [];

for (const f of files.sort()) {
  const src = readFileSync(f, 'utf8');
  const cut = src.indexOf('\n---\n') + 5;
  const fm = src.slice(0, cut);
  const paras = src.slice(cut).split('\n\n').map((p) => p.trim()).filter(Boolean);

  let n = 0;
  const out = paras.map((p) => {
    if (p.startsWith('#')) return p;
    const before = literal(p);
    if (!before) return p;
    const r = repair(p);
    if (r === null) {
      left += before;
      unresolved.push([f.split('/').pop(), p.slice(0, 110)]);
      return p;
    }
    const after = literal(r);
    fixed += before - after;
    left += after;
    if (after) unresolved.push([f.split('/').pop(), r.slice(0, 110)]);
    n += 1;
    return r;
  });

  if (n) {
    touched += 1;
    console.log(`${f.split('/').pop().padEnd(38)} 修复 ${n} 段`);
    if (!dryRun) writeFileSync(f, fm + '\n' + out.join('\n\n') + '\n');
  }
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}改动章节 ${touched}，修复字面 ** ${fixed} 处，剩余 ${left} 处`);
if (unresolved.length) {
  console.log(`\n无法自动修复 ${unresolved.length} 处：`);
  for (const [n, s] of unresolved) console.log(`  ${n} | ${s}`);
}
