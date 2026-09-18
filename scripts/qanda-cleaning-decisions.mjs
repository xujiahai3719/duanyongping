const INVESTMENT_UNDERSTANDING = 'duanyongping-touziluoji-di2jie-touzilijie'
const INVESTMENT_PRINCIPLES = 'duanyongping-touziluoji-di1zhang-touzilinian'
const LIFE_LESSONS = 'dadaotouziwendalu-disizhangrenshengzhenyan'
const READER_UPDATES = 'dadaotouziwendalu-diliuzhangduzhegengxin'

export const MANUAL_DECISIONS = [
  {
    id: 'f45-remove-loyal-follower-reaction',
    sourceSlug: INVESTMENT_UNDERSTANDING,
    contains: '这个忠实信徒很有趣哈',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'f45-remove-charlie-almanack-reaction',
    sourceSlug: INVESTMENT_UNDERSTANDING,
    contains: '网友Y：《穷查理宝典》',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'f45-remove-translator-editorial-note',
    sourceSlug: INVESTMENT_UNDERSTANDING,
    contains: '网友黑色伤：我用了两天',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'f45-remove-third-party-profile-x',
    sourceSlug: INVESTMENT_UNDERSTANDING,
    contains: '网友X：他的网站整理了好多Buffett',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'f45-remove-standalone-put-update',
    sourceSlug: READER_UPDATES,
    contains: '开始卖点put了。投入资金',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'f45-remove-insurance-ai-non-answer',
    sourceSlug: READER_UPDATES,
    contains: '家庭保险配置问题',
    action: 'discard',
    reason: 'manual-cleanup-f45ab92',
  },
  {
    id: 'life01-remove-duplicate-talent-qanda',
    sourceSlug: INVESTMENT_PRINCIPLES,
    contains: '网友：不太明白啊，如果勤奋和天赋都不够',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-remove-duplicate-driving-example',
    sourceSlug: INVESTMENT_PRINCIPLES,
    contains: '最简单的例子就是一个很会开车的人开了一辆很好的车但上高速时上反了入口哈',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-smart-wisdom-line',
    sourceSlug: LIFE_LESSONS,
    contains: '小聪明和大智慧的差别，也是坚持不做不对的事情的意思。',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-long-view-line',
    sourceSlug: LIFE_LESSONS,
    contains: '往回看个几十年，你会看到很多很“聪明”的“聪明人”成就很小，原因可能在他们没把聪明放在[做对的事情](/zuoduideshiqing)上。(2015-04-06)',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-north-star-context',
    sourceSlug: LIFE_LESSONS,
    contains: '也许应该再看看蒂姆·库克2015年给华盛顿大学毕业生的讲话，努力去找到你自己的北斗星。我还想起**巴菲特**说过的，**明知是坑就别再往下挖了，千万别拿时间不当成本**。我见过太多聪明人忙碌一辈子也忙不明白的，原因大概就是没有自己的北斗星，凡事决策时都是从眼前利益着想，30年后的差异是巨大的。(2016-05-31)',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-north-star-definition',
    sourceSlug: LIFE_LESSONS,
    contains: '**北斗星指的是价值观，就是要有不为清单。30年后可以看到巨大的差异。(2016-06-01)**',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-talent-summary',
    sourceSlug: LIFE_LESSONS,
    contains: '**勤奋和天赋其实都没那么重要，[做对的事情](/zuoduideshiqing)最重要。(2019-09-09)**',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-repeated-section-label',
    sourceSlug: INVESTMENT_PRINCIPLES,
    contains: '06．**做对的事情和把事情做对**',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-munger-not-doing-quote',
    sourceSlug: INVESTMENT_PRINCIPLES,
    contains: '13．引用：点评芒格主义\n\n36，我们长期努力保持不做傻事，所以我们的收获比那些努力做聪明事的人要多得多。',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-trim-duplicate-munger-overconfidence-quote',
    sourceSlug: INVESTMENT_PRINCIPLES,
    contains: '引用：点评芒格主义（2012-06-26）\n\n22，聪明人也不免遭受过度自信带来的灾难。他们认为自己有更强的能力和更好的方法，所以往往他们就在更艰难的道路上疲于奔命。',
    action: 'remove-fragment',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-remove-duplicate-first-million-qanda',
    sourceSlug: LIFE_LESSONS,
    contains: '我是1994年生人，现在还没有攒到人生的第一桶金（100万）',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-remove-duplicate-idleness-qanda',
    sourceSlug: LIFE_LESSONS,
    contains: '段总，如何缓解无所事事的痛苦',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-remove-duplicate-luck-qanda',
    sourceSlug: LIFE_LESSONS,
    contains: '大道，你信命吗，你觉得你现在所有的是靠自己努力得来的',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
  {
    id: 'life01-remove-duplicate-humility-followup',
    sourceSlug: LIFE_LESSONS,
    contains: '大道谦虚了，他只是把自己的能力 +努力，总结为运气',
    action: 'discard',
    reason: 'manual-dedup-wenda-life-01',
  },
]

export function applyManualDecisions(blocks, decisions = MANUAL_DECISIONS) {
  const kept = blocks.map((block) => ({ ...block }))
  const discarded = []
  const fragmentChanges = []

  for (const decision of decisions) {
    const matches = kept.filter((block) => (
      block.sourceSlug === decision.sourceSlug
      && block.markdown.includes(decision.contains)
    ))
    if (matches.length !== 1) {
      throw new Error(`Manual decision ${decision.id} must match exactly one source block; found ${matches.length}`)
    }

    const block = matches[0]
    if (decision.action === 'discard') {
      discarded.push({ block, decision })
      kept.splice(kept.findIndex((item) => item.id === block.id), 1)
      continue
    }
    if (decision.action !== 'remove-fragment') {
      throw new Error(`Manual decision ${decision.id} has invalid action: ${decision.action}`)
    }

    const before = block.markdown
    block.markdown = block.markdown
      .replace(decision.contains, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    fragmentChanges.push({
      blockId: block.id,
      decisionId: decision.id,
      before,
      after: block.markdown,
      reason: decision.reason,
    })
  }

  return { kept, discarded, fragmentChanges }
}
