#!/usr/bin/env node

// 雪球问答导入流水线第三步与第四步：
//   --review 把清洗+分类后的问答块渲染成人工审稿文件（只写 docs/content-audits/，永远不碰 content/）；
//   --apply  把人工审校后仍标 [keep] 的块写回 content/dao/** 对应章节的对应小节。
//
// 审稿文件是这条流水线的质量闸门：编辑在上面改 keep/drop、改章节归属、润色正文，
// --apply 再据此写回正文。--apply 是唯一会改站点正文的一步，所以写盘前先把整份审稿文件
// 验一遍（见 assertReviewIntegrity），并要求 content/ 工作区是干净的（见 assertContentCleanViaGit），
// 任一条不过就整批拒绝导入 —— 宁可报错退出，也不要静默写坏正文。

import { execFile } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  extractBlock,
  isAlreadyPublished,
  isSubstantive,
  normalizeForMatch,
  renderBlock,
  visibleLength,
} from './xueqiu-import-lib.mjs'
import { classifyBlock } from './xueqiu-import-classify.mjs'
import { chineseNumber } from './qanda-cleaning-generate-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CONTENT_DIRS = ['content/dao/qanda']

// 标题行契约（Task 5 也会按这个格式解析，改动会连累下游）：
//   ### [keep|drop] <帖子id> · <章节slug> · <节标题>
// 节标题是行尾的贪婪组，所以任何附加标记都不能挂在标题行上，否则会被吃进 section。
const HEADING_RE = /^### \[(keep|drop)\] (\d+) · (\S+) · (.+)$/
// 条目正文里只要出现「形似标题行」就会被解析成新条目，所以渲染时转义、解析时还原。
const HEADING_PREFIX_RE = /^### \[(?:keep|drop)\] /
const URL_COMMENT_LINE_RE = /^<!-- \S+ -->$/

// 候选区终止哨兵。条目正文只在「下一个标题行」或这一行处终止 ——
// 早先用 `line === '---' || line.startsWith('## ')` 当终止符，正文里随手敲的一行
// `---` 或 `## 小标题` 会让其后正文被静默丢弃，而这份文件的用途正是给人手改。
export const CANDIDATES_END = '<!-- END-OF-CANDIDATES -->'

// 文末脚手架：候选区之后那两段（短句待定 / 归属强制过目）和它们前面的 `---` 分隔线。
// 渲染和校验共用同一份标题常量，改文案不会让哨兵位置校验静默失灵；只按 `## <标题>` 前缀
// 匹配，因为括号里的说明是人工可改的（真实审稿单上就被改短过）。
const SHORT_HEADING = '短句待定'
const ATTRIBUTION_HEADING = '归属强制过目'
const TAIL_HEADING_RE = new RegExp(`^##\\s+(?:${SHORT_HEADING}|${ATTRIBUTION_HEADING})`)
const TAIL_RULE = '---'

// 「靠提问命中」标记：单独占一行的引用块，扫一眼就能看到，且解析时整行剥掉。
const QUESTION_MATCH_LABEL = '⚠️靠提问命中'
const QUESTION_MATCH_FLAG = `> ${QUESTION_MATCH_LABEL}：答案正文本身不含本章关键词，归属存疑，请重点复核。`
const FLAG_LINE_RE = /^> ⚠️/

// 未命中分类时的占位；--apply 遇到 UNSORTED 会报错退出，逼迫人工处理。
const UNSORTED = { slug: 'UNSORTED', section: '待人工归类' }

// 归属复核区的正文摘要长度（只列指向，不重复正文）。
const EXCERPT_LENGTH = 40

// 疑似漏判 AI 转帖的信号 ①：模型检索输出的引文标记，形如 `[cs +1]` / `[udn +2]` /
// `[finance.sina +4]`。真实假阴性样本 post 383156505、383561950 就是靠它露馅的。
// 必须是非全局正则：带 /g 的正则用 .test() 会因为 lastIndex 残留而隔条漏判。
const CITATION_MARKER_RE = /\[[A-Za-z0-9一-鿿][\w.一-鿿-]{0,23}\s\+\d{1,3}\]/

// 疑似漏判 AI 转帖的信号 ②：又长又分条罗列。阈值在本批 413 条上标定：
// 300 字 + 3 条命中 7 条，其中 6 条本来就已判 AI，只多出 post 404455718
// （带 markdown 表格的门店转化率长文，确系漏判）。200~400 字 / 2~4 条区间内结果相同。
const AI_LISTICLE_MIN_LENGTH = 300
const AI_LISTICLE_MIN_BULLETS = 3
const BULLET_LINE_RE = /^\s*(?:[•·▪◦*\-—]\s|\d{1,2}\s*[.、)）]\s?|[（(]\d{1,2}[）)]|[①-⑩]|第[一二三四五六七八九十]\s*[、.]|\*\*[^*]{1,40}\*\*[:：]?\s*$)/

// 人工确认要收录的短句（<30 字），在 Task 4 审稿时补充。
// 2026-08-24 批 Pass B：61 条短句里挑回 29 条（含控制者复核的增删）。这批是手工粘进审稿单候选区的
// （runReview 是整份重渲染、不做合并，重跑会冲掉人工审校），所以下面这份名单
// 在本批只是备查记录：用于复现本批取舍、以及让下一批维护者看得见挑了什么。
export const KEEP_SHORT_IDS = [
  '406249637', // 我对什么时候这种事情从来都不擅长的
  '406801409', // 供应链是否复杂和产品有没有实用功能没关系
  '406801412', // 你觉得到期后的风险是什么？艺术家不肯续签了？
  '406805820', // 我知道泡泡的供应链其实也蛮复杂的，但不了解安踏
  '406806164', // 这样讲很不公平，大部分人到期时还是还了的
  '406806302', // 我觉得不续签是小概率事件（labubu 版权串的必收条目）
  '406831350', // 你看看我之前说过的东西，先看个一两年？
  '406853509', // Premium 下降了很多，投机的人少了
  '406871565', // 我能理解你为什么理解不了我
  '406875038', // 啥叫有可能？太有可能了哈
  '406876207', // 为什么需要证明任何东西？是自己不够喜欢吗？
  '406882175', // 那你读书显然是不够的？
  '407068815', // 茅台把自己买回来大概13-15年？
  '407073026', // 会不会游戏的基因不够强大？
  '407073464', // 抽中隐藏款的概率是1/144，你对概率的理解可能有点误会？
  '407190168', // 没看完这个的人们最好看几遍再问问题
  '407214311', // 没人能回答这个问题，因为变量很多啊
  '407219742', // 扫地僧不需要像人类的吧？
  '407221916', // 我从来没出过书，哪来的新书？
  '407285539', // 我看不懂他们的债务和体外循环，不懂不碰就好
  '407330154', // 怎么感觉有点在给自己壮胆的味道呢？
  '407491721', // 要避免的办法很简单，就是不碰
  '407654968', // 我很喜欢他，我觉得他应该会是一个很好的CEO
  '407708738', // 我不懂音乐（网易云音乐怎么突围）
  '407719942', // 乔布斯比你还伤感，历史的规律不可抗拒
  '407728338', // 你得先有钱才能明白你在说什么
  '407729661', // 你要自己都不知道怎么选，别人说啥也不会帮到你的
  '407815536', // 步步高座机现在每年还有一些量呢
  '407815855', // 你看不见是因为你心里没有
]

