const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

// 雪球接口实际吐的是数字实体（抓取样本里 &#34; 出现 221 次、&quot; 0 次），
// 所以命名实体与数字实体（十进制 &#34; / 十六进制 &#x27;）必须在同一趟里解，
// 否则先解出的 & 会把后面的 &#34; 二次解码。
const ENTITY_PATTERN = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,9}));/g

// 已知会被段永平引用/转述的模型名。只在「署名位」上使用，见 AI_SIGNATURE_MARKERS。
const AI_MODEL_NAMES = 'Gemini|ChatGPT|GPT-?\\d[\\w.]*|Grok|DeepSeek|Claude|Kimi|Qwen|豆包|文心一言|通义千问|通义|元宝|千问'

// 「AI」是两个字母的词，而这些正则整体大小写不敏感，裸写 `AI` 会命中任何含 ai 的
// 英文词：Airbnb / Aimee / Shanghai 都曾把段永平本人的话（`我问了一下Airbnb的客服。`）
// 误判成 AI 转述。所以只认带词边界的 AI。
const AI_GENERIC = '(?:(?<![A-Za-z])AI(?![A-Za-z])|人工智能|大模型)'
// 转述声明里的通配段不能跨过否定词，否则 `以上不是AI写的，是我自己写的`
//（段永平在明确撇清 AI）会被判成 AI 转述。
const NON_NEGATED_GAP = '[^。\\n不没未非无]{0,6}'

// 归属判定（不可妥协：段本人的话不能署成「大道（转AI回答）：」）。
// 只认署名位，不认全文关键词 —— 段永平讨论 Gemini / DeepSeek 这些产品本身是高频话题，
// 全文关键词在真实数据上把「那Gemini那个解释就是乱讲的了」之类本人发言误判成了 AI 转述。
const AI_SIGNATURE_MARKERS = [
  // 行首「模型名：」（可带一个括注），例：`Gemini：（ai有时候可能乱讲的）`
  new RegExp(`^[\\s>*_]{0,4}(?:${AI_MODEL_NAMES})\\s*(?:[（(][^）)\\n]{0,24}[）)])?\\s*[:：]`, 'im'),
  // 行首「模型名的回答/答案/回复」，例：`Gemini的回答，仅供参考`
  new RegExp(`^[\\s>*_]{0,4}(?:${AI_MODEL_NAMES})\\s*的?(?:回答|答案|回复|原话)`, 'im'),
  // 文末破折号署名，例：`———Gemini` / `——豆包`
  new RegExp(`[—–\\-]{2,}\\s*(?:${AI_MODEL_NAMES})\\s*$`, 'im'),
  // 明确的自述：`我问了一下AI` / `问了下豆包`。必须带「了」——
  // 段永平劝网友「问问ai」「你可以问ai的」「让Ai帮着整理」是他本人的话，不能算转述。
  new RegExp(`(?:问|请教)\\s*了\\s*(?:一下|下)?\\s*(?:${AI_GENERIC}|${AI_MODEL_NAMES})`, 'i'),
  new RegExp(`我(?:们)?\\s*让\\s*(?:${AI_GENERIC}|${AI_MODEL_NAMES})`, 'i'),
  // 明确的转述声明，例：`以上是AI的回答` / `以下来自Gemini`
  new RegExp(
    `(?:以上|上面|以下|下面)${NON_NEGATED_GAP}(?:是|来自|摘自|转自|引自)${NON_NEGATED_GAP}(?:${AI_GENERIC}|${AI_MODEL_NAMES})`,
    'i',
  ),
  // 转述引导语，例：`AI的回答如下：`
  new RegExp(`${AI_GENERIC}\\s*的?(?:回答|答案|原话)\\s*(?:如下\\s*)?[:：]`, 'i'),
]

