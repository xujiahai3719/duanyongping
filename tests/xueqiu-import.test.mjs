import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractBlock,
  formatDate,
  isAiRepost,
  isAlreadyPublished,
  isSubstantive,
  normalizeCashtags,
  normalizeForMatch,
  renderBlock,
  splitReplyChain,
  stripHtml,
  visibleLength,
} from '../scripts/xueqiu-import-lib.mjs'

test('stripHtml turns xueqiu markup into plain text', () => {
  const html = '回复<a href="https://xueqiu.com/n/A" target="_blank">@A</a>: 好的<br/>换行'
    + '<img src="//assets.imedao.com/x.png" title="[抱拳]" alt="[抱拳]" height="24" />'
  assert.equal(stripHtml(html), '回复@A: 好的\n换行')
  assert.equal(stripHtml('a&amp;b &gt; c &quot;d&quot;'), 'a&b > c "d"')
  assert.equal(stripHtml(''), '')
  assert.equal(stripHtml(null), '')
})

test('stripHtml decodes numeric character references', () => {
  // 雪球接口实际吐的是数字实体（抓取数据里 &#34; 出现 221 次，&quot; 出现 0 次）
  assert.equal(stripHtml('他说&#34;不要浪费时间&#34;'), '他说"不要浪费时间"')
  assert.equal(stripHtml('it&#x27;s fine'), "it's fine")
  assert.equal(stripHtml('&#39;a&#39; &#38; &#x3c;b&#x3E;'), "'a' & <b>")
  // 已转义的实体不应被二次解码
  assert.equal(stripHtml('&amp;#34;'), '&#34;')
  // 无法识别的实体原样保留，不吞字符
  assert.equal(stripHtml('a &unknown; b'), 'a &unknown; b')
})

test('normalizeCashtags keeps the company name and leaves prices alone', () => {
  assert.equal(normalizeCashtags('我把神华换了$泡泡玛特(09992)$了'), '我把神华换了泡泡玛特了')
  assert.equal(normalizeCashtags('$SpaceX(SPCX)$ 很有意思'), 'SpaceX 很有意思')
  assert.equal(normalizeCashtags('从$89.70 至 $107 之间'), '从$89.70 至 $107 之间')
})

test('normalizeCashtags leaves dollar amounts alone even without spaces', () => {
  // cashtag 一定以字母或中文开头；两个 $ 之间是数字/符号的，是金额不是股票代码
  assert.equal(normalizeCashtags('从$89.70至$107之间'), '从$89.70至$107之间')
  assert.equal(normalizeCashtags('股价=（$30/11）*20=$55。'), '股价=（$30/11）*20=$55。')
  assert.equal(normalizeCashtags('$泡泡玛特(09992)$涨到$300了'), '泡泡玛特涨到$300了')
  assert.equal(normalizeCashtags('$BRK.B$ 现在 $118.56'), 'BRK.B 现在 $118.56')
})

test('splitReplyChain separates duan answer from the quoted question', () => {
  const twoLevel = '回复@寻忆Susanna: 乐园不太可能开太多的。//@寻忆Susanna:回复@xlli-777:乐园什么时候开到更多城市？'
  assert.deepEqual(splitReplyChain(twoLevel), {
    answer: '乐园不太可能开太多的。',
    question: '乐园什么时候开到更多城市？',
  })

  const oneLevel = '回复@A: 我的看法是这样。//@A:请问您怎么看？'
  assert.deepEqual(splitReplyChain(oneLevel), {
    answer: '我的看法是这样。',
    question: '请问您怎么看？',
  })

  assert.deepEqual(splitReplyChain('财报早晚会好的。'), {
    answer: '财报早晚会好的。',
    question: '',
  })
})

test('splitReplyChain drops the @大道无形我有型 mention from questions', () => {
  const text = '回复@B: 是的。//@B:@大道无形我有型 大道您好，请教一个问题。'
  assert.equal(splitReplyChain(text).question, '大道您好，请教一个问题。')
})

test('splitReplyChain does not swallow body text when the //@ segment has no nickname colon', () => {
  // 冒号只在「昵称 + 冒号」的位置上找；找不到就整段当问题，绝不吃到正文里的 https:
  const text = '回复@A: 答。//@B 说得好，我觉得 https://x.com/y 有道理'
  assert.deepEqual(splitReplyChain(text), {
    answer: '答。',
    question: 'B 说得好，我觉得 https://x.com/y 有道理',
  })
  // 昵称超长（>40 字符）时同样不越界去截冒号。
  // 用全等断言：endsWith 在昵称被错误剥掉时同样为真，分辨不出回归。
  const longNick = `回复@A: 答。//@${'昵'.repeat(41)} 正文里有 http://a.com/b`
  assert.deepEqual(splitReplyChain(longNick), {
    answer: '答。',
    question: `${'昵'.repeat(41)} 正文里有 http://a.com/b`,
  })
})

test('formatDate renders the Beijing-time date', () => {
  // 1787521532000 = 2026-08-24 05:45 UTC+8
  assert.equal(formatDate(1787521532000), '2026-08-24')
})

test('isAiRepost only fires on named models and explicit AI phrasing', () => {
  assert.equal(isAiRepost('它不是藏在山顶的宝藏，而是一块画布。———Gemini'), true)
  assert.equal(isAiRepost('我问了一下AI，答案是这样的'), true)
  assert.equal(isAiRepost('我觉得平常心最重要。'), false)
})

test('isAiRepost fires on署名位 markers, not on merely mentioning a model', () => {
  // 署名位：行首「模型名：」/ 行首独占一行 / 结尾 ——模型名 / 行首「模型名的回答」
  assert.equal(isAiRepost('Gemini：关于泡泡玛特第二座城市乐园的规划，根据官方最新表态……'), true)
  assert.equal(isAiRepost('Gemini: Zone 2（二区心率训练）对皮质醇最友好。'), true)
  assert.equal(isAiRepost('没那么高概率的。\nGemini\n如果单次尝试的成功率是独立且恒定的……'), true)
  assert.equal(isAiRepost('2013年BRK.B的价格区间大约在89.70至118.56之间。\nGemini'), true)
  assert.equal(isAiRepost('英伟达在为下游市场流动性造血。\n——Gemini'), true)
  assert.equal(isAiRepost('Gemini的回答，仅供参考\n王宁过去是怎么回答这些问题的？'), true)
  assert.equal(isAiRepost('Gemini的回答：\n这种说法非常夸张，属于典型的网络谣言。'), true)
  assert.equal(isAiRepost('Gemini：（ai有时候可能乱讲的）\n茅台系列酒是53度飞天的副产品吗？'), true)
  assert.equal(isAiRepost('我让AI查了一下，结果如下：\n……'), true)
  assert.equal(isAiRepost('问了下豆包，它说：\n……'), true)
  assert.equal(isAiRepost('以上是AI的回答，仅供参考。'), true)

  // 段永平本人讨论这些模型 —— 绝不能标成「大道（转AI回答）：」
  // post 404424930
  assert.equal(isAiRepost('这个说的是“焦点法则”， 那Gemini那个解释就是乱讲的了。'), false)
  // post 383901965
  assert.equal(
    isAiRepost('除了Gemini，别的大模型有谁上市了吗？ 除了Gemini，有哪个大模型能活到10年后的？我看不懂大模型的盈利模式。'),
    false,
  )
  // post 405235360
  assert.equal(isAiRepost('这里是不是有“中英文”我不记得了。\n也许有人能找到视频验证一下？我用Gemini查的结果是乱讲的。'), false)
  assert.equal(isAiRepost('我觉得谷歌的Gemini做得不错，但估值太贵了。'), false)
  assert.equal(isAiRepost('DeepSeek出来以后，大家对AI的看法变了很多。'), false)
})

test('isAiRepost does not treat English words containing "ai" as the AI keyword', () => {
  // 「AI」大小写不敏感且无词边界时，Airbnb / Aimee 会命中署名位规则。
  // 投资站讨论 Airbnb 完全现实，这三句都是段永平本人的话。
  assert.equal(isAiRepost('我问了一下Airbnb的客服。'), false)
  assert.equal(isAiRepost('以下是Airbnb的三季度数据。'), false)
  assert.equal(isAiRepost('我让Aimee帮我查了一下。'), false)
  assert.equal(isAiRepost('以上是Shanghai那边朋友的说法。'), false)
  // 真正的 AI 关键词仍要命中（含小写写法）
  assert.equal(isAiRepost('我问了一下ai，它是这么说的'), true)
  assert.equal(isAiRepost('以下是AI的回答，仅供参考'), true)
})

test('isAiRepost does not fire on 段永平 denying AI authorship', () => {
  // 「不」落在「以上」与「是」之间的通配里，会把撇清 AI 的话判成 AI 转述
  assert.equal(isAiRepost('以上不是AI写的，是我自己写的'), false)
  assert.equal(isAiRepost('上面那段不是Gemini写的'), false)
  assert.equal(isAiRepost('以下都不是AI的回答'), false)
})

test('isAiRepost treats a lone model line as a signature only at the head or tail', () => {
  // 「模型名独占一行」是 post 406251826（第 2 行 Gemini）和 402166573
  //（末行 Gemini）的唯一命中路径，必须保留。
  assert.equal(isAiRepost('没那么高概率的。\nGemini\n如果单次尝试的成功率是独立且恒定的……'), true)
  assert.equal(isAiRepost('2013年BRK.B的价格区间大约在89.70至118.56之间。\nGemini'), true)

  // 但列举模型名不是署名：相邻的模型名行是清单，不是署名位
  assert.equal(isAiRepost('我常用的是：\n豆包\n元宝\n这两个'), false)
  assert.equal(isAiRepost('两个模型对比：\nGemini\nChatGPT\n都试过了'), false)
  // 正文中段孤零零出现一行模型名也不算署名
  assert.equal(
    isAiRepost('第一段说的是这个意思。\n第二段讲的是别的。\nGemini\n这是我自己的第四段。\n还有第五段。\n最后一段收尾。'),
    false,
  )
})

test('visibleLength counts characters without whitespace', () => {
  assert.equal(visibleLength('我 基本\n不看财报。'), 8)
})

test('extractBlock builds a normalized block from a raw post', () => {
  const block = extractBlock({
    id: 406252564,
    user_id: 1247347556,
    created_at: 1787521532000,
    text: '回复<a href="/n/A">@A</a>: 乐园不太可能开太多的。//@A:乐园会开到成都吗？',
    description: '',
    retweeted_status: null,
  })
  assert.deepEqual(block, {
    id: '406252564',
    url: 'https://xueqiu.com/1247347556/406252564',
    date: '2026-08-24',
    question: '乐园会开到成都吗？',
    answer: '乐园不太可能开太多的。',
    ai: false,
  })
})