export function hasCitationMarkers(text) {
  return CITATION_MARKER_RE.test(String(text || ''))
}

export function looksLikeAiListicle(text) {
  const source = String(text || '')
  if (visibleLength(source) < AI_LISTICLE_MIN_LENGTH) return false
  const bullets = source.split('\n').filter((line) => BULLET_LINE_RE.test(line)).length
  return bullets >= AI_LISTICLE_MIN_BULLETS
}

// isAiRepost 是启发式，已知有假阴性。这里补两条独立信号，专门捞「仍署着『大道：』
// 但其实是模型输出」的块；已经判为 AI 的不重复列（它们进复核区的第一组）。
export function isSuspectedAiRepost(block) {
  if (block.ai) return false
  return hasCitationMarkers(block.answer) || looksLikeAiListicle(block.answer)
}

function oneLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function excerpt(text) {
  const chars = Array.from(oneLine(text))
  return chars.length <= EXCERPT_LENGTH
    ? chars.join('')
    : `${chars.slice(0, EXCERPT_LENGTH).join('')}…`
}

function signalsOf(block) {
  const signals = []
  if (hasCitationMarkers(block.answer)) signals.push('引文标记')
  if (looksLikeAiListicle(block.answer)) signals.push('分条长文')
  return signals.join('、')
}

export function renderReview(entries) {
  const short = entries.filter((entry) => entry.short)
  const main = entries.filter((entry) => !entry.short)
  const flagged = main.filter((entry) => entry.target.answerMatched === false)
  const aiTagged = entries.filter((entry) => entry.block.ai)
  const aiSuspected = entries.filter((entry) => isSuspectedAiRepost(entry.block))
  const lines = [
    `# 雪球 ${BATCH.label} 导入待审稿`,
    '',
    `- 候选 ${main.length} 条，另有 ${short.length} 条短句待定`,
    '- 编辑方式：把 `[keep]` 改成 `[drop]` 丢弃；改标题行的章节 slug / 节标题调整归属；正文可直接润色',
    '- `UNSORTED` 必须人工改成真实章节，否则 `--apply` 会报错退出',
    '- 署名已按 AI 判定渲染；若发现误判，直接改正文里的 `大道：` / `大道（转AI回答）：`',
    `- 其中 ${flagged.length} 条带 ${QUESTION_MATCH_LABEL} 标记：分类只靠提问命中，答案本身不含本章关键词，归属高危`,
    `- 文末「归属强制过目」列出 ${aiTagged.length} 条已判 AI 转帖 + ${aiSuspected.length} 条疑似漏判，必须逐条点开原帖确认`,
    `- 候选区到 \`${CANDIDATES_END}\` 为止（这行别删）；正文里可以随便写 \`---\` / \`## 小标题\`，`
      + '但别新起 `### [keep] …` 行，那会被当成新条目',
    '',
  ]
  for (const entry of main) lines.push(...renderEntry(entry))
  lines.push(CANDIDATES_END, '')
  if (short.length) {
    lines.push(TAIL_RULE, '', `## ${SHORT_HEADING}（默认不收录，需要时把 id 加入 KEEP_SHORT_IDS 后重跑 --review）`, '')
    for (const entry of short) {
      lines.push(`- \`${entry.block.id}\` ${entry.block.date} ${oneLine(entry.block.answer)}`)
    }
    lines.push('')
  }
  lines.push(...renderAttribution(aiTagged, aiSuspected))
  return `${lines.join('\n')}\n`
}

function renderEntry(entry) {
  const lines = [`### [keep] ${entry.block.id} · ${entry.target.slug} · ${entry.target.section}`, '']
  if (entry.target.answerMatched === false) lines.push(QUESTION_MATCH_FLAG, '')
  lines.push(`<!-- ${entry.block.url} -->`, '', escapeBody(renderBlock(entry.block)), '')
  return lines
}

// 正文里出现「标题行」或哨兵会让结构解析错位。它们在真实数据里一条都没有，
// 但一旦出现就是静默丢正文，所以渲染时前缀一个反斜杠转义，parseReview 再脱掉一层。
// 哨兵这里必须和 parseReview 的终止判定同口径（都 trimEnd 后比较）：一边严格 ===、
// 一边 trimEnd()，正文里一行「哨兵 + 尾随空格」就会漏转义却照样触发 break，尾巴无声消失。
function isStructuralLine(line) {
  const bare = line.replace(/^\\+/, '')
  return HEADING_PREFIX_RE.test(bare) || bare.trimEnd() === CANDIDATES_END
}

function escapeBody(text) {
  return text.split('\n').map((line) => (isStructuralLine(line) ? `\\${line}` : line)).join('\n')
}

function unescapeBody(lines) {
  return lines.map((line) => (line.startsWith('\\') && isStructuralLine(line) ? line.slice(1) : line))
}