// 「模型名独占一行」。这条是 post 406251826（第 2 行独占 `Gemini`，其后整段是 AI 正文）
// 和 post 402166573（末行独占 `Gemini`）的唯一命中路径，不能删；但在全文任意位置生效时，
// 它会把「我常用的是：\n豆包\n元宝\n这两个」这类模型清单误判成 AI 转述。
// 所以加两道限制：(1) 只认正文头尾各 2 行 —— 署名要么在引文前，要么在引文后；
// (2) 相邻行也是模型名时视为「在列举模型」，不算署名。
const AI_SIGNATURE_EDGE_LINES = 2
const AI_MODEL_LINE = new RegExp(
  `^[\\s>*_]{0,4}(?:${AI_MODEL_NAMES})\\s*(?:[（(][^）)\\n]{0,24}[）)])?\\s*$`,
  'i',
)

function hasModelSignatureLine(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  return lines.some((line, index) => {
    if (!AI_MODEL_LINE.test(line)) return false
    if (AI_MODEL_LINE.test(lines[index - 1] || '') || AI_MODEL_LINE.test(lines[index + 1] || '')) {
      return false
    }
    return index < AI_SIGNATURE_EDGE_LINES || index >= lines.length - AI_SIGNATURE_EDGE_LINES
  })
}

// 去重键长度：取归一化后回答的前 24 个字符做前缀匹配。
// 24 是在既有语料的 564 条「大道：」回答上标定的 —— 473 个不同键、仅 2 例碰撞，
// 且那 2 例本身就是语料里重复收录的同一段话。
const DEDUPE_KEY_LENGTH = 24
// 归一化（剥标点）后不足 20 字的回答区分度太低，宁可放弃去重也不误判为「已发布」。
const DEDUPE_MIN_KEY_LENGTH = 20
// 雪球昵称长度上限（与 stripReplyPrefix 的 @[^\s:：]{1,40} 同口径），
// 用于限定 `//@昵称:` 里冒号的搜索范围，避免一路吃到正文里的 `https:`。
const MAX_NICKNAME_LENGTH = 40

function decodeEntities(text) {
  return text.replace(ENTITY_PATTERN, (match, dec, hex, name) => {
    if (dec !== undefined) return safeFromCodePoint(Number.parseInt(dec, 10), match)
    if (hex !== undefined) return safeFromCodePoint(Number.parseInt(hex, 16), match)
    const named = ENTITIES[`&${name.toLowerCase()};`]
    return named === undefined ? match : named
  })
}

function safeFromCodePoint(code, fallback) {
  if (!Number.isInteger(code) || code < 0x20 || code > 0x10ffff) return fallback
  try {
    return String.fromCodePoint(code)
  } catch {
    return fallback
  }
}

export function stripHtml(html) {
  if (!html) return ''
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeCashtags(text) {
  return String(text || '')
    .replace(/\$([^$\n]{1,24}?)[（(][^）)\n]{1,12}[）)]\$/g, '$1')
    // cashtag 必以字母或中文开头（$泡泡玛特$ / $BRK.B$）；
    // 两个 $ 之间以数字/符号开头的是美元金额（$89.70至$107），不能吃掉。
    .replace(/\$([A-Za-z㐀-䶿一-鿿][^$\n\s]{0,23})\$/g, '$1')
}

function stripReplyPrefix(text) {
  return String(text || '')
    .replace(/^\s*回复\s*@[^\s:：]{1,40}\s*[:：]\s*/, '')
    .replace(/@大道无形我有型/g, '')
    .trim()
}

export function splitReplyChain(text) {
  const source = String(text || '')
  const marker = source.indexOf('//@')
  const answer = stripReplyPrefix(marker >= 0 ? source.slice(0, marker) : source)
  if (marker < 0) return { answer, question: '' }

  let rest = source.slice(marker + 3)
  // 只在「昵称 + 冒号」这个位置上剥前缀；昵称里不含空白与冒号，长度上限 40。
  // 匹配不到就把整段当问题，绝不越过正文去找第一个冒号。
  const nickname = rest.match(new RegExp(`^([^\\s:：]{1,${MAX_NICKNAME_LENGTH}})\\s*[:：]`))
  if (nickname) rest = rest.slice(nickname[0].length)
  const next = rest.indexOf('//@')
  if (next >= 0) rest = rest.slice(0, next)
  return { answer, question: stripReplyPrefix(rest) }
}

