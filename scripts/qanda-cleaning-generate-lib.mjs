import { answerFingerprint, normalizeForDuplicate, validateQuestionAnswerIntegrity } from './qanda-cleaning-lib.mjs'
import { sectionForBlock } from './qanda-cleaning-config.mjs'
import { cleanEditorialMarkdown } from './qanda-editorial-cleaning.mjs'
import { orderTopicUnits } from './qanda-ordering.mjs'

const LEGACY_LINK_TARGETS = new Map([
  ['duanyongping-shangyeluoji-di3jie-qiyewenhua', 'wenda-business-08'],
])

export function rewriteLegacyLinks(markdown) {
  return markdown.replace(/\]\(\/([a-zA-Z0-9_-]+)\)/g, (match, slug) => {
    const target = LEGACY_LINK_TARGETS.get(slug)
    return target ? match.replace(`/${slug}`, `/${target}`) : match
  })
}

export function stripObsoleteQuestionOrdinals(markdown) {
  return markdown.replace(
    /^([ \t]*(?:>\s*)?(?:\*\*)?)[０-９0-9一二三四五六七八九十百]{1,3}\s*(?:[.．、]\s*)?(?:_{1,2}\s*)?(?=(?:\*\*)?(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝))/gmu,
    '$1',
  )
}