// 归属误标（把段永平本人的话署成「大道（转AI回答）：」，或反过来）是本站不可接受的
// 错误，所以不管分类结果如何，这两类块都单独列一遍，强制人工过目。
function renderAttribution(aiTagged, aiSuspected) {
  const lines = [
    TAIL_RULE,
    '',
    `## ${ATTRIBUTION_HEADING}（署名错了就是硬伤，逐条点开原帖确认）`,
    '',
    `### 一、已判为 AI 转帖，正文署「大道（转AI回答）：」，共 ${aiTagged.length} 条`,
    '',
    '混合帖（段永平自己先说一句，再粘贴模型长文）会被整块署成「大道（转AI回答）：」，'
      + '连段本人那句也算进 AI；遇到这种必须人工拆成两块，或者把署名降级回「大道：」。',
    '',
  ]
  lines.push(...renderAttributionList(aiTagged, false))
  lines.push(
    '',
    `### 二、疑似漏判的 AI 转帖，正文仍署「大道：」，共 ${aiSuspected.length} 条`,
    '',
    '判定信号：① 答案含 `[来源 +数字]` 形式的检索引文标记；'
      + `② 答案 ≥${AI_LISTICLE_MIN_LENGTH} 字且分条罗列 ≥${AI_LISTICLE_MIN_BULLETS} 条。命中任一即列出。`,
    '',
  )
  lines.push(...renderAttributionList(aiSuspected, true))
  lines.push('')
  return lines
}

function renderAttributionList(entries, withSignals) {
  if (!entries.length) return ['- （无）']
  return entries.map((entry) => {
    const signals = withSignals ? `信号：${signalsOf(entry.block)} · ` : ''
    return `- \`${entry.block.id}\` ${entry.block.date} · ${signals}${excerpt(entry.block.answer)} · ${entry.block.url}`
  })
}

// 条目只在三处终止：下一个标题行、候选区哨兵、文件结束。除此之外的每一行都是正文，
// 逐字保留 —— 编辑在正文里写什么都不会让后半段无声消失。
export function parseReview(markdown) {
  const lines = String(markdown).split('\n')
  const entries = []
  let current = null
  for (const line of lines) {
    if (line.trimEnd() === CANDIDATES_END) break
    const match = HEADING_RE.exec(line)
    if (match) {
      if (current) entries.push(finishEntry(current))
      current = {
        decision: match[1],
        id: match[2],
        slug: match[3],
        section: match[4].trim(),
        body: [],
        inMeta: true,
      }
      continue
    }
    if (!current) continue
    // 元数据（空行 / ⚠️ 标记 / 来源链接注释）只在紧跟标题行的位置剥除；
    // 一旦进入正文，同形的行就是正文的一部分，不再动它。
    if (current.inMeta && isMetadataLine(line)) continue
    current.inMeta = false
    current.body.push(line)
  }
  if (current) entries.push(finishEntry(current))
  return entries
}

function isMetadataLine(line) {
  return line.trim() === '' || FLAG_LINE_RE.test(line) || URL_COMMENT_LINE_RE.test(line)
}

// 跨批次去重：上一批判了 [keep] 的帖子已经写进正文了，本批再导一遍就是重复内容。
// 为什么不能只靠 isAlreadyPublished（正文子串匹配）：入库后经人工改写措辞的条目
// 匹配不上——本批的 406251826 就是这么漏的。帖子 id 不会变，按 id 判才管得住。
// [drop] 的不收进来：那是「上批没收」，本批还可以重新判断，跳过等于永久丢内容。
export function collectKeptIds(markdown) {
  const ids = new Set()
  for (const line of markdown.split('\n')) {
    const match = HEADING_RE.exec(line)
    if (match && match[1] === 'keep') ids.add(match[2])
  }
  return ids
}

// 找出落在条目正文里的来源链接注释。渲染时 `<!-- 原帖链接 -->` 只出现在标题行正下方的元数据区，
// 正文（renderBlock 的产物）里一行都没有，所以「正文中间出现一行 `<!-- … -->`」是个可用的不变量：
// 它只可能来自「某条的标题行被整行删掉」。扫描口径跟 parseReview 逐条对齐（同一个哨兵终止条件、
// 同一个 HEADING_RE、同一个 isMetadataLine 剥离窗口），只是多记一个行号用于报错。
// 第一个标题行之前的区域也要扫：删掉的要是第一条的标题行，它的正文连同注释会整段落在那里，
// parseReview 直接忽略，那一条连「被并进上一条」都没有，就这么凭空消失。
export function findStrayUrlComments(markdown) {
  const stray = []
  let current = null
  let inMeta = false
  for (const [index, line] of String(markdown).split('\n').entries()) {
    if (line.trimEnd() === CANDIDATES_END) break
    const match = HEADING_RE.exec(line)
    if (match) {
      current = match[2]
      inMeta = true
      continue
    }
    if (inMeta && isMetadataLine(line)) continue
    inMeta = false
    // trimEnd：带尾随空格的注释行连 isMetadataLine 都不认，会一路进正文，更该拦。
    if (URL_COMMENT_LINE_RE.test(line.trimEnd())) {
      stray.push({ id: current, lineNumber: index + 1, line: line.trim() })
    }
  }
  return stray
}

function finishEntry(entry) {
  const body = unescapeBody(entry.body)
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  return {
    decision: entry.decision,
    id: entry.id,
    slug: entry.slug,
    section: entry.section,
    body: body.join('\n'),
  }
}

const CHINESE_ORDINALS = new Map(
  Array.from({ length: 30 }, (_, index) => [chineseNumber(index + 1), index + 1]),
)

export function sectionNumber(title) {
  const match = /^第(.+?)节(?:\s|$)/.exec(title)
  return match ? (CHINESE_ORDINALS.get(match[1]) ?? null) : null
}