export function formatDate(ms) {
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function isAiRepost(answer) {
  const text = String(answer || '')
  return AI_SIGNATURE_MARKERS.some((marker) => marker.test(text)) || hasModelSignatureLine(text)
}

export function visibleLength(text) {
  return Array.from(String(text || '').replace(/\s+/g, '')).length
}

export function extractBlock(post) {
  if (!post || typeof post !== 'object') throw new TypeError('extractBlock: post must be an object')
  if (post.id === undefined || post.id === null || post.id === '') {
    throw new TypeError('extractBlock: post.id is required')
  }
  if (post.user_id === undefined || post.user_id === null || post.user_id === '') {
    throw new TypeError(`extractBlock: post.user_id is required (post ${post.id})`)
  }
  // 必须先判类型：Number(null) === 0 且 Number.isFinite(0) 为真，
  // 所以 null / '' / [] / false 曾全部通过校验，静默产出 date: '1970-01-01'。
  if (typeof post.created_at !== 'number' || !Number.isFinite(post.created_at)) {
    throw new TypeError(`extractBlock: post.created_at must be an epoch-ms number (post ${post.id})`)
  }

  const full = stripHtml(post.text) || stripHtml(post.description)
  const { answer, question } = splitReplyChain(full)
  const quoted = post.retweeted_status
    ? stripHtml(post.retweeted_status.text || post.retweeted_status.description)
    : ''
  // 转发原帖同样要走一次回复链拆解：砍掉它自己的 //@ 链，并剥掉
  // `回复@某某:` 前缀与 `@大道无形我有型` 提及，否则这些前缀会直接进「网友：」行。
  const quotedQuestion = quoted ? splitReplyChain(quoted).answer : ''
  return {
    id: String(post.id),
    url: `https://xueqiu.com/${post.user_id}/${post.id}`,
    date: formatDate(Number(post.created_at)),
    question: normalizeCashtags(question || quotedQuestion),
    answer: normalizeCashtags(answer),
    ai: isAiRepost(answer),
  }
}

export function isSubstantive(block, { minLength = 30, keepIds = [] } = {}) {
  if (keepIds.includes(block.id)) return true
  return visibleLength(block.answer) >= minLength
}

export function normalizeForMatch(text) {
  return String(text || '')
    .replace(/[\s*_`>#、，。！？：；“”"'（）()【】\[\]\-—…]/g, '')
    .toLowerCase()
}

// normalizeForMatch 是幂等的，但对整份语料重复归一化很浪费；缓存最近一次结果。
let lastCorpusInput = null
let lastCorpusNormalized = ''

function normalizeCorpus(corpus) {
  const source = String(corpus || '')
  if (source === lastCorpusInput) return lastCorpusNormalized
  lastCorpusInput = source
  lastCorpusNormalized = normalizeForMatch(source)
  return lastCorpusNormalized
}

export function isAlreadyPublished(block, corpus) {
  const key = normalizeForMatch(block.answer).slice(0, DEDUPE_KEY_LENGTH)
  if (key.length < DEDUPE_MIN_KEY_LENGTH) return false
  // 语料在函数内部归一化，调用方传原始 markdown 也能正确去重
  // （此前要求调用方自己先归一化，忘了就静默全部返回 false，表现为「一条都没去重」）。
  return normalizeCorpus(corpus).includes(key)
}

export function renderBlock(block) {
  const speaker = block.ai ? '大道（转AI回答）：' : '大道：'
  const answer = `${speaker}${block.answer}（${block.date}）`
  return block.question ? `网友：${block.question}\n\n${answer}` : answer
}
