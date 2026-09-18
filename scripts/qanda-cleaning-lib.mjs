const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/

export function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return { data: {}, body: raw }

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!field) continue
    const [, key, sourceValue] = field
    let value = sourceValue.trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        data[key] = JSON.parse(value.replace(/'/g, '"'))
        continue
      } catch {
        data[key] = value
        continue
      }
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (/^-?\d+(?:\.\d+)?$/.test(value)) data[key] = Number(value)
    else if (value === 'true' || value === 'false') data[key] = value === 'true'
    else data[key] = value
  }

  return { data, body: raw.slice(match[0].length) }
}

function stripMarkdown(markdown) {
  return markdown
    .replace(FRONTMATTER_RE, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+[.、．]\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/<[^>]+>/g, '')
}

export function normalizeForDuplicate(markdown) {
  return stripMarkdown(markdown)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”‘’"']/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function visibleTextLength(markdown) {
  return Array.from(stripMarkdown(markdown).replace(/\s+/g, '')).length
}

export function answerFingerprint(markdown) {
  const paragraphs = markdown
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const joinedMarkdown = paragraphs.join('\n\n')
  const explicitAnswer = joinedMarkdown.match(/(?:\*{0,3})?(?:段永平|大道|答)(?:\*{0,3})?\s*[：:]\s*(?:\*{0,3})?/u)
  if (explicitAnswer) {
    return normalizeForDuplicate(joinedMarkdown.slice(explicitAnswer.index + explicitAnswer[0].length))
  }
  let answer = paragraphs
  if (paragraphs.length > 1 && startsQuestion(paragraphs[0])) answer = paragraphs.slice(1)
  const joined = answer.join('\n\n').replace(/^\s*(?:\*{0,3})?(?:段永平|大道|答)(?:\*{0,3})?\s*[：:]\s*(?:\*{0,3})?\s*/u, '')
  return normalizeForDuplicate(joined)
}

function canonicalScore(block) {
  const dateCount = (block.markdown.match(/\((?:19|20)\d{2}[-年][^)]*\)/g) || []).length
  return (block.hasQuestion ? 20 : 0)
    + (block.hasAnswer ? 20 : 0)
    + dateCount * 10
    + (block.headingPath?.length || 0) * 3
    + Math.min(visibleTextLength(block.markdown), 1000) / 1000
}

export function deduplicateBlocks(blocks, { minimumLength = 50, fingerprint = normalizeForDuplicate } = {}) {
  const groups = new Map()
  const singletons = []
  blocks.forEach((block, index) => {
    const normalized = fingerprint(block.markdown)
    const item = { block, index, normalized }
    if (Array.from(normalized).length < minimumLength) {
      singletons.push(item)
      return
    }
    const list = groups.get(normalized) || []
    list.push(item)
    groups.set(normalized, list)
  })

  const keptItems = [...singletons]
  const audit = []
  for (const list of groups.values()) {
    const canonical = [...list].sort((left, right) => canonicalScore(right.block) - canonicalScore(left.block))[0]
    keptItems.push(canonical)
    for (const item of list) {
      if (item === canonical) audit.push({ id: item.block.id, status: 'kept' })
      else audit.push({ id: item.block.id, status: 'duplicate', duplicateOf: canonical.block.id })
    }
  }
  for (const item of singletons) audit.push({ id: item.block.id, status: 'kept' })

  keptItems.sort((left, right) => left.index - right.index)
  return { kept: keptItems.map((item) => item.block), audit }
}

function ngrams(value, width = 5) {
  const chars = Array.from(value)
  const out = new Set()
  if (chars.length <= width) {
    if (chars.length) out.add(chars.join(''))
    return out
  }
  for (let i = 0; i <= chars.length - width; i++) out.add(chars.slice(i, i + width).join(''))
  return out
}

function containmentSimilarity(leftSet, rightSet) {
  if (!leftSet.size || !rightSet.size) return 0
  let intersection = 0
  for (const gram of leftSet) if (rightSet.has(gram)) intersection++
  return intersection / Math.min(leftSet.size, rightSet.size)
}