export function insertIntoSection(fileText, section, bodies) {
  // 没有要插的东西就原样返回。否则 addition 为空串时会插出一个多余空行加一个多余结尾换行，
  // 违反「文件结尾恰好一个换行」；新建小节分支还会凭空造出一个空小节。
  if (!bodies.length) return fileText
  const addition = bodies.join('\n\n')
  // 用 [ \t]* 而不是 \s*，否则 \s* 会吃掉换行，start 位置就落到下一行了
  const headingRe = new RegExp(`^## ${escapeRegExp(section)}[ \\t]*$`, 'm')
  const heading = headingRe.exec(fileText)

  if (!heading) {
    const existing = [...fileText.matchAll(/^## (第.+?节)(?:\s|$)/gm)]
      .map((match) => sectionNumber(match[1]))
      .filter((value) => value !== null)
    const max = existing.length ? Math.max(...existing) : 0
    const wanted = sectionNumber(section)
    if (wanted !== max + 1) {
      throw new Error(`无法新建「${section}」：现有最大节号 ${max}，只允许新建第 ${max + 1} 节`)
    }
    return `${fileText.replace(/\n+$/, '')}\n\n## ${section}\n\n${addition}\n`
  }

  const start = heading.index + heading[0].length
  const rest = fileText.slice(start)
  const nextHeading = /^## /m.exec(rest)
  const endOffset = nextHeading ? start + nextHeading.index : fileText.length
  // 严格 append-only：只吃掉小节末尾的空行，不碰既有正文行内的尾随空白。
  // markdown 的硬换行就是行尾两个空格，`/\s*$/` 会把小节最后一行的行尾空白一起无声删掉 ——
  // 这一步只该新增内容，既有正文必须逐字不变。
  const body = fileText.slice(start, endOffset).replace(/\n+$/, '')
  const tail = fileText.slice(endOffset)
  return `${fileText.slice(0, start)}${body}\n\n${addition}\n${tail ? `\n${tail}` : ''}`
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readCorpus() {
  let corpus = ''
  for (const dir of CONTENT_DIRS) {
    for (const name of await readdir(path.join(ROOT, dir))) {
      if (name.endsWith('.md')) corpus += await readFile(path.join(ROOT, dir, name), 'utf8')
    }
  }
  return normalizeForMatch(corpus)
}

// macOS 的 APFS 和 Windows 的 NTFS 默认大小写不敏感：那里 `--out=CONTENT/x.md`
// 写进的就是 content/，字面比较却当它是另一个目录而放行。护栏按平台决定比较口径，
// 只在整段路径上折叠大小写，所以 `docs/…/contents.md` 这类名字仍然照常放行。
const CASE_INSENSITIVE_PLATFORMS = new Set(['darwin', 'win32'])

// 这条流水线的全部安全性都建立在「审稿文件不是正文」之上：
// `--out=content/dao/...` 会绕开人工闸门直接改站点正文，所以在写盘前就拦死。
export function resolveOutputPath(output, {
  root = ROOT,
  caseInsensitive = CASE_INSENSITIVE_PLATFORMS.has(process.platform),
} = {}) {
  const resolved = path.resolve(root, output)
  const fold = (value) => (caseInsensitive ? value.toLowerCase() : value)
  const relative = path.relative(fold(path.join(root, 'content')), fold(resolved))
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error(`--out 不能指向 content/ 下的路径（${resolved}）：审稿文件只写 docs/content-audits/。`)
  }
  return resolved
}

async function runReview({ input, output }) {
  const outputPath = resolveOutputPath(output)
  const posts = JSON.parse(await readFile(path.resolve(ROOT, input), 'utf8'))
  const corpus = await readCorpus()
  const previouslyKept = new Set()
  for (const sheet of BATCH.previousReviews) {
    // 故意不 try/catch：路径配错就该炸，静默当成空集合等于去重没生效
    const markdown = await readFile(path.resolve(ROOT, sheet), 'utf8')
    for (const id of collectKeptIds(markdown)) previouslyKept.add(id)
  }
  const entries = []
  const stats = { total: posts.length, duplicate: 0, short: 0, unsorted: 0, flagged: 0, aiTagged: 0, aiSuspected: 0 }

  for (const post of posts) {
    const block = extractBlock(post)
    if (!block.answer) continue
    if (previouslyKept.has(block.id) || isAlreadyPublished(block, corpus)) {
      stats.duplicate += 1
      continue
    }
    const short = !isSubstantive(block, { keepIds: KEEP_SHORT_IDS })
    if (short) stats.short += 1
    const target = classifyBlock(block) || { ...UNSORTED }
    if (!short && target.slug === 'UNSORTED') stats.unsorted += 1
    if (!short && target.answerMatched === false) stats.flagged += 1
    if (block.ai) stats.aiTagged += 1
    if (isSuspectedAiRepost(block)) stats.aiSuspected += 1
    entries.push({ block, target, short })
  }

  entries.sort((a, b) => (a.target.slug === b.target.slug
    ? a.block.date.localeCompare(b.block.date)
    : a.target.slug.localeCompare(b.target.slug)))

  await writeFile(outputPath, renderReview(entries), 'utf8')
  console.log(JSON.stringify({ ...stats, candidates: entries.filter((e) => !e.short).length, output }, null, 2))
}

// --apply 是这条流水线里唯一会改站点正文的一步，而它的输入是人手编辑了几个小时的
// markdown。手工编辑能弄坏的东西全是「不报错、只静默错」的类型，所以写盘之前先把
// 整份文件验一遍：任一条不过就整批拒绝导入，不做「跳过这条继续」的补救。
export function assertReviewIntegrity(markdown, entries, rawIds) {
  // ① 候选区哨兵存在，且排在所有条目之后。实测把这行删掉之后，最后一个条目的 body 会一路
  // 吞掉文末「归属强制过目」整段（265 行），而且解析不报任何错，直接被写进正文。
  // 判定口径必须和 parseReview 的终止条件一致（都 trimEnd 后比较）。
  const lines = String(markdown).split('\n')
  const sentinelIndex = lines.findIndex((line) => line.trimEnd() === CANDIDATES_END)
  if (sentinelIndex === -1) {
    throw new Error(
      `审稿文件里找不到候选区终止哨兵 ${CANDIDATES_END}：`
      + '最后一个条目会把文末所有内容吞进正文，拒绝导入。',
    )
  }

  // ①b 光有哨兵不够，它还得在最后一个条目之后。哨兵被手工挪到候选区中间（这正是这道护栏
  // 要防的事故类型）时，parseReview 在那里就 break，后面的条目全部静默消失 —— 实测把它挪到
  // 第一个条目之前，--apply 输出 kept:0、exit 0、零警告。这里按「哨兵之后不许再出现条目标题行」
  // 判定：渲染时正文里形似标题行的行都带转义反斜杠，不会误伤。
  const orphaned = lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line, lineNumber }) => lineNumber > sentinelIndex + 1 && HEADING_PREFIX_RE.test(line))
  if (orphaned.length) {
    const shown = orphaned.slice(0, 5).map(({ lineNumber }) => lineNumber).join('、')
    throw new Error(
      `候选区终止哨兵 ${CANDIDATES_END} 在第 ${sentinelIndex + 1} 行，它后面还有 ${orphaned.length} 个条目标题行`
      + `（第 ${shown}${orphaned.length > 5 ? ' 等' : ''} 行）：哨兵被挪到了候选区中间，`
      + '它后面的条目会被静默丢弃，拒绝导入。',
    )
  }

  // ①c 哨兵往后挪。①b 只管住了往前挪（哨兵后面不许再有条目标题行），往后挪一步不差地全过：
  // 实测把哨兵挪到文件末尾，最后一个条目的 body 从 3 行涨到 265 行，把「短句待定 + 归属强制过目」
  // 整段审稿脚手架（含 200 多行 `- \`id\` 日期 摘要`）吞进已发布正文，五道校验全过、exit 0，
  // 输出跟正常跑一模一样。渲染时哨兵的位置是「最后一个条目之后、文末脚手架的 `---` 之前」，
  // 所以两头一起卡：
  //   (a) 文末脚手架的小标题必须排在哨兵之后（挡住哨兵被挪进/挪过脚手架）；
  //   (b) 哨兵后面第一行非空行必须是脚手架那条 `---`（挪到 `---` 之下只多吞一行 `---`，(a) 看不出来）。
  const tailHeading = lines.findIndex((line) => TAIL_HEADING_RE.test(line))
  if (entries.length && tailHeading === -1) {
    throw new Error(
      `审稿文件里找不到文末脚手架（\`## ${SHORT_HEADING}\` / \`## ${ATTRIBUTION_HEADING}\`）：`
      + '没有它就没法判断哨兵是不是被往后挪过，而挪过之后脚手架会被最后一个条目吞进正文，拒绝导入。',
    )
  }
  if (tailHeading !== -1 && tailHeading < sentinelIndex) {
    throw new Error(
      `候选区终止哨兵 ${CANDIDATES_END} 在第 ${sentinelIndex + 1} 行，排在文末脚手架`
      + `「${lines[tailHeading].trim()}」（第 ${tailHeading + 1} 行）之后：哨兵被往后挪了，`
      + `中间这 ${sentinelIndex - tailHeading} 行审稿脚手架会被最后一个条目吞进正文，拒绝导入。`,
    )
  }
  const afterSentinel = lines.findIndex((line, index) => index > sentinelIndex && line.trim() !== '')
  if (afterSentinel !== -1 && lines[afterSentinel].trimEnd() !== TAIL_RULE) {
    throw new Error(
      `候选区终止哨兵 ${CANDIDATES_END}（第 ${sentinelIndex + 1} 行）后面的第一行非空行是`
      + `「${lines[afterSentinel].trim()}」（第 ${afterSentinel + 1} 行），而不是文末脚手架的 \`${TAIL_RULE}\` 分隔线：`
      + '哨兵不在「最后一个条目之后、脚手架之前」的位置上，它前面多出来的行会被吞进正文，拒绝导入。',
    )
  }

  // ①d 标题行被整行删掉。人工审稿时「不要这条」的正确做法是把 [keep] 改成 [drop]，可一旦顺手
  // 删掉整行 `### [keep] …`，五道校验一条都看不见：条目数静默 -1、那条 id 无声消失、它的正文被
  // 接到前一条的 body 尾巴上、它那行 `<!-- 原帖链接 -->` 落在 body 中间（isMetadataLine 只剥离紧跟
  // 标题行的那一行）被原样写进已发布正文，输出只是 kept 少一条。
  // 注意「条目数 vs 标题行数」是同义反复（两个数都来自同一次 HEADING_RE 扫描），拦不住这个；
  // 能拦住的不变量是「renderReview 从不把来源链接注释放进正文」，见 findStrayUrlComments。
  const stray = findStrayUrlComments(markdown)
  if (stray.length) {
    const shown = stray
      .slice(0, 5)
      .map(({ id, lineNumber, line }) => `第 ${lineNumber} 行「${line}」${id ? `落在条目 ${id} 的正文里` : '落在第一个条目之前'}`)
      .join('；')
    throw new Error(
      `有 ${stray.length} 行来源链接注释落在条目正文里（${shown}${stray.length > 5 ? ' 等' : ''}）：`
      + '渲染时这行只出现在标题行正下方，它出现在正文里说明上一条的 `### [keep] …` 标题行被整行删掉了：'
      + '那条 id 会无声消失、它的正文被并进上一条、这行注释被原样写进已发布正文。'
      + '把删掉的标题行补回来（要丢弃这一条就把 [keep] 改成 [drop]，别删标题行），拒绝导入。',
    )
  }

  // ② 每条 id 都必须能在原始抓取数据里找到。手工编辑时误删正文里的转义反斜杠会凭空
  // 多出一个条目，凭记忆敲 id 会敲错；两种情况都在这里露馅。drop 的条目一样要对得上：
  // id 对不上说明文件结构已经坏了，而结构坏了会连累相邻条目的正文。
  const unknown = entries.filter((entry) => !rawIds.has(entry.id))
  if (unknown.length) {
    throw new Error(
      `有 ${unknown.length} 条 id 在原始抓取数据里找不到：${unknown.map((entry) => entry.id).join('、')}。`
      + '八成是手工编辑弄坏了条目结构（比如删掉了正文里的转义反斜杠），拒绝导入。',
    )
  }

  // ③ keep 却没有正文。旧写法用 `&& entry.body` 把它静默过滤掉，结果是「少导一条」
  // 而且没有任何提示。drop 的空正文是正常的（编辑删掉正文再标 drop）。
  const empty = entries.filter((entry) => entry.decision === 'keep' && !entry.body)
  if (empty.length) {
    throw new Error(
      `有 ${empty.length} 条标了 [keep] 却正文为空：${empty.map((entry) => entry.id).join('、')}。`
      + '要丢弃就改成 [drop]，不要留空正文。',
    )
  }

  // ④ 重复 id。同一条会被插进正文两遍，而且两遍之间可能已经被改成了不同的文字。
  const seen = new Set()
  const duplicated = new Set()
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicated.add(entry.id)
    seen.add(entry.id)
  }
  if (duplicated.size) {
    throw new Error(`有 ${duplicated.size} 个 id 重复出现：${[...duplicated].join('、')}，会被导入多遍，拒绝导入。`)
  }

  // ⑤ 一条 keep 都不剩。正常审稿单不可能全 drop，出现这种情况说明文件结构已经坏了
  // （典型是哨兵被挪到候选区前面，条目全被截断），而旧实现会安静地写 0 个文件然后 exit 0，
  // 「什么都没发生」和「导入成功」长得一模一样。
  if (!entries.some((entry) => entry.decision === 'keep')) {
    throw new Error(
      `审稿文件里一条 [keep] 都没有（共解析出 ${entries.length} 条）：`
      + '正常情况下不可能一条都不导入，八成是哨兵位置或条目结构被改坏了，拒绝导入。',
    )
  }
}