function plainParagraph(paragraph) {
  return paragraph
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

export function standardizeQaMarkers(markdown) {
  const normalizedHardBreaks = markdown.replace(
    /^([^\n]*(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[^\n]*[?？][^\n]*)[ \t]{2,}\n(?=\S)/gmu,
    '$1\n\n',
  )
  const paragraphs = normalizedHardBreaks.split(/\n\s*\n+/)
  const hasExplicitAnswer = paragraphs.some((paragraph) => /(?:段永平|大道|答)\s*[：:]/u.test(plainParagraph(paragraph)))
  let awaitingAnswer = false
  return paragraphs
    .map((paragraph) => {
      const plain = plainParagraph(paragraph)
      const question = /^(?:\d+[.、．]\s*)?(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[^：:]{0,30}[：:]/u.test(plain)
      const answer = /(?:段永平|大道|答)\s*[：:]/u.test(plain)
      if (question) {
        awaitingAnswer = !answer
        return paragraph
      }
      if (awaitingAnswer && !answer && !hasExplicitAnswer) {
        awaitingAnswer = false
        return `**段永平：** ${paragraph}`
      }
      if (answer) awaitingAnswer = false
      return paragraph
    })
    .join('\n\n')
}

export function classifyNoInformation(block) {
  if (validateQuestionAnswerIntegrity(block).length) {
    return { discard: true, reason: 'unanswered-question' }
  }
  const normalized = answerFingerprint(block.markdown) || normalizeForDuplicate(block.markdown)
  const withoutSpeakers = normalized
    .replace(/网友[:：]?/g, '')
    .replace(/段永平[:：]?/g, '')
    .replace(/大道[:：]?/g, '')
    .replace(/不明真相的群众[:：]?/g, '')
  const semanticAnswer = withoutSpeakers
    .replace(/\((?:19|20)\d{2}[^)]*\)/g, '')
    .replace(/[。.!！?？,，:：;；、\[\]()（）…]+/g, '')
    .trim()
  if (/^(?:不知道|没看过|没研究过|没关注|不了解|看不懂|不懂)$/.test(semanticAnswer)) {
    return { discard: false }
  }
  if (!semanticAnswer) return { discard: true, reason: 'empty-response' }
  if (/^(?:谢谢|多谢|感谢|不客气|呵呵|哈哈|嗯|恩|点赞|赞|有点意思|这个有点意思|确实有点意思|明白了|果然如此|正解)$/.test(semanticAnswer)) {
    return { discard: true, reason: 'pure-reaction' }
  }
  if (Array.from(semanticAnswer).length <= 18 && /谢谢.*不客气|感谢.*不用谢|请收下.*谢谢/.test(semanticAnswer)) {
    return { discard: true, reason: 'courtesy-only' }
  }
  return { discard: false }
}

export function isNoInformation(block) {
  return classifyNoInformation(block).discard
}

function plainHeading(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitLongParagraph(paragraph, limit) {
  if (Array.from(paragraph.replace(/\s+/g, '')).length <= limit) return [paragraph]
  if (/^(?:#{1,6}\s|[-+*]\s|\d+[.、．]\s|>|\|)/.test(paragraph.trim())) return [paragraph]

  const sentences = paragraph.split(/(?<=[。！？；])|(?<=[.!?;])(?=\s)/u).filter(Boolean)
  if (sentences.length <= 1) return [paragraph]
  const parts = []
  let current = ''
  for (const sentence of sentences) {
    const candidate = current + sentence
    if (current && Array.from(candidate.replace(/\s+/g, '')).length > limit) {
      parts.push(current.trim())
      current = sentence
    } else {
      current = candidate
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

export function shortenParagraphs(markdown, limit = 180) {
  return markdown
    .split(/\n\s*\n+/)
    .flatMap((paragraph) => splitLongParagraph(paragraph.trim(), limit))
    .filter(Boolean)
    .join('\n\n')
    .replace(/[ \t]+$/gm, '')
}

const SECTION_ALIASES = new Map([
  ['其他', '补充问答'],
  ['其他话题', '补充问答'],
  ['其他问答', '补充问答'],
  ['其他公司', '相关公司比较'],
  ['其他投资问答', '补充投资问答'],
])

export function chineseNumber(value) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (value < 10) return digits[value]
  if (value < 20) return `十${value % 10 ? digits[value % 10] : ''}`
  if (value < 100) return `${digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ''}`
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  if (!remainder) return `${digits[hundreds]}百`
  if (remainder < 10) return `${digits[hundreds]}百零${digits[remainder]}`
  return `${digits[hundreds]}百${chineseNumber(remainder)}`
}

export function extractBlockDate(block) {
  const match = (block.markdown || '').normalize('NFKC').match(/(?:19|20)\d{2}[-./年]\d{1,2}(?:[-./月]\d{1,2})?日?/u)
  if (!match) return null
  const parts = match[0].replace(/[年月./]/g, '-').replace(/日$/, '').split('-')
  return [parts[0], String(parts[1] || 1).padStart(2, '0'), String(parts[2] || 1).padStart(2, '0')].join('-')
}

function sectionTitle(block, topic) {
  const raw = plainHeading(block.headingPath?.at(-1) || '相关问答') || '相关问答'
  const withoutDecoration = raw
    .replace(/^【|】$/g, '')
    .replace(/^第[零一二三四五六七八九十百千\d]+[章节]\s*/u, '')
    .replace(/^(?:[零一二三四五六七八九十百千\d]+)[、.．]\s*/u, '')
    .trim()
  const normalized = SECTION_ALIASES.get(withoutDecoration) || withoutDecoration
  if (normalized === '补充问答' || normalized === '相关问答') return `${topic.title}补充问答`
  return normalized || `${topic.title}补充问答`
}

export function buildTopicChapter(topic, blocks) {
  const sections = new Map()
  const ordering = orderTopicUnits(topic, blocks)
  for (const [orderedIndex, block] of ordering.ordered.entries()) {
    const placement = ordering.placements.get(block.id)
    const sectionInfo = block.sectionInfo || sectionForBlock(topic.slug, block)
    const current = sections.get(sectionInfo.title) || { ...sectionInfo, units: [], subsections: new Map() }
    const normalized = stripObsoleteQuestionOrdinals(rewriteLegacyLinks(block.markdown))
    const editorial = cleanEditorialMarkdown(normalized, { blockId: block.id })
    const cleaned = shortenParagraphs(standardizeQaMarkers(editorial.markdown))
    const unit = {
      markdown: cleaned,
      date: extractBlockDate(block),
      sourceIndex: placement?.originalIndex ?? orderedIndex,
    }
    if (sectionInfo.subsectionTitle) {
      const subsection = current.subsections.get(sectionInfo.subsectionTitle) || {
        title: sectionInfo.subsectionTitle,
        order: sectionInfo.subsectionOrder,
        units: [],
      }
      subsection.units.push(unit)
      current.subsections.set(sectionInfo.subsectionTitle, subsection)
    } else {
      current.units.push(unit)
    }
    sections.set(sectionInfo.title, current)
  }

  const sortedUnits = (units) => [...units]

  const body = [...sections.values()]
    .sort((left, right) => left.order - right.order)
    .map((item, index) => {
      const direct = sortedUnits(item.units).map((unit) => unit.markdown).join('\n\n')
      const nested = [...item.subsections.values()]
        .sort((left, right) => left.order - right.order)
        .map((subsection) => `### ${subsection.title}\n\n${sortedUnits(subsection.units).map((unit) => unit.markdown).join('\n\n')}`)
        .join('\n\n')
      return `## 第${chineseNumber(index + 1)}节 ${item.title}\n\n${[direct, nested].filter(Boolean).join('\n\n')}`
    })
    .join('\n\n')

  return {
    ...topic,
    slug: topic.slug,
    body: body.trim(),
    blockIds: [...new Set(ordering.ordered.map((block) => block.id))],
    baseSlug: topic.slug,
    orderingMoves: ordering.moves,
    placements: ordering.placements,
  }
}

export function renderArticleFile(article) {
  const description = `汇集段永平关于“${article.title}”的公开问答`
  const lines = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `slug: ${JSON.stringify(article.slug)}`,
    `description: ${JSON.stringify(description)}`,
    'category: "投资问答录"',
    `order: ${article.order}`,
    `seoTitle: ${JSON.stringify(`${article.title}｜段永平投资问答录`)}`,
    `seoDescription: ${JSON.stringify(description)}`,
    'type: "qanda-chapter"',
    `volume: ${JSON.stringify(article.volume)}`,
    `volumeOrder: ${article.volumeOrder}`,
    `chapterOrder: ${article.chapterOrder}`,
    `tags: ${JSON.stringify(article.tags)}`,
    '---',
    '',
    article.body.trim(),
    '',
  ]
  return lines.join('\n')
}