test('extractBlock falls back to the retweeted post when there is no reply chain', () => {
  const block = extractBlock({
    id: 1,
    user_id: 1247347556,
    created_at: 1787521532000,
    text: '找个好门店不容易，需要很久时间的。',
    retweeted_status: { text: '这家店只有40平米，建议阔店。' },
  })
  assert.equal(block.question, '这家店只有40平米，建议阔店。')
  assert.equal(block.answer, '找个好门店不容易，需要很久时间的。')
})

test('extractBlock strips reply prefixes and @提及 from the retweeted question', () => {
  const block = extractBlock({
    id: 405973292,
    user_id: 1247347556,
    created_at: 1787521532000,
    text: '可以卖自己想买的股票的put。',
    retweeted_status: {
      text: '回复<a href="/n/C">@C</a>: <a href="/n/duan">@大道无形我有型</a> 请问现在美股有哪些股票可以sellput?'
        + '//@C:我也想知道',
    },
  })
  assert.equal(block.question, '请问现在美股有哪些股票可以sellput?')
  assert.equal(block.answer, '可以卖自己想买的股票的put。')
})

test('extractBlock rejects posts missing required fields instead of emitting garbage', () => {
  const base = { id: 1, user_id: 1247347556, created_at: 1787521532000, text: '正文' }
  assert.throws(() => extractBlock({ ...base, created_at: undefined }), /created_at/)
  assert.throws(() => extractBlock({ ...base, created_at: 'not-a-number' }), /created_at/)
  assert.throws(() => extractBlock({ ...base, user_id: undefined }), /user_id/)
  // /id/ 也会匹配 user_id 的报错，分辨不出实际触发的是哪条校验
  assert.throws(() => extractBlock({ ...base, id: undefined }), /post\.id is required/)
  assert.throws(() => extractBlock(null), /post/)
})

test('extractBlock rejects non-number created_at instead of emitting 1970-01-01', () => {
  // Number(null) === 0 且 Number.isFinite(0) 为真 —— null / '' / [] / false / true
  // 曾全部通过校验并静默产出 date: '1970-01-01'，而流水线终点是 content/。
  const base = { id: 1, user_id: 1247347556, text: '正文' }
  for (const bad of [null, '', [], false, true, {}]) {
    assert.throws(
      () => extractBlock({ ...base, created_at: bad }),
      /created_at must be an epoch-ms number/,
      `created_at=${JSON.stringify(bad)} 应当被拒绝`,
    )
  }
  // 合法值仍然照常通过
  assert.equal(extractBlock({ ...base, created_at: 1787521532000 }).date, '2026-08-24')
})

test('isSubstantive gates on 30 visible characters unless whitelisted', () => {
  const short = { id: '9', answer: '我基本不看财报。' }
  const long = { id: '10', answer: '一'.repeat(30) }
  assert.equal(isSubstantive(short), false)
  assert.equal(isSubstantive(short, { keepIds: ['9'] }), true)
  assert.equal(isSubstantive(long), true)
})

test('isAlreadyPublished detects answers already merged into the corpus', () => {
  const corpus = normalizeForMatch('**大道：** John是个非常有亲和力的人，我跟他聊了一个小时，很开心。（2026-07-16）')
  const seen = { answer: 'John是个非常有亲和力的人，我跟他聊了一个小时，很开心。' }
  const fresh = { answer: '这是一段完全没有出现过的全新回答，长度足够超过阈值。' }
  assert.equal(isAlreadyPublished(seen, corpus), true)
  assert.equal(isAlreadyPublished(fresh, corpus), false)
})

test('isAlreadyPublished normalizes the corpus itself, so raw markdown也能去重', () => {
  const rawMarkdown = '## 泡泡玛特\n\n网友：John怎么样？\n\n**大道：** John是个非常有亲和力的人，我跟他聊了一个小时，很开心。（2026-07-16）\n'
  const seen = { answer: 'John是个非常有亲和力的人，我跟他聊了一个小时，很开心。' }
  const fresh = { answer: '这是一段完全没有出现过的全新回答，长度足够超过阈值。' }
  assert.equal(isAlreadyPublished(seen, rawMarkdown), true)
  assert.equal(isAlreadyPublished(fresh, rawMarkdown), false)
  // 归一化幂等：已归一化的 corpus 结果不变
  assert.equal(isAlreadyPublished(seen, normalizeForMatch(rawMarkdown)), true)
  // 键太短（归一化后 < 20 字）时保持保守，返回 false
  assert.equal(isAlreadyPublished({ answer: '很开心。' }, rawMarkdown), false)
})

test('renderBlock matches the existing chapter convention', () => {
  assert.equal(
    renderBlock({ question: '请问您怎么看？', answer: '我的看法是这样。', date: '2026-08-01', ai: false }),
    '网友：请问您怎么看？\n\n大道：我的看法是这样。（2026-08-01）',
  )
  assert.equal(
    renderBlock({ question: '', answer: '财报早晚会好的。', date: '2026-08-24', ai: false }),
    '大道：财报早晚会好的。（2026-08-24）',
  )
  assert.equal(
    renderBlock({ question: '人生的意义是什么？', answer: '它是一块画布。', date: '2026-07-22', ai: true }),
    '网友：人生的意义是什么？\n\n大道（转AI回答）：它是一块画布。（2026-07-22）',
  )
})

import { CHAPTER_RULES, classifyBlock } from '../scripts/xueqiu-import-classify.mjs'

test('classifyBlock routes company topics before generic topics', () => {
  // 逐字段断言而非 deepEqual：返回值后续会追加字段（answerMatched），
  // 整体 deepEqual 会把「新增可见性字段」误报成回归。
  const popMart = classifyBlock({ answer: '泡泡玛特的门店确实需要更大一些。', question: '' })
  assert.equal(popMart.slug, 'wenda-company-pop-mart')
  assert.equal(popMart.section, '第二节 情绪价值与潮玩需求')

  const put = classifyBlock({ answer: '卖put有上限，接近上限时我会用买入正股加卖covered call。', question: '' })
  assert.equal(put.slug, 'wenda-invest-11')
  assert.equal(put.section, '第五节 卖put的实务与限制')

  const apple = classifyBlock({ answer: '苹果的估值在成熟期确实不一样了。', question: '' })
  assert.equal(apple.slug, 'wenda-company-apple-03')
  assert.equal(apple.section, '第五节 成熟期的苹果与今天的估值')
})

test('classifyBlock returns null when nothing matches', () => {
  assert.equal(classifyBlock({ answer: '这帽子是在酒店房间里拿的。', question: '' }), null)
})

test('classifyBlock flags whether the answer alone triggers the match', () => {
  // answerMatched=true：answer 正文自己就含关键词，分类可信。
  const fromAnswer = classifyBlock({
    answer: '泡泡玛特的门店确实需要更大一些。',
    question: '大道您怎么看泡泡玛特的门店面积？',
  })
  assert.equal(fromAnswer.slug, 'wenda-company-pop-mart')
  assert.equal(fromAnswer.answerMatched, true)

  // answerMatched=false：answer 是通用回答，全靠提问前 120 字里的「王宁」命中，
  // 下游审稿文件要据此打优先复核标记。
  const fromQuestion = classifyBlock({
    answer: '从你的问题看，你显然不是一个打算长期持有的股东，你远离就好啊。',
    question: '王宁最近减持了，大道您怎么看？',
  })
  assert.equal(fromQuestion.slug, 'wenda-company-pop-mart')
  assert.equal(fromQuestion.answerMatched, false)

  // 没有 question 时必然是 answer 命中
  assert.equal(classifyBlock({ answer: '苹果的估值在成熟期确实不一样了。', question: '' }).answerMatched, true)

  // 命中的是第一条规则的 pattern，answerMatched 说的是「那条规则」而不是「任意规则」：
  // answer 只含 invest-11 的关键词，question 头部含 pop-mart 关键词 → 归 pop-mart 且 answerMatched=false
  const hijacked = classifyBlock({
    answer: '卖put有上限，接近上限时我会用买入正股加卖covered call。',
    question: '请教王宁的事情。',
  })
  assert.equal(hijacked.slug, 'wenda-company-pop-mart')
  assert.equal(hijacked.answerMatched, false)

  // null 分支不带 answerMatched
  assert.equal(classifyBlock({ answer: '这帽子是在酒店房间里拿的。', question: '' }), null)
})

test('classifyBlock does not treat proxy/epoxy/oxygen as the OXY ticker', () => {
  // /oxy/i 无词边界会命中 proxy / epoxy / oxygen，把无关内容塞进能源工业章
  assert.equal(classifyBlock({ answer: '我们用proxy服务器测了epoxy涂层的oxygen透过率。', question: '' }), null)
  assert.equal(classifyBlock({ answer: '这个proxy statement我没细看。', question: '' }), null)
  // 真正的 OXY 代码仍然命中
  const oxy = classifyBlock({ answer: 'OXY现在的分红政策我不太清楚。', question: '' })
  assert.equal(oxy.slug, 'wenda-company-energy-industrial')
  assert.equal(classifyBlock({ answer: '当年买oxy的时候想法很简单。', question: '' }).slug, 'wenda-company-energy-industrial')
})

test('classifyBlock only reads the head of a long quoted question', () => {
  const block = {
    answer: '我觉得财报的定义是未来十年财报的总和。',
    question: `${'噪声'.repeat(80)}泡泡玛特门店体验`,
  }
  assert.equal(classifyBlock(block).slug, 'wenda-invest-07')
})

test('every chapter rule points at an existing chapter file and section heading', async () => {
  const { readdir, readFile } = await import('node:fs/promises')
  // 相对 import.meta.url 定位，跟仓库其余测试一致；用 cwd 相对路径在非仓库根目录跑会失败。
  const dir = new URL('../content/dao/qanda/', import.meta.url)
  const files = new Map()
  for (const name of await readdir(dir)) {
    if (name.endsWith('.md')) files.set(name.replace(/\.md$/, ''), new URL(name, dir))
  }
  for (const rule of CHAPTER_RULES) {
    assert.equal(files.has(rule.slug), true, `${rule.slug} 不存在`)
    // section 是下游插入正文的落点键；写错一个字会静默新建一节，所以钉死在实际标题上。
    const headings = new Set(
      (await readFile(files.get(rule.slug), 'utf8'))
        .split('\n')
        .filter((line) => line.startsWith('## '))
        .map((line) => line.slice(3).trim()),
    )
    assert.equal(headings.has(rule.section), true, `${rule.slug} 里没有节标题「${rule.section}」`)
  }
})

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CANDIDATES_END,
  BATCH,
  collectKeptIds,
  hasCitationMarkers,
  isSuspectedAiRepost,
  looksLikeAiListicle,
  optionValue,
  parseArgs,
  parseReview,
  renderReview,
  resolveOutputPath,
} from '../scripts/import-xueqiu-qanda.mjs'