export function collectRawIds(rawText, source) {
  let posts
  try {
    posts = JSON.parse(rawText)
  } catch (error) {
    throw new Error(`原始抓取数据不是合法 JSON（${source}）：${error.message}`)
  }
  if (!Array.isArray(posts)) {
    throw new Error(`原始抓取数据应该是 post 数组（${source}），实际是 ${typeof posts}。`)
  }
  return new Set(posts.map((post) => String(post?.id ?? '')).filter(Boolean))
}

// 原始抓取数据读不到就直接报错：没有它就没法做 ② 校验，而「没法校验」不等于「放行」。
async function readRawIds(rawPath) {
  const resolved = path.resolve(ROOT, rawPath)
  let text
  try {
    text = await readFile(resolved, 'utf8')
  } catch (error) {
    throw new Error(`读不到原始抓取数据 ${resolved}：${error.message}。用 --raw=<路径> 指定。`)
  }
  return collectRawIds(text, resolved)
}

async function locateChapter(slug) {
  for (const dir of CONTENT_DIRS) {
    const candidate = path.join(ROOT, dir, `${slug}.md`)
    try {
      await readFile(candidate, 'utf8')
      return candidate
    } catch {
      // 继续找下一个目录
    }
  }
  throw new Error(`找不到章节文件：${slug}.md`)
}

