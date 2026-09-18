export const TYPO_RULES = new Map([
  ['博有', '博友'],
  ['湖涂', '糊涂'],
  ['Andriod', 'Android'],
  ['巴非特', '巴菲特'],
  ['aeed have', 'need have'],
  ['necd have', 'need have'],
])

const NUMBER_TOKEN = /[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:%|％|美元|美金|亿元|万元|元|亿|万|倍|股|年|月|日)?/g

function numericSignature(markdown) {
  return (markdown.normalize('NFKC').match(NUMBER_TOKEN) || []).sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
}

export function hasDangerousNumericChange(before, after) {
  return numericSignature(before).join('\n') !== numericSignature(after).join('\n')
}

function recordReplace(markdown, pattern, replacement, type, rule, changes) {
  return markdown.replace(pattern, (...args) => {
    const match = args[0]
    const groups = args.slice(1, -2)
    const after = typeof replacement === 'function'
      ? replacement(match, ...groups)
      : replacement.replace(/\$(\d+)/g, (_, index) => groups[Number(index) - 1] ?? '')
    if (after !== match) changes.push({ type, rule, before: match, after })
    return after
  })
}

function applyKnownTypos(markdown, changes) {
  let output = markdown
  for (const [before, after] of TYPO_RULES) {
    if (!output.includes(before)) continue
    output = recordReplace(
      output,
      new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      after,
      'typo-corrected',
      `${before}->${after}`,
      changes,
    )
  }
  return output
}

export function cleanEditorialMarkdown(markdown, context = {}) {
  const changes = []
  let output = markdown

  output = recordReplace(
    output,
    /^\*\*感谢网友提问，排名不分先后：\*\*[\s\S]*?(?=\n\s*\n(?:\* \* \*|\*\*(?:段永平|大道)[：:]))/mu,
    '',
    'discarded-no-information',
    'editorial-contributor-list',
    changes,
  )
  if (changes.some((change) => change.rule === 'editorial-contributor-list')) {
    output = recordReplace(
      output,
      /^\s*\* \* \*\s*(?=\*\*(?:段永平|大道)[：:])/u,
      '',
      'format-normalized',
      'orphan-horizontal-rule',
      changes,
    )
  }
  output = recordReplace(
    output,
    /d\[0we8qfy-97p yvbcn\] w\[-q0cu= -2uirft0 7yr\]-02 fnbv;i LYUOC BG-na=ekgtrld\\+-exjh- wqcgtvhy=4y,t[?？]*/g,
    '',
    'discarded-garbled',
    'keyboard-garble',
    changes,
  )
  const numericBaseline = output

  output = recordReplace(output, /\*\(\)\*/g, '', 'format-normalized', 'empty-markdown-link', changes)
  output = recordReplace(output, /(?:\(\)|（）)/g, '', 'format-normalized', 'empty-parentheses', changes)
  output = recordReplace(output, /\?{2,}|？{2,}|[?？]{2,}/g, '？', 'format-normalized', 'repeated-question-mark', changes)
  output = recordReplace(output, /!{2,}|！{2,}|[!！]{2,}/g, '！', 'format-normalized', 'repeated-exclamation-mark', changes)
  output = recordReplace(output, /。{2,}/g, '。', 'format-normalized', 'repeated-full-stop', changes)
  output = recordReplace(output, /，{2,}/g, '，', 'format-normalized', 'repeated-comma', changes)
  output = recordReplace(output, /；{2,}/g, '；', 'format-normalized', 'repeated-semicolon', changes)
  output = recordReplace(output, /：{2,}/g, '：', 'format-normalized', 'repeated-colon', changes)
  output = recordReplace(output, /，\s*[。；]/g, (match) => match.trim().at(-1), 'format-normalized', 'comma-before-terminal-punctuation', changes)
  output = recordReplace(output, /（([^（）()\n]{0,200})\)/g, '（$1）', 'format-normalized', 'mixed-parenthesis', changes)
  output = recordReplace(output, /^(_[０-９0-9]{1,3}[.．、])__\s*/gmu, '$1 ', 'format-normalized', 'malformed-italic-number-label', changes)
  output = recordReplace(output, /[ \t]+__\s*$/gmu, '', 'format-normalized', 'trailing-underscore-debris', changes)
  output = applyKnownTypos(output, changes)

  return {
    markdown: output,
    numericBaseline,
    changes: changes.map((change) => ({ ...change, blockId: context.blockId })),
  }
}