test('renderReview emits a parseable, hand-editable heading per block', () => {
  const markdown = renderReview([
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '开到成都吗？', answer: '不太可能开太多。', ai: false },
      target: { slug: 'wenda-company-pop-mart', section: '第三节 情绪价值与用户观察' },
    },
  ])
  assert.match(markdown, /^### \[keep\] 1 · wenda-company-pop-mart · 第三节 情绪价值与用户观察$/m)
  assert.match(markdown, /<!-- https:\/\/xueqiu\.com\/1247347556\/1 -->/)
  assert.match(markdown, /网友：开到成都吗？/)
  assert.match(markdown, /大道：不太可能开太多。（2026-08-24）/)
})

test('parseReview round-trips renderReview and honours hand edits', () => {
  const entries = [
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '开到成都吗？', answer: '不太可能开太多。', ai: false },
      target: { slug: 'wenda-company-pop-mart', section: '第三节 情绪价值与用户观察' },
    },
    {
      block: { id: '2', url: 'https://xueqiu.com/1247347556/2', date: '2026-08-23', question: '', answer: '我基本不看财报。', ai: false },
      target: { slug: 'UNSORTED', section: '待人工归类' },
    },
  ]
  const edited = renderReview(entries).replace('### [keep] 2 ·', '### [drop] 2 ·')
  const parsed = parseReview(edited)
  assert.equal(parsed.length, 2)
  assert.deepEqual(
    { ...parsed[0], body: parsed[0].body.trim() },
    {
      decision: 'keep',
      id: '1',
      slug: 'wenda-company-pop-mart',
      section: '第三节 情绪价值与用户观察',
      body: '网友：开到成都吗？\n\n大道：不太可能开太多。（2026-08-24）',
    },
  )
  assert.equal(parsed[1].decision, 'drop')
})

test('parseReview strips the source url comment from the body', () => {
  const markdown = [
    '### [keep] 7 · wenda-invest-07 · 第一节 估值逻辑与定性判断',
    '',
    '<!-- https://xueqiu.com/1247347556/7 -->',
    '',
    '大道：财报早晚会好的。（2026-08-24）',
    '',
  ].join('\n')
  assert.equal(parseReview(markdown)[0].body.trim(), '大道：财报早晚会好的。（2026-08-24）')
})

test('renderReview flags blocks whose chapter came only from the question', () => {
  const markdown = renderReview([
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '王宁最近减持了，大道您怎么看？', answer: '你显然不打算长期持有，远离就好啊。', ai: false },
      target: { slug: 'wenda-company-pop-mart', section: '第三节 情绪价值与用户观察', answerMatched: false },
    },
    {
      block: { id: '2', url: 'https://xueqiu.com/1247347556/2', date: '2026-08-24', question: '', answer: '泡泡玛特的门店确实需要更大一些。', ai: false },
      target: { slug: 'wenda-company-pop-mart', section: '第三节 情绪价值与用户观察', answerMatched: true },
    },
  ])
  // 标记单独占一行，标题行契约逐字不变（Task 5 的标题正则不能被标记打断）
  assert.match(markdown, /^### \[keep\] 1 · wenda-company-pop-mart · 第三节 情绪价值与用户观察$/m)
  assert.match(markdown, /^> ⚠️靠提问命中/m)
  // answerMatched 为 true 的块不带标记
  const second = markdown.slice(markdown.indexOf('### [keep] 2 ·'))
  assert.equal(second.includes('⚠️靠提问命中'), false)

  // 标记既不污染 section，也不进正文
  const parsed = parseReview(markdown)
  assert.equal(parsed[0].section, '第三节 情绪价值与用户观察')
  assert.equal(parsed[0].body.trim(), '网友：王宁最近减持了，大道您怎么看？\n\n大道：你显然不打算长期持有，远离就好啊。（2026-08-24）')
})

test('renderReview does not flag unsorted blocks that never matched a rule', () => {
  const markdown = renderReview([
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '', answer: '这帽子是在酒店房间里拿的。', ai: false },
      target: { slug: 'UNSORTED', section: '待人工归类' },
    },
  ])
  // 表头图例里会出现标签名，所以只断言没有任何块挂上标记行
  assert.equal(/^> ⚠️/m.test(markdown), false)
})

test('hasCitationMarkers spots retrieval-style [source +n] footnotes', () => {
  // 真实假阴性样本（post 383156505 / 383561950）里模型检索输出的引文标记
  assert.equal(hasCitationMarkers('结果引发市场风波。[cs +1]'), true)
  assert.equal(hasCitationMarkers('主要是食欲素受体拮抗剂。[udn +2]'), true)
  assert.equal(hasCitationMarkers('他多次公开表示不会做空。[163 +3]'), true)
  assert.equal(hasCitationMarkers('一般可以用精简版引用。[finance.sina +4]'), true)
  // 雪球表情、脚注序号、普通算式都不算
  assert.equal(hasCitationMarkers('谢谢[抱拳]'), false)
  assert.equal(hasCitationMarkers('见注[1]'), false)
  assert.equal(hasCitationMarkers('来源[cs]'), false)
  assert.equal(hasCitationMarkers(''), false)
  // 非全局正则：连续调用不能因为 lastIndex 漏判
  assert.equal(hasCitationMarkers('第二次也要命中。[cs +1]'), true)
})

test('looksLikeAiListicle spots long enumerated answers', () => {
  const listicle = [
    '泡泡玛特门店的进店转化率大约在三成到四成之间，可以从以下几方面理解这个数据。',
    '1. 进店转化率与空手离开率的拆解',
    `${'打卡观赏型顾客把门店当成展厅，拍照之后并不下单。'.repeat(6)}`,
    '2. 会员复购率的口径差异',
    `${'官方财报只披露整体会员复购率，与单店进店转化不是一个口径。'.repeat(6)}`,
    '3. 线下零售的普遍规律',
    `${'同类潮玩集合店的进店转化率大体也在这个区间。'.repeat(6)}`,
  ].join('\n')
  assert.equal(looksLikeAiListicle(listicle), true)
  // 长但不分条的段永平口语长答不算
  assert.equal(looksLikeAiListicle('我实际上从来就没有直接卖过一股泡泡玛特。'.repeat(20)), false)
  // 分条但很短的不算（段永平自己也会列一二三）
  assert.equal(looksLikeAiListicle('1. 不做假\n2. 不代工\n3. 不价格战'), false)
  assert.equal(looksLikeAiListicle(''), false)
})

test('isSuspectedAiRepost only fires on blocks that isAiRepost already missed', () => {
  const cited = { answer: '他多次公开表示不会做空。[163 +3]', ai: false }
  assert.equal(isSuspectedAiRepost(cited), true)
  // 已经判为 AI 转帖的走「已标注」那一组，不重复列
  assert.equal(isSuspectedAiRepost({ ...cited, ai: true }), false)
  assert.equal(isSuspectedAiRepost({ answer: '乐园不太可能开太多的。', ai: false }), false)
})

test('renderReview lists every attribution risk in a dedicated section', () => {
  const entries = [
    {
      block: { id: '900', url: 'https://xueqiu.com/1247347556/900', date: '2026-08-24', question: '', answer: '我问了一下Gemini，它说消费降级是个伪命题，因为人们只是把钱花在更能提供情绪价值的地方了，尾巴。', ai: true },
      target: { slug: 'wenda-invest-05', section: '第一节 把波动当作朋友', answerMatched: true },
    },
    {
      block: { id: '901', url: 'https://xueqiu.com/1247347556/901', date: '2026-08-23', question: '', answer: '他多次公开表示自己不会做空股票。[163 +3]', ai: false },
      target: { slug: 'wenda-invest-04', section: '第五节 杠杆的诱惑与下注的勇气', answerMatched: true },
    },
    {
      block: { id: '902', url: 'https://xueqiu.com/1247347556/902', date: '2026-08-22', question: '', answer: '乐园不太可能开太多的。', ai: false },
      target: { slug: 'wenda-company-pop-mart', section: '第三节 情绪价值与用户观察', answerMatched: true },
    },
  ]
  const markdown = renderReview(entries)
  const section = markdown.slice(markdown.indexOf('## 归属强制过目'))
  assert.match(markdown, /## 归属强制过目/)
  assert.match(section, /`900`/)
  assert.match(section, /`901`/)
  // 归属正常的块不进复核区
  assert.equal(section.includes('`902`'), false)
  // 只列指向：首 40 字 + 链接，不重复整段正文
  assert.match(section, /https:\/\/xueqiu\.com\/1247347556\/900/)
  assert.equal(section.includes('尾巴'), false)
  // 复核区不会被 parseReview 误当成待导入条目
  assert.equal(parseReview(markdown).length, 3)
})

// 审稿文件的存在意义就是给人手改，而 `---`、`## 小标题` 正是编辑最容易随手敲进正文的东西。
// 旧实现把它们当成「候选区结束」，正文被静默截断后直接流进 content/ —— 失败是无声的。
const HAND_EDIT_HAZARDS = [
  ['水平分割线', '前一段说的是这个。\n\n---\n\n后一段必须原样保留下来。'],
  ['正文里的二级标题', '前一段说的是这个。\n\n## 这是正文里的小标题\n\n后一段必须原样保留下来。'],
  ['形似条目标题行', '前一段说的是这个。\n\n### [keep] 9 · a · b\n\n后一段必须原样保留下来。'],
  ['形似归属标记行', '前一段说的是这个。\n\n> ⚠️这是正文里引用的一行提醒。\n\n后一段必须原样保留下来。'],
  ['正文里的 html 注释', '前一段说的是这个。\n\n<!-- https://example.com/x -->\n\n后一段必须原样保留下来。'],
  ['连续空行', '前一段说的是这个。\n\n\n\n后一段必须原样保留下来。'],
  ['正文里的终止哨兵', `前一段说的是这个。\n\n${CANDIDATES_END}\n\n后一段必须原样保留下来。`],
]

test('parseReview round-trips bodies containing structural markers verbatim', () => {
  for (const [name, answer] of HAND_EDIT_HAZARDS) {
    const block = { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '请问您怎么看？', answer, ai: false }
    const markdown = renderReview([
      { block, target: { slug: 'wenda-invest-07', section: '第一节 估值逻辑与定性判断' } },
    ])
    const parsed = parseReview(markdown)
    // 幻影条目：形似标题行的正文行曾多解析出一条，带着半截正文流向 content/
    assert.equal(parsed.length, 1, `${name}：不应多出或丢失条目`)
    assert.equal(parsed[0].slug, 'wenda-invest-07', `${name}：归属被正文行污染`)
    // 逐字一致，不是「包含」——静默截断的正是尾巴
    assert.equal(parsed[0].body, renderBlock(block), `${name}：正文往返不一致`)
  }
})

test('parseReview round-trips a sentinel line that carries trailing whitespace', () => {
  // 转义判定用严格 ===、终止判定用 trimEnd() 时，正文里一行「哨兵 + 尾随空格」不会被转义，
  // 却会让 parseReview 提前 break —— 尾巴和其后所有条目静默消失。两边口径必须一致。
  const answer = `前一段说的是这个。\n\n${CANDIDATES_END}  \n\n后一段必须原样保留下来。`
  const blocks = [
    { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '请问您怎么看？', answer, ai: false },
    { id: '2', url: 'https://xueqiu.com/1247347556/2', date: '2026-08-23', question: '', answer: '第二条也不能跟着一起消失。', ai: false },
  ]
  const markdown = renderReview(blocks.map((block) => ({
    block,
    target: { slug: 'wenda-invest-07', section: '第一节 估值逻辑与定性判断' },
  })))
  const parsed = parseReview(markdown)
  assert.equal(parsed.length, 2, '带尾随空格的哨兵行不应吞掉后续条目')
  assert.equal(parsed[0].body, renderBlock(blocks[0]), '带尾随空格的哨兵行不应截断正文')
  assert.equal(parsed[1].body, renderBlock(blocks[1]))
})

test('renderReview ends the candidate region with a sentinel, not with --- or ##', () => {
  const entries = [
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '', answer: '一'.repeat(40), ai: false },
      target: { slug: 'wenda-invest-07', section: '第一节 估值逻辑与定性判断' },
    },
  ]
  const markdown = renderReview(entries)
  const lines = markdown.split('\n')
  // 哨兵唯一，且排在其余章节之前
  assert.equal(lines.filter((line) => line === CANDIDATES_END).length, 1)
  assert.ok(markdown.indexOf(CANDIDATES_END) < markdown.indexOf('## 归属强制过目'))

  // 哨兵之后的内容一概不解析，哪怕长得像条目标题
  const tampered = `${markdown}\n### [keep] 999 · wenda-invest-07 · 第一节 估值逻辑与定性判断\n\n伪造正文\n`
  assert.equal(parseReview(tampered).length, 1)
  assert.equal(parseReview(tampered)[0].id, '1')
})