const execFileAsync = promisify(execFile)

// 脏文件列多了错误信息就没法看，列少了又不知道是哪儿脏。
const DIRTY_LIST_LIMIT = 5

// --apply 不幂等：同一份审稿单跑两遍会把每个块原样再插一遍，且没有任何提示。写盘本身也不原子
// （循环里逐个 writeFile），中途抛异常会留下「一半文件已改、一半没改」的现场。所以写盘前要求
// content/ 工作区是干净的 —— 有了这个干净的起点，出事时 `git checkout -- content/` 就能一键回滚。
export function assertContentClean(porcelain) {
  const dirty = String(porcelain ?? '').split('\n').filter((line) => line.trim() !== '')
  if (!dirty.length) return
  const shown = dirty.slice(0, DIRTY_LIST_LIMIT).map((line) => line.trim()).join('；')
  const more = dirty.length > DIRTY_LIST_LIMIT ? ` 等共 ${dirty.length} 处` : ''
  throw new Error(
    `content/ 有未提交改动（${shown}${more}）：--apply 会直接改写已发布正文，而且不幂等。`
    + '请先提交，或者 `git checkout -- content/` 丢弃后再跑；'
    + '这样万一写坏了可以一键回滚。确实要在有改动的工作区上导入，加 --force 跳过这道检查。',
  )
}

// pathspec 护栏自己判定失败时抛的错误类型。单拎一个类型出来是为了让它绕开
// assertContentCleanViaGit 里那个 catch：那里包出来的文案说的是「查不到 content/ 的 git 状态」
// 并且推荐 --force，可这里 git 明明跑成功了（是护栏读懂了输出才拒绝的），而 --force 正是唯一能把
// 这道 fail-closed 护栏变回 fail-open 的开关 —— 护栏自己的报错不该教人怎么绕过它。
class PathspecError extends Error {}

// pathspec 从 CONTENT_DIRS 推导，不写死 'content/'：写死的字面量跟真正会被改写的目录脱钩，
// 而 git 对匹配不到任何东西的 pathspec 是 exit 0 + 空输出 —— 拼错一个字母（实测
// `git status --porcelain -- contnet/`）这道护栏就静默退化成「恒为干净」永远放行。
// 所以先用 ls-files 确认每条 pathspec 都真的落在已跟踪文件上，落不上就报错退出。
export function assertPathspecsTracked(dirs, trackedOutput) {
  // 空 pathspec 列表在生产里不可达（CONTENT_DIRS 恒非空），但「没有目录要查」不等于
  // 「查过了、工作区是干净的」：真传进来一个空列表，这道护栏一个目录都不盯着，而 --apply
  // 照样往 content/ 写。所以照样 fail closed，不把静默放行留成一条默认行为。
  if (!dirs.length) {
    throw new PathspecError(
      '没有拿到任何 content/ pathspec：这道检查于是一个目录都不盯着，'
      + '而 --apply 照样会往 content/ 写，拒绝在这种状态下写正文。'
      + '检查 CONTENT_DIRS 是不是被改空了。',
    )
  }
  const tracked = String(trackedOutput ?? '').split('\0').map((line) => line.trim()).filter(Boolean)
  const missing = dirs.filter((dir) => !tracked.some((file) => file === dir || file.startsWith(`${dir}/`)))
  if (!missing.length) return
  throw new PathspecError(
    `git 里没有任何已跟踪文件落在 ${missing.join('、')} 下：这几条 pathspec 匹配不到东西，`
    + '脏工作区检查会永远放行（git 对匹配不到的 pathspec 是 exit 0 + 空输出），'
    + '拒绝在这种状态下写正文。检查 CONTENT_DIRS 里的目录名是不是拼错或改过。',
  )
}