export function findNearDuplicatePairs(blocks, { threshold = 0.9, minimumLength = 30, fingerprint = normalizeForDuplicate } = {}) {
  const normalized = blocks.map((block) => {
    const value = fingerprint(block.markdown)
    return { block, value, length: Array.from(value).length, grams: ngrams(value) }
  })
  const pairs = []
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i].length < minimumLength) continue
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[j].length < minimumLength) continue
      if (normalized[i].value === normalized[j].value) continue
      const shorter = Math.min(normalized[i].length, normalized[j].length)
      const longer = Math.max(normalized[i].length, normalized[j].length)
      if (shorter / longer < 0.45) continue
      const similarity = containmentSimilarity(normalized[i].grams, normalized[j].grams)
      if (similarity >= threshold) {
        pairs.push({
          leftId: normalized[i].block.id,
          rightId: normalized[j].block.id,
          similarity: Number(similarity.toFixed(4)),
        })
      }
    }
  }
  return pairs
}

function semanticDateTokens(markdown) {
  const normalized = normalizeForDuplicate(markdown)
  return [...new Set(normalized.match(/(?:19|20)\d{2}(?:[-./年]\d{1,2})?(?:[-./月]\d{1,2})?日?/g) || [])].sort()
}

function semanticNumberTokens(markdown) {
  const withoutDates = answerFingerprint(markdown)
    .replace(/(?:19|20)\d{2}(?:[-./年]\d{1,2})?(?:[-./月]\d{1,2})?日?/g, '')
  return [...new Set(withoutDates.match(/\d+(?:\.\d+)?%?/g) || [])].sort()
}

export function reviewNearDuplicatePair(left, right, similarity) {
  const withoutDate = (value) => value
    .replace(/\((?:19|20)\d{2}[^)]*\)/g, '')
    .replace(/(?:19|20)\d{2}(?:[-./年]\d{1,2})?(?:[-./月]\d{1,2})?日?/g, '')
  const leftAnswer = withoutDate(answerFingerprint(left.markdown))
  const rightAnswer = withoutDate(answerFingerprint(right.markdown))
  const shorter = Math.min(Array.from(leftAnswer).length, Array.from(rightAnswer).length)
  const longer = Math.max(Array.from(leftAnswer).length, Array.from(rightAnswer).length)
  const lengthRatio = longer ? shorter / longer : 1
  const leftNumbers = semanticNumberTokens(left.markdown)
  const rightNumbers = semanticNumberTokens(right.markdown)
  const leftDates = semanticDateTokens(left.markdown)
  const rightDates = semanticDateTokens(right.markdown)

  if (JSON.stringify(leftNumbers) !== JSON.stringify(rightNumbers)) {
    return { resolution: 'kept-distinct-data', reason: '数字或日期不同' }
  }
  if (leftDates.length && rightDates.length && JSON.stringify(leftDates) !== JSON.stringify(rightDates)) {
    return { resolution: 'kept-distinct-data', reason: '数字或日期不同' }
  }
  if (lengthRatio < 0.82) {
    return { resolution: 'kept-distinct-additional-content', reason: '较长版本包含额外论述' }
  }
  if (similarity < 0.94) {
    return { resolution: 'kept-distinct-wording', reason: '相似度不足以确认同源' }
  }
  return { resolution: 'duplicate-reviewed', reason: '回答仅有标点、格式或轻微措辞差异' }
}

function reviewedCanonicalScore(block) {
  const dateCount = semanticDateTokens(block.markdown).length
  return (block.hasQuestion ? 100 : 0)
    + (block.hasAnswer ? 100 : 0)
    + dateCount * 25
    + (block.headingPath?.length || 0) * 10
    + Math.min(visibleTextLength(block.markdown), 2000) / 2000
}