test('parseReview only strips metadata lines that sit right under the heading', () => {
  const markdown = [
    '### [keep] 7 · wenda-invest-07 · 第一节 估值逻辑与定性判断',
    '',
    '> ⚠️靠提问命中：归属存疑。',
    '',
    '<!-- https://xueqiu.com/1247347556/7 -->',
    '',
    '大道：财报早晚会好的。（2026-08-24）',
    '',
    '<!-- https://example.com/正文里的链接 -->',
    '',
    '> ⚠️正文里引用的提醒。',
    '',
  ].join('\n')
  const parsed = parseReview(markdown)
  assert.equal(parsed.length, 1)
  assert.equal(
    parsed[0].body,
    '大道：财报早晚会好的。（2026-08-24）\n\n<!-- https://example.com/正文里的链接 -->\n\n> ⚠️正文里引用的提醒。',
  )
})

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))

test('resolveOutputPath refuses to write anywhere under content/', () => {
  // 审稿文件是流水线的闸门，--out 打进 content/ 等于跳过闸门直接改站点正文
  assert.throws(() => resolveOutputPath('content/dao/qanda/wenda-invest-07.md'), /content\//)
  assert.throws(() => resolveOutputPath('docs/../content/x.md'), /content\//)
  assert.throws(() => resolveOutputPath(path.join(REPO_ROOT, 'content/dao/qanda/x.md')), /content\//)
  assert.throws(() => resolveOutputPath('content'), /content\//)
  // 正常目标照常返回绝对路径
  assert.equal(
    resolveOutputPath('docs/content-audits/x.md'),
    path.join(REPO_ROOT, 'docs/content-audits/x.md'),
  )
  // 名字里带 content 但不在 content/ 下的目录不受影响
  assert.equal(
    resolveOutputPath('docs/content-audits/contents.md'),
    path.join(REPO_ROOT, 'docs/content-audits/contents.md'),
  )
})

test('resolveOutputPath blocks content/ case-insensitively where the filesystem is', () => {
  // 本机根分区是 APFS（默认大小写不敏感），字面比较放行的 CONTENT/ 会真的写进 content/
  for (const output of ['CONTENT/x.md', 'Content/dao/x.md', 'content/DAO/x.md', 'docs/../CoNtEnT/x.md']) {
    assert.throws(() => resolveOutputPath(output, { caseInsensitive: true }), /content\//, output)
  }
  // 别误伤名字里带 content 但不在 content/ 下的路径
  assert.equal(
    resolveOutputPath('docs/content-audits/contents.md', { caseInsensitive: true }),
    path.join(REPO_ROOT, 'docs/content-audits/contents.md'),
  )
  assert.equal(
    resolveOutputPath('docs/Contents.md', { caseInsensitive: true }),
    path.join(REPO_ROOT, 'docs/Contents.md'),
  )
  // 大小写不敏感的平台上，默认参数就该拦住
  if (process.platform === 'darwin' || process.platform === 'win32') {
    assert.throws(() => resolveOutputPath('CONTENT/x.md'), /content\//)
    assert.throws(() => resolveOutputPath('Content/dao/x.md'), /content\//)
  }
})

test('parseArgs splits on the first = and keeps = inside the value', () => {
  assert.deepEqual(parseArgs(['--review', '--in=raw/xueqiu/a.json']), { review: true, in: 'raw/xueqiu/a.json' })
  // 旧实现按 split('=') 取 [0]/[1]，--out=a=b 会被截成 a
  assert.deepEqual(parseArgs(['--out=a=b']), { out: 'a=b' })
  assert.deepEqual(parseArgs(['--review']), { review: true })
  assert.throws(() => parseArgs(['review']), /--/)
  assert.throws(() => parseArgs(['--=x']), /缺少参数名/)
})

test('optionValue rejects path options used without a value', () => {
  // 旧实现里 `--in`（无 =）得到 true，一路走到 path.resolve(ROOT, true) 才抛 TypeError
  assert.throws(() => optionValue({ in: true }, 'in', 'raw/default.json'), /--in 需要一个非空的值/)
  assert.throws(() => optionValue({ out: '' }, 'out', 'docs/default.md'), /--out 需要一个非空的值/)
  assert.throws(() => optionValue({ out: '   ' }, 'out', 'docs/default.md'), /--out 需要一个非空的值/)
  assert.equal(optionValue({}, 'in', 'raw/default.json'), 'raw/default.json')
  assert.equal(optionValue({ in: 'raw/x.json' }, 'in', 'raw/default.json'), 'raw/x.json')
})

import { insertIntoSection, sectionNumber } from '../scripts/import-xueqiu-qanda.mjs'

const CHAPTER = [
  '---',
  'title: "示例"',
  '---',
  '',
  '## 第一节 甲',
  '',
  '大道：原有内容一。（2020-01-01）',
  '',
  '## 第二节 乙',
  '',
  '大道：原有内容二。（2020-01-02）',
  '',
].join('\n')

test('sectionNumber reads the chinese ordinal out of a section title', () => {
  assert.equal(sectionNumber('第一节 甲'), 1)
  assert.equal(sectionNumber('第七节 门店、海外与供应链'), 7)
  assert.equal(sectionNumber('第十二节 丙'), 12)
  assert.equal(sectionNumber('前言'), null)
})

test('insertIntoSection appends to the end of an existing section', () => {
  const result = insertIntoSection(CHAPTER, '第一节 甲', ['大道：新内容。（2026-08-24）'])
  assert.match(result, /大道：原有内容一。（2020-01-01）\n\n大道：新内容。（2026-08-24）\n\n## 第二节 乙/)
  assert.match(result, /大道：原有内容二。（2020-01-02）/)
})

test('insertIntoSection appends to the last section without eating the trailing newline', () => {
  const result = insertIntoSection(CHAPTER, '第二节 乙', ['大道：新内容。（2026-08-24）'])
  assert.equal(result.endsWith('大道：新内容。（2026-08-24）\n'), true)
})

test('insertIntoSection creates the next section when it does not exist yet', () => {
  const result = insertIntoSection(CHAPTER, '第三节 丙', ['大道：新内容。（2026-08-24）'])
  assert.match(result, /\n## 第三节 丙\n\n大道：新内容。（2026-08-24）\n$/)
})

test('insertIntoSection refuses to create a section that skips a number', () => {
  assert.throws(
    () => insertIntoSection(CHAPTER, '第五节 丁', ['大道：新内容。（2026-08-24）']),
    /第五节.*现有最大节号 2/,
  )
})

import {
  assertPathspecsTracked,
  assertReviewIntegrity,
  collectRawIds,
  CONTENT_DIRS,
  gitListFilesArgs,
  gitStatusArgs,
  resolveCliOptions,
} from '../scripts/import-xueqiu-qanda.mjs'

// --apply 之前的四道校验都跑在这份最小审稿文件上：一条 keep、一条 drop、一行哨兵。
function reviewSheet(entries, { sentinel = true } = {}) {
  const lines = []
  for (const entry of entries) {
    lines.push(`### [${entry.decision || 'keep'}] ${entry.id} · ${entry.slug || 'wenda-life-03'} · ${entry.section || '第二节 做喜欢的事情'}`, '')
    lines.push(`<!-- https://xueqiu.com/1247347556/${entry.id} -->`, '')
    if (entry.body !== '') lines.push(entry.body || `网友：问${entry.id}？\n\n大道：答${entry.id}。（2026-08-24）`, '')
  }
  if (sentinel) lines.push(CANDIDATES_END, '')
  lines.push('---', '', '## 归属强制过目（署名错了就是硬伤）', '', '- `999` 2026-08-24 · 摘要')
  return `${lines.join('\n')}\n`
}

function check(markdown, ids = ['111', '222']) {
  assertReviewIntegrity(markdown, parseReview(markdown), new Set(ids))
}

test('assertReviewIntegrity passes a well-formed review sheet', () => {
  assert.doesNotThrow(() => check(reviewSheet([{ id: '111' }, { id: '222', decision: 'drop' }])))
})

test('assertReviewIntegrity refuses a sheet whose END-OF-CANDIDATES sentinel was deleted', () => {
  // 实测：删掉哨兵后最后一个条目的 body 会吞掉文末「归属强制过目」整段，静默污染正文
  const sheet = reviewSheet([{ id: '111' }], { sentinel: false })
  assert.match(parseReview(sheet).at(-1).body, /归属强制过目/) // 这就是被吞掉的证据
  assert.throws(() => check(sheet), /END-OF-CANDIDATES/)
})

test('assertReviewIntegrity accepts a sentinel line with trailing whitespace', () => {
  // 判定必须和 parseReview 的终止条件同口径（都 trimEnd 后比较），否则一边放行一边不认
  const sheet = reviewSheet([{ id: '111' }]).replace(CANDIDATES_END, `${CANDIDATES_END}  `)
  assert.doesNotThrow(() => check(sheet))
})

test('assertReviewIntegrity refuses ids that are missing from the raw scrape', () => {
  // 手工编辑误删正文里的转义反斜杠 / 凭空多出条目，都会在这里露馅
  assert.throws(() => check(reviewSheet([{ id: '111' }, { id: '40157399' }])), /40157399/)
  assert.throws(() => check(reviewSheet([{ id: '111' }, { id: '40157399' }])), /原始抓取数据/)
  // drop 掉的条目同样要对得上：id 对不上说明文件结构已经坏了，不是「反正不写入」能糊弄过去的
  assert.throws(() => check(reviewSheet([{ id: '333', decision: 'drop' }])), /333/)
})

test('assertReviewIntegrity refuses a kept entry with an empty body', () => {
  // 原实现用 `&& entry.body` 静默跳过，等于悄悄少导一条
  const sheet = reviewSheet([{ id: '111', body: '' }, { id: '222' }])
  assert.equal(parseReview(sheet)[0].body, '')
  assert.throws(() => check(sheet), /111/)
  assert.throws(() => check(sheet), /正文为空/)
  // drop 掉的条目可以是空正文：编辑删掉正文再标 drop 是正常操作
  assert.doesNotThrow(() => check(reviewSheet([{ id: '111', body: '', decision: 'drop' }, { id: '222' }])))
})

test('assertReviewIntegrity refuses duplicate ids', () => {
  // 同一个 id 出现两次会被插两遍正文
  assert.throws(() => check(reviewSheet([{ id: '111' }, { id: '222' }, { id: '111' }])), /111/)
  assert.throws(() => check(reviewSheet([{ id: '111' }, { id: '111' }])), /重复/)
})

test('collectRawIds reads post ids as strings and rejects unusable raw data', () => {
  assert.deepEqual(
    [...collectRawIds('[{"id":406252564},{"id":"401573992"}]', 'raw.json')],
    ['406252564', '401573992'],
  )
  assert.throws(() => collectRawIds('{"posts":[]}', 'raw.json'), /post 数组/)
  assert.throws(() => collectRawIds('not json', 'raw.json'), /JSON/)
})

test('resolveCliOptions fills in the apply defaults and keeps --dry-run a switch', () => {
  assert.deepEqual(resolveCliOptions(['--apply']), {
    mode: 'apply',
    input: BATCH.review,
    raw: BATCH.raw,
    dryRun: false,
    force: false,
  })
  // 裸跑 --apply 会真的改写正文且不幂等：默认值必须指向当前批次，
  // 指着上一批已经导完的审稿单就是把 200 个块再插一遍。
  assert.match(BATCH.review, /xueqiu-2026-08-24-import\.md$/)
  assert.match(BATCH.raw, /duan\.20260824-\.raw\.json$/)
  assert.equal(BATCH.label, '2026-08-24 → 2026-09-03')
  // 跨批次去重要拿上一批的审稿单当输入，漏配就是「已入库的再导一遍」
  assert.deepEqual(BATCH.previousReviews, ['docs/content-audits/xueqiu-2026-07-16-import.md'])
  assert.equal(resolveCliOptions(['--apply', '--dry-run']).dryRun, true)
  assert.equal(resolveCliOptions(['--apply', '--raw=raw/other.json']).raw, 'raw/other.json')
  assert.equal(resolveCliOptions(['--review']).mode, 'review')
  assert.equal(resolveCliOptions([]).mode, 'usage')
  // `--dry-run=` 会被 Boolean('') 判成 false，然后真的写盘；拼错的开关同理会被忽略
  assert.throws(() => resolveCliOptions(['--apply', '--dry-run=false']), /--dry-run/)
  assert.throws(() => resolveCliOptions(['--apply', '--dryrun']), /--dryrun/)
  assert.throws(() => resolveCliOptions(['--review', '--apply']), /只能选一个/)
})

test('collectKeptIds picks up only the ids a previous batch decided to keep', () => {
  const sheet = [
    '# 雪球 2026-07-16 → 2026-08-24 导入待审稿',
    '',
    '### [keep] 406251826 · wenda-company-pop-mart · 第三节 情绪价值与用户观察',
    '<!-- https://xueqiu.com/1247347556/406251826 -->',
    '网友：36 次都没抽到隐藏款正常吗？',
    '',
    '### [drop] 406251596 · wenda-life-03 · 第二节 做喜欢的事情',
    '<!-- https://xueqiu.com/1247347556/406251596 -->',
    '大道：屏蔽的规矩。',
    '',
    '### [keep] 406249557 · wenda-invest-01 · 第六节 好公司比好价格重要与满仓主义',
    '<!-- https://xueqiu.com/1247347556/406249557 -->',
    '大道：好公司比好价格重要。',
  ].join('\n')

  const kept = collectKeptIds(sheet)
  // [keep] 的进集合：这些已经写进正文了，本批再导一遍就是重复内容
  assert.equal(kept.has('406251826'), true)
  assert.equal(kept.has('406249557'), true)
  // [drop] 的不进：那是「上批没收」，本批还可以重新判断，跳过就等于永久丢内容
  assert.equal(kept.has('406251596'), false)
  assert.equal(kept.size, 2)
})

test('BATCH.previousReviews never contains the current batch review sheet', () => {
  // previousReviews 只放已导完的历史批次。当前批次的 review 混进来，runReview 就会拿本批
  // 自己刚人工审校好的审稿单当去重输入：每一条 [keep] 都被判成 duplicate 跳过，再用剩下的
  // 残渣覆盖写回同一个文件 —— 人工审校成果和那批内容一起无声消失，输出里只有 duplicate 变大。
  // 脚本模块顶层有同样的自检；这条断言把「配置正确」本身钉死，改批次漏改 review 就红。
  assert.equal(BATCH.previousReviews.includes(BATCH.review), false)
})

test('resolveCliOptions refuses a valued --apply instead of turning a dry run into a real write', () => {
  // parseArgs 按第一个 `=` 切分、`=` 之后全部进 value，所以带值的 --apply 会连后面的
  // --dry-run 一起吞掉：下面每一条在旧实现里都解析成 {mode:'apply', dryRun:false} 然后真写盘。
  // 触发路径：zsh 里没引号的 $FLAGS（zsh 不做词分割）、xargs、CI 变量、npm 参数透传、多打一个引号。
  for (const argv of [
    ['--apply=false --dry-run'],
    ['--apply=x --dry-run'],
    ['--apply=1'],
    ['--apply=false'],
    ['--apply=true'],
    ['--apply='],
    ['--apply=false', '--dry-run'],
  ]) {
    assert.throws(() => resolveCliOptions(argv), /--apply 是开关，不接受值/, JSON.stringify(argv))
  }
  // --review / --force 同样是纯开关，同样不许带值
  assert.throws(() => resolveCliOptions(['--review=false --out=x.md']), /--review 是开关/)
  assert.throws(() => resolveCliOptions(['--apply', '--force=false']), /--force 是开关/)
  // 正常写法照常工作
  assert.equal(resolveCliOptions(['--apply', '--dry-run']).dryRun, true)
  assert.equal(resolveCliOptions(['--apply', '--force']).force, true)
  assert.equal(resolveCliOptions(['--apply']).force, false)
})

test('resolveCliOptions rejects flags that belong to the other mode instead of ignoring them', () => {
  // --out 恰恰是 resolveOutputPath 重点防的那个参数：在 --apply 下被静默忽略，
  // 用的人会以为自己把结果写去了别处，实际改的是 content/ 里的真章节。
  assert.throws(() => resolveCliOptions(['--apply', '--out=content/dao/qanda/x.md']), /--out/)
  assert.throws(() => resolveCliOptions(['--review', '--raw=raw/x.json']), /--raw/)
  assert.throws(() => resolveCliOptions(['--review', '--dry-run']), /--dry-run/)
  assert.throws(() => resolveCliOptions(['--review', '--force']), /--force/)
  assert.throws(() => resolveCliOptions(['--review', '--nope']), /--nope/)
  // 各自模式下的合法参数不受影响
  assert.equal(resolveCliOptions(['--review', '--in=raw/a.json', '--out=docs/a.md']).output, 'docs/a.md')
  assert.equal(resolveCliOptions(['--apply', '--in=docs/a.md', '--raw=raw/a.json']).input, 'docs/a.md')
})

test('resolveCliOptions names the unrecognised flag instead of just printing the usage line', () => {
  // 白名单按模式分开之后，不含 --review/--apply 的错参数会一路走到「没选模式」分支，
  // 只打印一行 USAGE：用的人不知道是哪个参数错了，只能瞪着用法自己猜。
  assert.throws(() => resolveCliOptions(['--nope']), /无法识别的参数：--nope/)
  assert.throws(() => resolveCliOptions(['--dryrun']), /--dryrun/)
  assert.throws(() => resolveCliOptions(['--applyy', '--in=x.md']), /--applyy/)
  // 整串挤进一个 argv（zsh 不做词分割）时，键是 `apply --dry-run`，模式判定看不见 apply
  assert.throws(() => resolveCliOptions(['--apply --dry-run']), /无法识别的参数：--apply --dry-run/)
  // 报错里带上可用参数，省得再翻用法
  assert.throws(() => resolveCliOptions(['--nope']), /--dry-run/)
  // 多个错参数一起报
  assert.throws(() => resolveCliOptions(['--nope', '--nada']), /--nope、--nada/)
  // 不能抢走上一轮的 Critical 修复：带值的开关仍然按「开关不接受值」报错
  assert.throws(() => resolveCliOptions(['--apply=false --dry-run']), /--apply 是开关，不接受值/)
  assert.throws(() => resolveCliOptions(['--apply=false', '--nope']), /--apply 是开关，不接受值/)
  // 合法参数不受影响；没写任何参数时仍然只是打印用法
  assert.equal(resolveCliOptions([]).mode, 'usage')
  assert.equal(resolveCliOptions(['--apply', '--dry-run']).dryRun, true)
})

test('the content/ pathspec is derived from CONTENT_DIRS and immune to ambient git config', () => {
  // N3：`status.showUntrackedFiles=no` 会让未跟踪的 content/ 文件在 porcelain 里完全不可见
  assert.deepEqual(gitStatusArgs(), ['status', '--porcelain', '--untracked-files=normal', '--', ...CONTENT_DIRS])
  // N4：pathspec 跟着真正会被改写的目录走，不再是写死的 'content/'
  assert.equal(gitStatusArgs().includes('content/'), false)
  assert.deepEqual(gitStatusArgs(['a/b']).slice(-1), ['a/b'])
  assert.deepEqual(gitListFilesArgs(), ['ls-files', '-z', '--', ...CONTENT_DIRS])
})

// 断言错误信息的具体内容时用它：assert.throws 的正则只能断言「出现过」，
// 断不了「不该出现的没出现」，而这正是「点名是哪一条」要验的另一半。
function messageOf(fn) {
  try {
    fn()
  } catch (error) {
    return String(error?.message ?? error)
  }
  return assert.fail('预期会抛错，实际没抛')
}

test('assertPathspecsTracked fails closed when a pathspec matches nothing tracked', () => {
  // git 对匹配不到任何东西的 pathspec 是 exit 0 + 空输出：拼错一个字母，脏工作区检查就恒为干净
  assert.throws(() => assertPathspecsTracked(['contnet/dao/qanda'], ''), /没有任何已跟踪文件/)
  assert.throws(() => assertPathspecsTracked(['contnet/dao/qanda'], ''), /contnet\/dao\/qanda/)
  // 三条里有一条匹配不到也要报，并且点名的必须是缺的那两条 —— 不能把已经匹配上的 qanda 也算进去。
  // （旧断言写成 /investment-logic.*business-logic|business-logic/，正则交替让第一支成了死代码，
  //   整条等价于 /business-logic/，「点名是哪一条」根本没被断住。）
  // 这里不用 CONTENT_DIRS：问答目录合并后它只剩一条，解构不出「三条」；护栏是纯函数，用假目录测即可。
  const dirs = ['content/dao/a', 'content/dao/b', 'content/dao/c']
  const [qanda, invest, business] = dirs
  const missingTwo = messageOf(() => assertPathspecsTracked(dirs, `${qanda}/a.md\0`))
  assert.equal(missingTwo.includes(invest), true, missingTwo)
  assert.equal(missingTwo.includes(business), true, missingTwo)
  assert.equal(missingTwo.includes(qanda), false, `已匹配上的目录不该被点名：${missingTwo}`)
  // 反过来：只缺最后一条时也只点它，不牵连另外两条
  const missingOne = messageOf(
    () => assertPathspecsTracked(dirs, [`${qanda}/a.md`, `${invest}/b.md`].join('\0')),
  )
  assert.equal(missingOne.includes(business), true, missingOne)
  assert.equal(missingOne.includes(qanda), false, missingOne)
  assert.equal(missingOne.includes(invest), false, missingOne)
  // 前缀相同但不是同一个目录不算命中（qanda vs qanda-old）
  assert.throws(() => assertPathspecsTracked(['content/dao/qanda'], 'content/dao/qanda-old/a.md\0'), /qanda/)
  // 真匹配到就放行；ls-files 的 -z 输出以 NUL 分隔
  assert.doesNotThrow(
    () => assertPathspecsTracked(CONTENT_DIRS, CONTENT_DIRS.map((dir) => `${dir}/a.md`).join('\0')),
  )
  // 空 pathspec 列表在生产里不可达（CONTENT_DIRS 恒非空），但「没有目录要查」不等于
  // 「查过了、工作区是干净的」：静默放行是 fail open，不该被断言固化成契约。
  assert.equal(CONTENT_DIRS.length > 0, true, '前提：CONTENT_DIRS 恒非空，空列表只可能是被改坏了')
  assert.throws(() => assertPathspecsTracked([], ''), /CONTENT_DIRS/)
  assert.throws(() => assertPathspecsTracked([], 'content/dao/qanda/a.md\0'), /pathspec/)
})

test('assertReviewIntegrity refuses a sentinel that was moved ahead of the entries', () => {
  // 哨兵被手工挪到候选区中间正是这道护栏要防的事故：parseReview 在哨兵处 break，
  // 后面的条目静默消失。实测挪到第一个条目之前时，--apply 会输出 kept:0 然后 exit 0。
  const sheet = reviewSheet([{ id: '111' }, { id: '222' }])
  const moved = moveSentinelBefore(sheet, '### [keep] 111')
  assert.equal(parseReview(moved).length, 0) // 这就是条目被静默吞掉的证据
  assert.throws(() => check(moved), /哨兵/)
  assert.throws(() => check(moved), /条目标题行/)

  // 挪到两个条目中间：只剩前一条，后一条无声消失
  const middle = moveSentinelBefore(sheet, '### [keep] 222')
  assert.equal(parseReview(middle).length, 1)
  assert.throws(() => check(middle), /条目标题行/)

  // drop 的标题行同样算数（结构坏了就是坏了，不因为它不写入而放行）
  const dropped = moveSentinelBefore(reviewSheet([{ id: '111' }, { id: '222', decision: 'drop' }]), '### [drop] 222')
  assert.throws(() => check(dropped), /条目标题行/)

  // 正常顺序不误伤：正文里形似标题行的行渲染时带转义反斜杠，不该被当成漏在哨兵后面的条目
  const escaped = renderReview([
    {
      block: { id: '1', url: 'https://xueqiu.com/1247347556/1', date: '2026-08-24', question: '', answer: `一段正文。\n\n### [keep] 9 · a · b\n\n还有一段。`, ai: false },
      target: { slug: 'wenda-invest-07', section: '第一节 估值逻辑与定性判断' },
    },
  ])
  assert.doesNotThrow(() => assertReviewIntegrity(escaped, parseReview(escaped), new Set(['1'])))
})

test('assertReviewIntegrity refuses a sheet that would import nothing at all', () => {
  // kept 为 0 时旧实现安静地写 0 个文件然后 exit 0：「什么都没发生」和「导入成功」长得一样
  assert.throws(() => check(reviewSheet([{ id: '111', decision: 'drop' }, { id: '222', decision: 'drop' }])), /一条 \[keep\] 都没有/)
  // 一条条目都解析不出来（结构彻底坏掉）同样拦下
  assert.throws(() => check(`${CANDIDATES_END}\n`), /一条 \[keep\] 都没有/)
  // 只要还有一条 keep 就照常放行
  assert.doesNotThrow(() => check(reviewSheet([{ id: '111' }, { id: '222', decision: 'drop' }])))
})

// 把哨兵从原位挪到 locate 指定的行号，模拟人工编辑时的误移动。
function moveSentinel(sheet, locate) {
  const lines = sheet.split('\n').filter((line) => line.trimEnd() !== CANDIDATES_END)
  const at = locate(lines)
  assert.ok(at >= 0 && at <= lines.length, `测试夹具里定位不到插入点（${at}）`)
  lines.splice(at, 0, CANDIDATES_END, '')
  return lines.join('\n')
}

function moveSentinelBefore(sheet, heading) {
  return moveSentinel(sheet, (lines) => {
    const at = lines.findIndex((line) => line.startsWith(heading))
    assert.notEqual(at, -1, `测试夹具里找不到「${heading}」`)
    return at
  })
}

// 文末脚手架那条 `---`：最后一个条目标题行之后的第一条水平线。
function tailRuleIndex(lines) {
  const lastHeading = lines.reduce((last, line, index) => (line.startsWith('### [') ? index : last), -1)
  const at = lines.findIndex((line, index) => index > lastHeading && line.trimEnd() === '---')
  assert.notEqual(at, -1, '测试夹具里找不到文末脚手架的 ---')
  return at
}

// 真实形状的审稿单：两条候选 + 一条短句，于是文末「短句待定」和「归属强制过目」两段脚手架都在。
// 哨兵位置校验防的就是这两段被吞进正文，所以用真的 renderReview 产物，不用简化夹具。
function fullSheet() {
  const block = (id, answer) => ({
    id,
    url: `https://xueqiu.com/1247347556/${id}`,
    date: '2026-08-24',
    question: '',
    answer,
    ai: false,
  })
  const target = { slug: 'wenda-life-03', section: '第一节 甲' }
  return renderReview([
    { block: block('111', '答一。'), target },
    { block: block('222', '答二。'), target },
    { block: block('333', '短句。'), target, short: true },
  ])
}

const FULL_IDS = ['111', '222', '333']

test('assertReviewIntegrity pins the sentinel from both sides, not just from the front', () => {
  const sheet = fullSheet()
  // 前提：这四段脚手架文字都在文末，正常顺序照常放行
  assert.match(sheet, /^## 短句待定/m)
  assert.match(sheet, /^## 归属强制过目/m)
  assert.doesNotThrow(() => check(sheet, FULL_IDS))

  // [a] 挪到所有条目之前：条目全被截断
  const before = moveSentinelBefore(sheet, '### [keep] 111')
  assert.equal(parseReview(before).length, 0)
  assert.throws(() => check(before, FULL_IDS), /条目标题行/)

  // [b] 挪到条目中间：后面的条目无声消失
  const middle = moveSentinelBefore(sheet, '### [keep] 222')
  assert.equal(parseReview(middle).length, 1)
  assert.throws(() => check(middle, FULL_IDS), /条目标题行/)

  // [c] 挪到文件末尾：旧实现只查「哨兵之后不许有标题行」，这里一条都没有，五道校验全过、
  // exit 0，最后一条 body 却把整段脚手架吞了进去，然后写进已发布正文
  const atEnd = moveSentinel(sheet, (lines) => lines.length)
  const swallowed = parseReview(atEnd).at(-1).body
  assert.match(swallowed, /## 短句待定/)
  assert.match(swallowed, /## 归属强制过目/)
  assert.ok(
    swallowed.split('\n').length > parseReview(sheet).at(-1).body.split('\n').length + 5,
    '前提：body 确实被撑大了',
  )
  assert.throws(() => check(atEnd, FULL_IDS), /哨兵/)
  assert.throws(() => check(atEnd, FULL_IDS), /脚手架/)

  // [d] 挪到文末那条 --- 之下：只多吞一行游离的 ---，脚手架标题仍在哨兵之后
  const belowRule = moveSentinel(sheet, (lines) => tailRuleIndex(lines) + 1)
  assert.match(parseReview(belowRule).at(-1).body, /\n---$/)
  assert.throws(() => check(belowRule, FULL_IDS), /哨兵/)
  assert.throws(() => check(belowRule, FULL_IDS), /分隔线/)

  // 脚手架整段被删掉时同样拒绝：没有它就无从判断哨兵是不是被往后挪过
  const headless = sheet.split('\n').filter((line) => !/^## (短句待定|归属强制过目)/.test(line)).join('\n')
  assert.throws(() => check(headless, FULL_IDS), /文末脚手架/)
})

// 把 heading 开头的那一整行标题行删掉，模拟人工审稿时的误删（而不是改成 [drop]）。
function deleteHeading(sheet, heading) {
  const lines = sheet.split('\n')
  const at = lines.findIndex((line) => line.startsWith(heading))
  assert.notEqual(at, -1, `测试夹具里找不到「${heading}」`)
  lines.splice(at, 1)
  return lines.join('\n')
}

test('assertReviewIntegrity refuses a sheet whose entry heading was deleted outright', () => {
  // 删掉一行 `### [keep] …` 标题行是五道校验全看不见的损坏：条目数静默 -1、那条 id 无声消失、
  // 它的正文被接到前一条的 body 尾巴上、它那行 `<!-- 原帖链接 -->` 落在 body 中间被原样写进
  // 已发布正文（isMetadataLine 只剥离紧跟标题行的那一行），输出只是 kept 少一条。
  // 「条目数 vs 标题行数」是同义反复（两个数来自同一次 HEADING_RE 扫描），拦不住这个。
  const sheet = reviewSheet([{ id: '111' }, { id: '222' }])
  const damaged = deleteHeading(sheet, '### [keep] 222 ')
  const parsed = parseReview(damaged)
  assert.equal(parsed.length, 1, '前提：条目数静默 -1')
  assert.match(parsed[0].body, /大道：答222。/, '前提：正文被并进前一条')
  assert.match(parsed[0].body, /^<!-- https:\/\/xueqiu\.com\/1247347556\/222 -->$/m, '前提：来源注释落进正文')

  const strayLine = damaged.split('\n').indexOf('<!-- https://xueqiu.com/1247347556/222 -->') + 1
  const message = messageOf(() => check(damaged))
  assert.match(message, new RegExp(`第 ${strayLine} 行`)) // 点名是哪一行
  assert.match(message, /111/) // 点名被污染的是哪一条
  assert.match(message, /1247347556\/222/) // 顺带带出消失的那条
  assert.match(message, /标题行/) // 说清成因：疑似上一条的标题行被删

  // 第一条的标题行被删同样拦下：它的正文连同来源注释整段落在第一个条目之前，parseReview 直接忽略，
  // 连「并进上一条」都没有 —— 那条就这么凭空没了，而且没有任何提示。
  const first = deleteHeading(sheet, '### [keep] 111 ')
  assert.equal(parseReview(first).length, 1, '前提：第一条静默消失')
  assert.match(messageOf(() => check(first)), /1247347556\/111/)

  // 不误伤：完好的审稿单照常放行，真 renderReview 产物同样放行
  assert.doesNotThrow(() => check(sheet))
  assert.doesNotThrow(() => check(fullSheet(), FULL_IDS))
  // 正文里带转义结构行的真实产物也不该被误判
  const escaped = renderReview([
    {
      block: {
        id: '111',
        url: 'https://xueqiu.com/1247347556/111',
        date: '2026-08-24',
        question: '',
        answer: '一段正文。\n\n### [keep] 9 · a · b\n\n还有一段。',
        ai: false,
      },
      target: { slug: 'wenda-invest-07', section: '第一节 估值逻辑与定性判断' },
    },
  ])
  assert.doesNotThrow(() => assertReviewIntegrity(escaped, parseReview(escaped), new Set(['111'])))
})

import { findStrayUrlComments } from '../scripts/import-xueqiu-qanda.mjs'

test('findStrayUrlComments only counts comments outside the heading metadata window', () => {
  const meta = [
    '### [keep] 111 · wenda-life-03 · 第一节 甲',
    '',
    '> ⚠️靠提问命中：答案正文本身不含本章关键词，归属存疑，请重点复核。',
    '',
    '<!-- https://xueqiu.com/1247347556/111 -->',
    '',
    '大道：答一。（2026-08-24）',
  ]
  // 元数据区里的注释是正常渲染产物：空行和 ⚠️ 标记都不该提前关掉这个窗口
  assert.deepEqual(findStrayUrlComments(meta.join('\n')), [])
  // 同一行落到正文里就是结构坏了，并且要带回行号和所属条目
  assert.deepEqual(
    findStrayUrlComments([...meta, '', '<!-- https://xueqiu.com/1247347556/222 -->', '', '大道：答二。'].join('\n')),
    [{ id: '111', lineNumber: 9, line: '<!-- https://xueqiu.com/1247347556/222 -->' }],
  )
  // 哨兵之后不算：那是文末脚手架，不是正文；哨兵自己的位置另有 ①b/①c 两道校验盯着
  assert.deepEqual(
    findStrayUrlComments([...meta, CANDIDATES_END, '<!-- https://xueqiu.com/1247347556/333 -->'].join('\n')),
    [],
  )
})

import { assertContentClean, assertContentCleanViaGit } from '../scripts/import-xueqiu-qanda.mjs'

test('assertContentClean refuses to apply on top of uncommitted content/ edits', () => {
  // --apply 不幂等且写盘不原子，所以它要求一个「出事能一键回滚」的干净起点
  const dirty = ' M content/dao/qanda/wenda-invest-03.md\n'
  assert.throws(() => assertContentClean(dirty), /未提交改动/)
  assert.throws(() => assertContentClean(dirty), /wenda-invest-03/)
  assert.throws(() => assertContentClean(dirty), /git checkout -- content\//)
  assert.throws(() => assertContentClean(dirty), /--force/)
  // 未跟踪文件同样算脏：git checkout 清不掉它
  assert.throws(() => assertContentClean('?? content/dao/qanda/wenda-new.md\n'), /未提交改动/)
  // 超过 5 处时只列前 5 个，但要报出总数
  const many = Array.from({ length: 27 }, (_, i) => ` M content/dao/qanda/w-${i}.md`).join('\n')
  assert.throws(() => assertContentClean(many), /等共 27 处/)
  // 干净的工作区放行（porcelain 是空串 / 只有空行）
  assert.doesNotThrow(() => assertContentClean(''))
  assert.doesNotThrow(() => assertContentClean('\n'))
  assert.doesNotThrow(() => assertContentClean(undefined))
})

test('assertContentCleanViaGit treats a git failure as a refusal, not as a pass', async () => {
  // 「查不到状态」不等于「工作区干净」：查不出来就拒绝写盘
  await assert.rejects(
    () => assertContentCleanViaGit({ run: async () => { throw new Error('not a git repository') } }),
    /git 状态/,
  )
  await assert.rejects(
    () => assertContentCleanViaGit({ run: async () => { throw new Error('not a git repository') } }),
    /not a git repository/,
  )
  await assert.rejects(
    () => assertContentCleanViaGit({ run: async () => ' M content/dao/qanda/x.md\n' }),
    /未提交改动/,
  )
  await assertContentCleanViaGit({ run: async () => '' })
})

test('assertContentCleanViaGit lets the pathspec guard speak for itself', async () => {
  // pathspec 护栏的报错也落在同一个 catch 里，被包成「查不到 content/ 的 git 状态（…）：…
  // 确认在 git 仓库里运行，或者用 --force 跳过这道检查」。两处都不对：git 明明跑成功了
  //（是护栏自己判定 pathspec 匹配不到已跟踪文件），文案却把排障指向「是不是不在 git 仓库里」；
  // 而且它把 --force 递到手上，可 --force 正是唯一能让这道 fail-closed 护栏变回 fail-open 的开关。
  const run = async () => assertPathspecsTracked(CONTENT_DIRS, '')
  await assert.rejects(() => assertContentCleanViaGit({ run }), /没有任何已跟踪文件/)
  await assert.rejects(() => assertContentCleanViaGit({ run }), (error) => {
    assert.equal(error.message.includes('查不到'), false, `git 跑成功了，不该说成查不到状态：${error.message}`)
    assert.equal(error.message.includes('--force'), false, `护栏自己的报错不该推荐 --force：${error.message}`)
    return true
  })
  // git 自己跑不起来（压根不在 git 仓库里）是另一回事：仍然 fail closed，仍然可以提 --force
  await assert.rejects(
    () => assertContentCleanViaGit({ run: async () => { throw new Error('not a git repository') } }),
    /--force/,
  )
})

test('insertIntoSection leaves existing body bytes alone, trailing spaces included', () => {
  // markdown 的硬换行就是行尾两个空格：`/\s*$/` 会把小节最后一行的行尾空白无声删掉，
  // 而这一步只该新增内容，既有正文必须逐字不变。
  assert.equal(
    insertIntoSection('## 第一节 甲\n\n旧一。   \n\n', '第一节 甲', ['新。']),
    '## 第一节 甲\n\n旧一。   \n\n新。\n',
  )
  // 小节在文件中段时同样不碰既有正文
  assert.equal(
    insertIntoSection('## 第一节 甲\n\n旧一。  \n\n## 第二节 乙\n\n旧二。\n', '第一节 甲', ['新。']),
    '## 第一节 甲\n\n旧一。  \n\n新。\n\n## 第二节 乙\n\n旧二。\n',
  )
  // 新建小节分支同理：文件最后一行的行尾空白不该被吃掉
  assert.equal(
    insertIntoSection('## 第一节 甲\n\n旧一。  \n', '第二节 乙', ['新。']),
    '## 第一节 甲\n\n旧一。  \n\n## 第二节 乙\n\n新。\n',
  )
})

test('insertIntoSection returns the file untouched when there is nothing to insert', () => {
  // 空数组时 addition 是空串，旧实现会多插一个空行和一个结尾换行
  assert.equal(insertIntoSection(CHAPTER, '第一节 甲', []), CHAPTER)
  assert.equal(insertIntoSection(CHAPTER, '第二节 乙', []), CHAPTER)
  // 也不该为一批空内容新建小节
  assert.equal(insertIntoSection(CHAPTER, '第三节 丙', []), CHAPTER)
  // 连节号非法的情况都不必报错：什么都不做就是什么都不做
  assert.equal(insertIntoSection(CHAPTER, '第九节 丁', []), CHAPTER)
})

import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', ...options }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr })
    })
  })
}

// --apply 是这条流水线里唯一会改站点正文的一步，而它出事的方式都在 CLI 接线上
//（参数被吞、护栏没接上），纯函数单测看不见。所以在 /tmp 里搭一个一次性的迷你仓库
// 真跑一遍：scripts/ 原样复制过去，ROOT 就跟着落到沙箱，绝不会碰到真的 content/。
async function makeSandbox({ untrackContent = false } = {}) {
  // realpath：macOS 的 os.tmpdir() 是 /var/folders/…（/var 是 /private/var 的软链），
  // 而 node 会把入口模块解析成真实路径，脚本末尾那句 argv[1] === import.meta.url 就对不上，
  // main() 根本不会执行 —— 表现是「exit 0 且什么都没打印」。
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'xueqiu-apply-')))
  await cp(fileURLToPath(new URL('../scripts/', import.meta.url)), path.join(dir, 'scripts'), { recursive: true })
  await mkdir(path.join(dir, 'content/dao/qanda'), { recursive: true })
  // 每个 content 目录都放一个已跟踪文件：git 不跟踪空目录，而脏工作区检查要求每条 pathspec
  // 都真的匹配到已跟踪文件（匹配不到就 fail closed），空目录会被当成「目录名拼错了」。
  await writeFile(path.join(dir, 'content/dao/qanda/placeholder.md'), '## 第一节 甲\n\n占位。\n', 'utf8')
  const chapter = path.join(dir, 'content/dao/qanda/wenda-life-03.md')
  const original = '---\ntitle: "示例"\n---\n\n## 第一节 甲\n\n大道：原有内容一。（2020-01-01）\n'
  await writeFile(chapter, original, 'utf8')
  await writeFile(path.join(dir, 'raw.json'), '[{"id":"111"}]', 'utf8')
  await writeFile(
    path.join(dir, 'review.md'),
    reviewSheet([{ id: '111', slug: 'wenda-life-03', section: '第一节 甲' }]),
    'utf8',
  )
  // 钉死身份、关掉签名和钩子：沙箱不该受本机全局 git 配置影响
  const git = (...args) => runCommand('git', [
    '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    ...args,
  ], { cwd: dir })
  await git('init', '-q')
  await git('add', '-A')
  const committed = await git('commit', '-qm', 'init')
  assert.equal(committed.code, 0, `沙箱仓库初始提交失败：${committed.stderr}`)
  if (untrackContent) {
    // content/ 一个文件都没被 git 跟踪：pathspec 匹配不到东西，脏工作区检查会恒为「干净」
    await git('rm', '-r', '-q', '--cached', 'content')
    await git('commit', '-qm', 'untrack content')
  }
  // 必须跑沙箱里那份拷贝：脚本的 ROOT 是按自己的文件位置算的，
  // 跑仓库里的原件 ROOT 就落回真仓库，--apply 会改到真的 content/。
  const script = path.join(dir, 'scripts/import-xueqiu-qanda.mjs')
  return { dir, chapter, original, git, apply: (...args) => runCommand(process.execPath, [script, ...args], { cwd: dir }) }
}

test('the --apply CLI refuses every way of losing the guards, and only writes on a clean tree', async () => {
  const box = await makeSandbox()
  const read = () => readFile(box.chapter, 'utf8')
  const count = (text) => text.split('大道：答111。（2026-08-24）').length - 1
  try {
    // ① --dry-run 不写盘
    const dry = await box.apply('--apply', '--in=review.md', '--raw=raw.json', '--dry-run')
    assert.equal(dry.code, 0, dry.stderr)
    assert.match(dry.stdout, /"kept": 1/)
    assert.equal(await read(), box.original, '--dry-run 不该改文件')

    // ② Critical：带值的 --apply 会吞掉后面的 --dry-run。这一条在旧实现里就是真写盘。
    const swallowed = await box.apply('--apply=false --dry-run', '--in=review.md', '--raw=raw.json')
    assert.equal(swallowed.code, 1)
    assert.match(swallowed.stderr, /--apply 是开关，不接受值/)
    assert.equal(await read(), box.original, '--apply=false 绝不能写盘')

    // ③ content/ 脏的时候拒绝写盘：没有干净起点就没法一键回滚
    await writeFile(box.chapter, `${box.original}\n人工加的一行。\n`, 'utf8')
    const dirtyRun = await box.apply('--apply', '--in=review.md', '--raw=raw.json')
    assert.equal(dirtyRun.code, 1)
    assert.match(dirtyRun.stderr, /content\/ 有未提交改动/)
    assert.match(dirtyRun.stderr, /wenda-life-03/)
    // Minor：报错只打印人话，不带堆栈
    assert.equal(/^\s+at /m.test(dirtyRun.stderr), false, `不该打印堆栈：\n${dirtyRun.stderr}`)
    assert.equal(count(await read()), 0, '被护栏拦下时不该写入任何内容')

    // ④ 恢复干净后才真的写入，且只写一遍
    await writeFile(box.chapter, box.original, 'utf8')
    const applied = await box.apply('--apply', '--in=review.md', '--raw=raw.json')
    assert.equal(applied.code, 0, applied.stderr)
    assert.match(applied.stdout, /"kept": 1/)
    const after = await read()
    assert.equal(count(after), 1)
    assert.equal(after.startsWith(box.original.replace(/\n$/, '')), true, '既有正文必须逐字保留')
    assert.equal(after.endsWith('大道：答111。（2026-08-24）\n'), true)

    // ⑤ 重跑会重复插入，而这正是护栏挡下的事：刚写完的 content/ 是脏的，第二遍被拒绝
    const rerun = await box.apply('--apply', '--in=review.md', '--raw=raw.json')
    assert.equal(rerun.code, 1)
    assert.match(rerun.stderr, /不幂等/)
    assert.equal(count(await read()), 1, '重跑不该在脏工作区上再插一遍')

    // ⑥ --force 是明示的逃生口：跳过检查，于是确实插了第二遍（说明护栏拦对了）
    const forced = await box.apply('--apply', '--in=review.md', '--raw=raw.json', '--force')
    assert.equal(forced.code, 0, forced.stderr)
    assert.match(forced.stdout, /"force": true/)
    assert.equal(count(await read()), 2)

    // ⑦ 其它错误也只打印 message：不带堆栈、不带 errno 之类的属性
    const missing = await box.apply('--apply', '--in=不存在的审稿单.md', '--raw=raw.json', '--dry-run')
    assert.equal(missing.code, 1)
    assert.match(missing.stderr, /ENOENT/)
    assert.equal(/^\s+at /m.test(missing.stderr), false)
    assert.equal(missing.stderr.includes('errno'), false)
  } finally {
    await rm(box.dir, { recursive: true, force: true })
  }
})

test('the --apply CLI sees untracked content/ files even when git config hides them', async () => {
  // `status.showUntrackedFiles=no` 是仓库/全局里随手设过就会一直生效的配置：
  // 未跟踪的 content/ 文件在 porcelain 输出里完全消失，护栏当成干净的直接放行然后真写盘。
  const box = await makeSandbox()
  try {
    await box.git('config', 'status.showUntrackedFiles', 'no')
    await writeFile(path.join(box.dir, 'content/dao/qanda/wenda-new.md'), '半成品，还没提交。\n', 'utf8')
    // 前提：这个配置确实把未跟踪文件藏了起来（不加显式覆盖时护栏什么都看不见）
    const hidden = await box.git('status', '--porcelain', '--', 'content/dao/qanda')
    assert.equal(hidden.stdout.trim(), '', `前提不成立，未跟踪文件没被藏起来：\n${hidden.stdout}`)

    const run = await box.apply('--apply', '--in=review.md', '--raw=raw.json')
    assert.equal(run.code, 1, `不该放行：\n${run.stdout}`)
    assert.match(run.stderr, /content\/ 有未提交改动/)
    assert.match(run.stderr, /wenda-new/)
    assert.equal(await readFile(box.chapter, 'utf8'), box.original, '被护栏拦下时不该写入任何内容')
  } finally {
    await rm(box.dir, { recursive: true, force: true })
  }
})

test('the --apply CLI refuses when the content/ pathspec matches nothing tracked', async () => {
  // git 对匹配不到任何东西的 pathspec 是 exit 0 + 空输出：目录名一拼错，护栏就静默退化成
  // 「恒为干净」永远放行。fail closed —— 匹配不到就报错退出，不写盘。
  const box = await makeSandbox({ untrackContent: true })
  try {
    const run = await box.apply('--apply', '--in=review.md', '--raw=raw.json')
    assert.equal(run.code, 1, `不该放行：\n${run.stdout}`)
    assert.match(run.stderr, /没有任何已跟踪文件/)
    assert.match(run.stderr, /content\/dao\/qanda/)
    assert.equal(/^\s+at /m.test(run.stderr), false, `不该打印堆栈：\n${run.stderr}`)
    // git 跑成功了，报错不该说成「查不到状态」，更不该把绕开自己的 --force 递到手上
    assert.equal(run.stderr.includes('查不到'), false, `不该说成查不到 git 状态：\n${run.stderr}`)
    assert.equal(run.stderr.includes('--force'), false, `护栏自己的报错不该推荐 --force：\n${run.stderr}`)
    assert.equal(await readFile(box.chapter, 'utf8'), box.original, '被护栏拦下时不该写入任何内容')
    // --dry-run 不碰这道护栏（它本来就不写盘），照常跑完
    const dry = await box.apply('--apply', '--in=review.md', '--raw=raw.json', '--dry-run')
    assert.equal(dry.code, 0, dry.stderr)
    assert.match(dry.stdout, /"kept": 1/)
  } finally {
    await rm(box.dir, { recursive: true, force: true })
  }
})

test('the --apply CLI refuses a sheet with a deleted heading, --dry-run included', async () => {
  // 这道校验必须和其它几道同口径：跑在任何写盘之前，而且 --dry-run 也照跑 —— --dry-run 正是
  // 审稿人验收这份审稿单的方式，它要是放行了，人就会带着「验过了」的印象直接去跑真的 --apply。
  const box = await makeSandbox()
  try {
    const target = { slug: 'wenda-life-03', section: '第一节 甲' }
    const damaged = deleteHeading(
      reviewSheet([{ id: '111', ...target }, { id: '222', ...target }]),
      '### [keep] 222 ',
    )
    await writeFile(path.join(box.dir, 'raw.json'), '[{"id":"111"},{"id":"222"}]', 'utf8')
    await writeFile(path.join(box.dir, 'review.md'), damaged, 'utf8')

    for (const extra of [['--dry-run'], []]) {
      const label = extra.join(' ') || '真写盘'
      const run = await box.apply('--apply', '--in=review.md', '--raw=raw.json', ...extra)
      assert.equal(run.code, 1, `不该放行（${label}）：\n${run.stdout}`)
      assert.match(run.stderr, /来源链接注释落在条目正文里/)
      assert.match(run.stderr, /1247347556\/222/) // 点名消失的是哪一条
      assert.match(run.stderr, /标题行被整行删掉/) // 说清成因
      assert.equal(/^\s+at /m.test(run.stderr), false, `不该打印堆栈：\n${run.stderr}`)
      assert.equal(await readFile(box.chapter, 'utf8'), box.original, `被拦下时不该写盘（${label}）`)
    }
  } finally {
    await rm(box.dir, { recursive: true, force: true })
  }
})