// `--untracked-files=normal` 是显式覆盖，不是默认值的复读：环境里设了
// `status.showUntrackedFiles=no`（实测可复现）时，未跟踪的 content/ 文件在 porcelain 输出里
// 完全不可见，护栏会当成干净的直接放行然后真写盘。这道检查不该受用户 git 配置摆布。
export function gitStatusArgs(dirs = CONTENT_DIRS) {
  return ['status', '--porcelain', '--untracked-files=normal', '--', ...dirs]
}

export function gitListFilesArgs(dirs = CONTENT_DIRS) {
  return ['ls-files', '-z', '--', ...dirs]
}

async function gitContentStatus(root) {
  const listed = await execFileAsync('git', gitListFilesArgs(), { cwd: root })
  assertPathspecsTracked(CONTENT_DIRS, listed.stdout)
  const { stdout } = await execFileAsync('git', gitStatusArgs(), { cwd: root })
  return stdout
}

// run 可注入：这道护栏的逻辑全在「怎么解读 porcelain 输出」和「git 跑不起来算不算放行」上，
// 注入假的 run 才能把两条分支都测到。
export async function assertContentCleanViaGit({ root = ROOT, run = gitContentStatus } = {}) {
  let porcelain
  try {
    porcelain = await run(root)
  } catch (error) {
    // pathspec 护栏是自己读懂了 git 的输出才拒绝的，不是「查不到状态」：原样抛出去，
    // 别把排障方向指到「是不是不在 git 仓库里」，也别顺手把 --force 递给用的人。
    // 下面那条仍然覆盖「git 压根跑不起来」（不在仓库里 / 没装 git）：那种情况 fail closed，
    // 但确实可以用 --force 明示跳过，所以文案照旧。
    if (error instanceof PathspecError) throw error
    throw new Error(
      `查不到 content/ 的 git 状态（${String(error?.message ?? error).trim()}）：`
      + '--apply 会改写已发布正文，没有一个能回滚的干净起点就拒绝执行。'
      + '确认在 git 仓库里运行，或者用 --force 跳过这道检查。',
    )
  }
  assertContentClean(porcelain)
}

async function runApply({ input, raw, dryRun, force }) {
  // 前置护栏，放在读文件之前：真写盘的前提是「出事能一键回滚」。--dry-run 不写盘，不需要这道检查。
  if (!dryRun && !force) await assertContentCleanViaGit()
  const markdown = await readFile(path.resolve(ROOT, input), 'utf8')
  const entries = parseReview(markdown)
  assertReviewIntegrity(markdown, entries, await readRawIds(raw))

  // 校验过后 keep 的条目一定有正文，这里不再需要 `&& entry.body` 那种静默过滤。
  const kept = entries.filter((entry) => entry.decision === 'keep')
  const unsorted = kept.filter((entry) => entry.slug === 'UNSORTED')
  if (unsorted.length) {
    throw new Error(`还有 ${unsorted.length} 条 UNSORTED 未归类：${unsorted.map((e) => e.id).join(', ')}`)
  }

  const grouped = new Map()
  for (const entry of kept) {
    const key = JSON.stringify([entry.slug, entry.section])
    grouped.set(key, [...(grouped.get(key) || []), entry.body])
  }

  const summary = []
  const byFile = new Map()
  for (const [key, bodies] of grouped) {
    const [slug, section] = JSON.parse(key)
    const file = await locateChapter(slug)
    const before = byFile.get(file) ?? await readFile(file, 'utf8')
    byFile.set(file, insertIntoSection(before, section, bodies))
    summary.push({ slug, section, added: bodies.length })
  }

  if (!dryRun) {
    for (const [file, text] of byFile) await writeFile(file, text, 'utf8')
  }
  console.log(JSON.stringify({
    kept: kept.length,
    files: byFile.size,
    dryRun: Boolean(dryRun),
    force: Boolean(force),
    summary: summary.sort((a, b) => b.added - a.added),
  }, null, 2))
}

// 当前批次的身份。这四个路径以前是四个各自硬编码的常量，改批次要改四处、
// 漏一处就是「裸跑 --apply 把上一批审稿单再插一遍」（--apply 不幂等、无提示）。
// 换批次只改这一个对象；tests/xueqiu-import.test.mjs 会钉住它和当前批次一致。
export const BATCH = {
  label: '2026-08-24 → 2026-09-03',
  raw: 'raw/xueqiu/duan.20260824-.raw.json',
  review: 'docs/content-audits/xueqiu-2026-08-24-import.md',
  // 历史批次（已导完的批次）的审稿单，用于按 id 跨批次去重（见 collectKeptIds）。
  // 开新批次时：先把 review 改成新批次的路径，再把刚导完的那一批的 review 追加进来；
  // 这里只放已导完的批次，当前批次的 review 永远不许出现在这个数组里。
  previousReviews: ['docs/content-audits/xueqiu-2026-07-16-import.md'],
}

// 启动即自检：BATCH.review 若混进 previousReviews，runReview 会拿本批自己刚人工审校好的
// 审稿单当去重输入 —— 里面每一条 [keep] 都会被判成 duplicate 跳过，然后用剩下的残渣覆盖写回
// 同一个文件，几小时的人工审校连同那批内容一起无声消失（输出里只有 duplicate 变大，零警告）。
// 放在模块顶层而不是某个函数里：任何模式、任何 import 都必须先过这道闸。
// 比较口径跟 resolveOutputPath 一致：macOS/Windows 上 `DOCS/…/x.md` 和 `docs/…/x.md`
// 是同一个文件，字面比较却当它们是两个路径而放行——实测就是这么绕过去的。
{
  const fold = (value) => (CASE_INSENSITIVE_PLATFORMS.has(process.platform) ? value.toLowerCase() : value)
  const currentReview = fold(path.resolve(ROOT, BATCH.review))
  const selfReference = BATCH.previousReviews.find((sheet) => fold(path.resolve(ROOT, sheet)) === currentReview)
  if (selfReference) {
    throw new Error(
      `BATCH 配置错误：当前批次的审稿单「${BATCH.review}」出现在 previousReviews（「${selfReference}」）里。`
      + '这会让 runReview 拿本批自己的审稿单当跨批次去重的输入：本批每一条 [keep] 都被当成重复跳过，'
      + '再把剩下的残渣覆盖写回这同一个文件，人工审校成果直接丢失且没有任何提示。'
      + 'previousReviews 只放已经导完的历史批次；开新批次时要先把 BATCH.review 改成新批次的路径。',
    )
  }
}