export function reviewNearDuplicateBlocks(blocks, {
  threshold = 0.94,
  minimumLength = 50,
  canonical = (left, right) => reviewedCanonicalScore(left) >= reviewedCanonicalScore(right) ? left : right,
} = {}) {
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const candidates = findNearDuplicatePairs(blocks, { threshold, minimumLength, fingerprint: answerFingerprint })
    .sort((left, right) => right.similarity - left.similarity)
  const duplicateOf = new Map()
  const resolve = (id) => {
    let current = id
    const visited = new Set()
    while (duplicateOf.has(current) && !visited.has(current)) {
      visited.add(current)
      current = duplicateOf.get(current)
    }
    return current
  }

  for (const candidate of candidates) {
    const left = blockById.get(candidate.leftId)
    const right = blockById.get(candidate.rightId)
    Object.assign(candidate, reviewNearDuplicatePair(left, right, candidate.similarity))
    if (candidate.resolution !== 'duplicate-reviewed') continue

    const leftRoot = resolve(candidate.leftId)
    const rightRoot = resolve(candidate.rightId)
    if (leftRoot === rightRoot) {
      candidate.duplicateOf = leftRoot
      continue
    }
    const kept = canonical(blockById.get(leftRoot), blockById.get(rightRoot))
    const duplicate = kept.id === leftRoot ? rightRoot : leftRoot
    duplicateOf.set(duplicate, kept.id)
    candidate.duplicateOf = kept.id
  }

  for (const [id, target] of duplicateOf) duplicateOf.set(id, resolve(target))
  return {
    kept: blocks.filter((block) => !duplicateOf.has(block.id)),
    candidates,
    duplicateOf,
    resolve,
  }
}