const DEFAULT_INPUT = BATCH.raw
const DEFAULT_OUTPUT = BATCH.review
const DEFAULT_REVIEW = BATCH.review
const DEFAULT_RAW = BATCH.raw
const USAGE = '用法：node scripts/import-xueqiu-qanda.mjs '
  + '(--review [--in=路径] [--out=路径] | --apply [--in=路径] [--raw=路径] [--dry-run] [--force])'

// 按第一个 `=` 切分：值里可以含 `=`（旧实现 split('=') 会把 --out=a=b 截成 a）。
// 不带 `=` 的参数是布尔开关（--review），路径参数缺值时由 optionValue 报错。
export function parseArgs(argv) {
  const args = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      throw new Error(`无法识别的参数「${arg}」：参数要写成 --开关 或 --键=值。`)
    }
    const body = arg.slice(2)
    const separator = body.indexOf('=')
    const key = separator === -1 ? body : body.slice(0, separator)
    if (!key) throw new Error(`无法识别的参数「${arg}」：缺少参数名。`)
    args[key] = separator === -1 ? true : body.slice(separator + 1)
  }
  return args
}

export function optionValue(args, key, fallback) {
  const value = args[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`--${key} 需要一个非空的值，写成 --${key}=路径。`)
  }
  return value
}

// 纯开关：出现即为真，一律不许带值。parseArgs 按第一个 `=` 切分、`=` 之后全部进 value，所以
// 带值的开关会静默变成一个真值字符串：`--apply=false`（字面意思「别 apply」）、
// `--apply=x --dry-run`（zsh 不做词分割，没引号的 $FLAGS 整串挤进一个 argv，`--dry-run` 被吞进
// value 里）旧实现都会解析成「apply 且不 dry-run」然后真的改写 27 个已发布正文文件。
const SWITCH_FLAGS = new Set(['review', 'apply', 'dry-run', 'force'])

// 白名单按模式分开。全局白名单会让 `--apply --out=content/dao/qanda/x.md` 被接受并静默忽略，
// 而 --out 恰恰是 resolveOutputPath 重点防的那个参数 —— 用错模式的参数说明用的人搞错了这条命令
// 在干什么，报错退出比装没看见安全。
const MODE_FLAGS = new Map([
  ['review', new Set(['review', 'in', 'out'])],
  ['apply', new Set(['apply', 'in', 'raw', 'dry-run', 'force'])],
])

// 压根不存在的参数名要在定模式之前就报出来，而且要带着名字报。按模式分白名单之后，
// `--nope` / `--dryrun`（都不含 --review/--apply）会一路走到「没选模式」分支，只打印一行 USAGE，
// 不说是哪个参数错了；`--apply --dry-run` 整串挤进一个 argv（zsh 不做词分割）时同理 ——
// 键是 `apply --dry-run`，模式判定看不见 apply，用的人只能瞪着一行用法自己猜。
const KNOWN_FLAGS = new Set([...MODE_FLAGS.values()].flatMap((flags) => [...flags]))

// 参数拼错在 --review 下顶多是白跑一趟，在 --apply 下是直接写正文：
// `--dryrun` / `--dry-run=false` 都会让 dryRun 落成 false 然后真的写盘。
export function resolveCliOptions(argv) {
  const args = parseArgs(argv)
  const keys = Object.keys(args)
  for (const key of keys) {
    if (SWITCH_FLAGS.has(key) && args[key] !== true) {
      throw new Error(`--${key} 是开关，不接受值：写 --${key}，不要写 --${key}=…。`)
    }
  }
  // 这一步在模式判定之前，而且刻意排在「开关不许带值」之后：`--apply=false --dry-run` 这类
  // 必须继续按「--apply 是开关，不接受值」报错（那是上一轮的 Critical 修复），不能被这里抢走。
  const unrecognised = keys.filter((key) => !KNOWN_FLAGS.has(key))
  if (unrecognised.length) {
    throw new Error(
      `无法识别的参数：${unrecognised.map((key) => `--${key}`).join('、')}。`
      + `可用参数：${[...KNOWN_FLAGS].map((key) => `--${key}`).join('、')}。`,
    )
  }
  // 用 `in` 而不是真值判断：`--apply=` 的值是空串，真值判断会把它当成「没写 --apply」。
  const hasReview = 'review' in args
  const hasApply = 'apply' in args
  if (hasReview && hasApply) throw new Error('--review 和 --apply 只能选一个。')
  if (!hasReview && !hasApply) return { mode: 'usage' }

  const mode = hasReview ? 'review' : 'apply'
  const unknown = keys.filter((key) => !MODE_FLAGS.get(mode).has(key))
  if (unknown.length) {
    throw new Error(`--${mode} 不接受这些参数：${unknown.map((key) => `--${key}`).join('、')}。`)
  }
  if (mode === 'review') {
    return {
      mode,
      input: optionValue(args, 'in', DEFAULT_INPUT),
      output: optionValue(args, 'out', DEFAULT_OUTPUT),
    }
  }
  return {
    mode,
    input: optionValue(args, 'in', DEFAULT_REVIEW),
    raw: optionValue(args, 'raw', DEFAULT_RAW),
    // 上面已经保证这两个开关只可能是 true 或 undefined
    dryRun: args['dry-run'] === true,
    force: args.force === true,
  }
}

async function main() {
  let options
  try {
    options = resolveCliOptions(process.argv.slice(2))
    if (options.mode === 'usage') {
      console.error(USAGE)
      process.exitCode = 1
      return
    }
    // 提前校验一次，让「--out 打进 content/」这类用法错误只打印一行人话；
    // runReview 里那次才是真正的写盘护栏（程序化调用同样拦得住）。
    if (options.mode === 'review') resolveOutputPath(options.output)
  } catch (error) {
    console.error(error.message)
    console.error(USAGE)
    process.exitCode = 1
    return
  }
  await (options.mode === 'review' ? runReview(options) : runApply(options))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // 只打印 message：这几道护栏的报错信息是写给人看的中文提示，
    // 连 Error 对象一起打印会把它埋在堆栈和 errno 之类的属性里。
    console.error(String(error?.message ?? error))
    process.exitCode = 1
  })
}