function headingInfo(paragraph) {
  const trimmed = paragraph.trim()
  const match = trimmed.match(/^(#{1,6})\s+(.+)$/s)
  if (match) return { level: match[1].length, text: stripMarkdown(match[2]).trim() }
  const caseLabel = trimmed.match(/^\*\*\s*((?:案例|个案)\s*[零一二三四五六七八九十百\d]+[：:].{1,80})\s*\*\*$/su)
  if (caseLabel) return { level: 6, text: stripMarkdown(caseLabel[1]).trim() }
  const numberedLabel = trimmed.match(/^\*\*\s*((?:\d{1,3}|[零一二三四五六七八九十百]+)[.、．]\s*(?!(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[：:]).{1,80})\s*\*\*$/su)
  if (numberedLabel) return { level: 6, text: stripMarkdown(numberedLabel[1]).trim() }
  return null
}

function startsSpeakerQuestion(paragraph) {
  const plain = stripMarkdown(paragraph).trim()
  return /^(?:\d+\s*[.、．]?\s*)?(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[^：:]{0,24}[：:]/.test(plain)
}

function startsQuestion(paragraph) {
  const plain = stripMarkdown(paragraph).trim()
  return startsSpeakerQuestion(paragraph)
    || /(?:问|请问|想问|请教)[：:？?]/.test(plain.slice(0, 80))
}

function startsAnswer(paragraph) {
  const plain = stripMarkdown(paragraph).trim()
  return /^(?:段永平|大道|不明真相的群众|答)[^：:]{0,16}[：:]/.test(plain)
}

export function splitQuestionAnswerBlocks(markdown, { sourceSlug = 'source' } = {}) {
  const paragraphs = markdown
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}\n(?=(?:\*{1,2})?(?:\d+[.、．]\s*)?(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[^：:\n]{0,24}[：:])/gu, '\n\n')
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const headingPath = []
  const pathCounters = new Map()
  const blocks = []
  let current = null

  const flush = () => {
    if (!current) return
    const pathKey = current.headingPath.join(' > ') || '正文'
    const next = (pathCounters.get(pathKey) || 0) + 1
    pathCounters.set(pathKey, next)
    current.id = `${sourceSlug}#${pathKey}#${String(next).padStart(3, '0')}`
    current.markdown = current.paragraphs.join('\n\n').trim()
    delete current.paragraphs
    blocks.push(current)
    current = null
  }

  for (const paragraph of paragraphs) {
    const heading = headingInfo(paragraph)
    if (heading) {
      flush()
      headingPath.length = heading.level - 1
      headingPath[heading.level - 1] = heading.text
      continue
    }

    const question = startsQuestion(paragraph)
    const speakerQuestion = startsSpeakerQuestion(paragraph)
    const answer = startsAnswer(paragraph)
    if ((speakerQuestion && current)
      || (question && current?.hasAnswer)
      || (answer && current?.hasAnswer)) flush()
    if (!current) {
      current = {
        sourceSlug,
        headingPath: headingPath.filter(Boolean),
        paragraphs: [],
        hasQuestion: false,
        hasAnswer: false,
      }
    }
    current.paragraphs.push(paragraph)
    current.hasQuestion ||= question
    current.hasAnswer ||= answer
  }
  flush()
  return blocks
}

export function validateQuestionAnswerIntegrity(block) {
  const errors = []
  if (!block.hasQuestion || block.hasAnswer) return errors
  const paragraphs = block.markdown
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const explicitReaderQuestion = /^(?:\*{0,2})?(?:\d+\s*[.、．]?\s*)?(?:网友|读者|问|雪球用户|投资者|用户|大道粉丝)[^：:]{0,24}[：:]/u
    .test(stripMarkdown(paragraphs[0] || '').trim())
  const inlineAnswer = /(?:段永平|大道|答)\s*[：:]/u.test(stripMarkdown(block.markdown))
  const unlabelledHardBreakAnswer = /[ \t]{2,}\n(?=\S)/u.test(block.markdown)
  if (explicitReaderQuestion && paragraphs.length < 2 && !inlineAnswer && !unlabelledHardBreakAnswer) {
    errors.push(`question-without-answer:${block.id}`)
  }
  return errors
}

function splitSections(markdown, level) {
  const marker = '#'.repeat(level)
  const re = new RegExp(`^${marker}\\s+`, 'm')
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const preamble = []
  const sections = []
  let current = null
  for (const line of lines) {
    if (re.test(line)) {
      if (current) sections.push(current.join('\n').trim())
      current = [line]
    } else if (current) {
      current.push(line)
    } else {
      preamble.push(line)
    }
  }
  if (current) sections.push(current.join('\n').trim())
  return { preamble: preamble.join('\n').trim(), sections }
}

function splitOversizedSection(section, limit) {
  for (const level of [3, 4]) {
    const nested = splitSections(section, level)
    if (nested.sections.length > 1) {
      const prefix = nested.preamble
      const out = []
      for (const item of nested.sections) {
        const candidate = [prefix, item].filter(Boolean).join('\n\n')
        if (visibleTextLength(candidate) <= limit) out.push(candidate)
        else out.push(...splitOversizedSection(candidate, limit))
      }
      return out
    }
  }

  const paragraphs = section.split(/\n\s*\n+/).filter(Boolean)
  const out = []
  let current = ''
  for (const paragraph of paragraphs) {
    const candidate = [current, paragraph].filter(Boolean).join('\n\n')
    if (current && visibleTextLength(candidate) > limit) {
      out.push(current)
      current = paragraph
    } else {
      current = candidate
    }
  }
  if (current) out.push(current)
  return out
}

export function splitMarkdownByLength(markdown, limit = 5600) {
  if (visibleTextLength(markdown) <= limit) return [markdown.trim()]

  const top = splitSections(markdown, 2)
  if (!top.sections.length) return splitOversizedSection(markdown, limit)

  const prefix = top.preamble
  const sections = top.sections.flatMap((section) => {
    const candidate = [prefix, section].filter(Boolean).join('\n\n')
    if (visibleTextLength(candidate) <= limit) return [section]
    return splitOversizedSection(section, Math.max(1, limit - visibleTextLength(prefix)))
  })

  const parts = []
  let current = prefix
  for (const section of sections) {
    const candidate = [current, section].filter(Boolean).join('\n\n')
    if (current && current !== prefix && visibleTextLength(candidate) > limit) {
      parts.push(current.trim())
      current = [prefix, section].filter(Boolean).join('\n\n')
    } else if (current === prefix && visibleTextLength(candidate) > limit) {
      if (prefix) parts.push(prefix)
      current = section
    } else {
      current = candidate
    }
  }
  if (current) parts.push(current.trim())
  return parts
}
