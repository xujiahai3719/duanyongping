#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeForDuplicate,
  parseFrontmatter,
  reviewNearDuplicateBlocks,
  splitQuestionAnswerBlocks,
  validateQuestionAnswerIntegrity,
  visibleTextLength,
} from './qanda-cleaning-lib.mjs'
import { findEditorialResidues, validateAuditData } from './qanda-cleaning-audit-lib.mjs'
import { chineseNumber } from './qanda-cleaning-generate-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT_PATH = path.join(ROOT, 'docs', 'content-audits', 'investment-qanda-cleaning-map.json')
const CONTENT_ROOT = path.join(ROOT, 'content', 'dao')
const REDIRECTS_PATH = path.join(ROOT, 'public', '_redirects')
const EXPECTED_VOLUMES = [
  ['投资原则与方法', 12],
  ['商业模式与经营', 12],
  ['公司案例', 15],
  ['人生与成长', 6],
]
const MERGED_COMPANY_SUBSECTIONS = new Map([
  ['wenda-company-consumer-electronics', ['OPPO', 'vivo', '任天堂', '索尼', '松下']],
  ['wenda-company-china-games', ['完美世界', '巨人网络', '金山', '畅游', '第九城市']],
  ['wenda-company-tech-platforms', ['腾讯', '拼多多', '谷歌', '英伟达', '特斯拉']],
  ['wenda-company-retail-services', ['Costco', '新东方']],
  ['wenda-company-energy-industrial', ['OXY（西方石油）', 'GE（通用电气）']],
])

async function contentFiles() {
  const files = []
  const dir = path.join(CONTENT_ROOT, 'qanda')
  for (const name of await readdir(dir)) if (name.endsWith('.md')) files.push(path.join(dir, name))
  return files
}

function requiredMetadata(data, file, errors) {
  for (const field of ['title', 'slug', 'description', 'category', 'seoTitle', 'seoDescription']) {
    if (!data[field]) errors.push(`Missing ${field}: ${path.relative(ROOT, file)}`)
  }
}

async function main() {
  const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'))
  const errors = validateAuditData(audit)
  const warnings = []
  const active = []
  const legacy = []
  const indexes = []
  const slugs = new Map()
  const duplicateParagraphs = new Map()
  const activeBlocks = []
  const editorialResidues = []
  const volumeChapters = new Map(EXPECTED_VOLUMES.map(([volume]) => [volume, []]))

  for (const file of await contentFiles()) {
    const parsed = parseFrontmatter(await readFile(file, 'utf8'))
    requiredMetadata(parsed.data, file, errors)
    if (parsed.data.slug) {
      if (slugs.has(parsed.data.slug)) errors.push(`Duplicate content slug: ${parsed.data.slug}`)
      slugs.set(parsed.data.slug, file)
    }
    if (parsed.data.type === 'legacy-index') legacy.push({ file, ...parsed })
    if (parsed.data.type === 'topic-index') indexes.push({ file, ...parsed })
    if (parsed.data.type !== 'qanda-chapter') continue

    const length = visibleTextLength(parsed.body)
    const article = { file, ...parsed, length }
    active.push(article)
    const articleBlocks = splitQuestionAnswerBlocks(parsed.body, { sourceSlug: parsed.data.slug })
    activeBlocks.push(...articleBlocks)
    for (const block of articleBlocks) {
      for (const integrityError of validateQuestionAnswerIntegrity(block)) {
        errors.push(`Generated Q&A integrity failure: ${integrityError}`)
      }
    }
    if (/-part-\d+$/.test(parsed.data.slug)) errors.push(`Chapter still uses a part slug: ${parsed.data.slug}`)
    if (!volumeChapters.has(parsed.data.volume)) errors.push(`Unknown chapter volume: ${parsed.data.slug}`)
    else volumeChapters.get(parsed.data.volume).push(parsed.data.chapterOrder)
    if (!Number.isInteger(parsed.data.volumeOrder) || !Number.isInteger(parsed.data.chapterOrder)) {
      errors.push(`Chapter needs integer volumeOrder/chapterOrder: ${parsed.data.slug}`)
    }
    if (!Array.isArray(parsed.data.tags) || parsed.data.tags.length < 3 || parsed.data.tags.length > 6) {
      errors.push(`Generated article needs 3-6 tags: ${parsed.data.slug}`)
    }
    for (const residue of findEditorialResidues(parsed.body)) {
      editorialResidues.push({ slug: parsed.data.slug, residue })
      errors.push(`Editorial residue remains: ${parsed.data.slug} (${residue})`)
    }

    const sectionHeadings = [...parsed.body.matchAll(/^## 第(.+?)节\s+(.+)$/gm)]
    if (!sectionHeadings.length) errors.push(`Chapter has no numbered sections: ${parsed.data.slug}`)
    sectionHeadings.forEach((heading, index) => {
      const expected = chineseNumber(index + 1)
      if (heading[1] !== expected) {
        errors.push(`Chapter section order is not continuous: ${parsed.data.slug} (${heading[1]} != ${expected})`)
      }
      if (/相关问答|补充问答/u.test(heading[2])) {
        errors.push(`Generic section heading remains: ${parsed.data.slug} (${heading[2]})`)
      }
    })

    const expectedSubsections = MERGED_COMPANY_SUBSECTIONS.get(parsed.data.slug)
    if (expectedSubsections) {
      const actualSubsections = [...parsed.body.matchAll(/^###\s+(.+)$/gm)].map((match) => match[1].trim())
      if (actualSubsections.join('\n') !== expectedSubsections.join('\n')) {
        errors.push(`Merged company subsections are incomplete or out of order: ${parsed.data.slug}`)
      }
    }

    const sectionBodies = parsed.body.split(/^## 第.+?节\s+.+$/gm).slice(1)
    sectionBodies.forEach((sectionBody, index) => {
      const qandaCount = splitQuestionAnswerBlocks(sectionBody, { sourceSlug: `${parsed.data.slug}-section-${index + 1}` }).length
      const sectionLength = visibleTextLength(sectionBody)
      if (qandaCount < 4 || sectionLength < 600) {
        warnings.push(`Sparse section ${parsed.data.slug} #${index + 1}: ${qandaCount} Q&A, ${sectionLength} chars`)
      }
    })

    for (const paragraph of parsed.body.split(/\n\s*\n+/)) {
      const normalized = normalizeForDuplicate(paragraph)
      const length = Array.from(normalized).length
      if (length > 180 && !/^(?:[-+*]|\d+[.、．]|\|)/.test(paragraph.trim())) {
        warnings.push(`Long paragraph ${length}: ${parsed.data.slug}`)
      }
      if (length < 50) continue
      const entries = duplicateParagraphs.get(normalized) || []
      entries.push(parsed.data.slug)
      duplicateParagraphs.set(normalized, entries)
    }
  }

  // 旧书章节入口页（legacy-index）已于 2026-09 全部删除，旧 URL 改由 public/_redirects 301 到 /wenda-topic-index。
  if (legacy.length !== 0) errors.push(`Expected 0 legacy guides, found ${legacy.length}`)
  if (indexes.length !== 1 || indexes[0]?.data.slug !== 'wenda-topic-index') errors.push('Expected one wenda-topic-index page')
  if (active.length !== 45) errors.push(`Expected 45 qanda chapters, found ${active.length}`)
  if (active.length !== audit.generatedArticles) {
    errors.push(`Manifest lists ${audit.generatedArticles} active articles, found ${active.length}`)
  }

  EXPECTED_VOLUMES.forEach(([volume, expectedCount], volumeIndex) => {
    const chapterOrders = (volumeChapters.get(volume) || []).sort((left, right) => left - right)
    if (chapterOrders.length !== expectedCount) errors.push(`Expected ${expectedCount} chapters in ${volume}, found ${chapterOrders.length}`)
    const expectedOrders = Array.from({ length: expectedCount }, (_, index) => index + 1)
    if (chapterOrders.join(',') !== expectedOrders.join(',')) errors.push(`Non-continuous chapter order in ${volume}`)
    for (const article of active.filter((item) => item.data.volume === volume)) {
      if (article.data.volumeOrder !== volumeIndex + 1) errors.push(`Wrong volumeOrder: ${article.data.slug}`)
    }
  })

  const manifestSlugs = new Set(audit.articles.map((article) => article.slug))
  const fileSlugs = new Set(active.map((article) => article.data.slug))
  for (const slug of manifestSlugs) if (!fileSlugs.has(slug)) errors.push(`Manifest article missing on disk: ${slug}`)
  for (const slug of fileSlugs) if (!manifestSlugs.has(slug)) errors.push(`Generated article missing from manifest: ${slug}`)

  const redirectText = await readFile(REDIRECTS_PATH, 'utf8')
  const redirects = new Map()
  for (const line of redirectText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [from, to, status] = trimmed.split(/\s+/)
    redirects.set(from, { to, status })
  }
  for (const redirect of audit.redirects || []) {
    const actual = redirects.get(redirect.from)
    if (!actual || actual.to !== redirect.to || actual.status !== '301') {
      errors.push(`Missing or invalid part redirect: ${redirect.from} -> ${redirect.to}`)
    }
  }
  for (const redirect of audit.companyRedirects || []) {
    const actual = redirects.get(redirect.from)
    if (!actual || actual.to !== redirect.to || actual.status !== '301') {
      errors.push(`Missing or invalid company redirect: ${redirect.from} -> ${redirect.to}`)
    }
  }

  const repeatedParagraphGroups = [...duplicateParagraphs.entries()]
    .map(([text, articleSlugs]) => ({ text, articleSlugs: [...new Set(articleSlugs)] }))
    .filter((item) => item.articleSlugs.length > 1)
  const outputDuplicateReview = reviewNearDuplicateBlocks(activeBlocks, { threshold: 0.94, minimumLength: 50 })
  const crossArticleDuplicateQanda = outputDuplicateReview.candidates.filter((candidate) => {
    if (candidate.resolution !== 'duplicate-reviewed') return false
    return candidate.leftId.split('#')[0] !== candidate.rightId.split('#')[0]
  })
  for (const candidate of crossArticleDuplicateQanda) {
    errors.push(`Duplicate Q&A across generated articles: ${candidate.leftId} <> ${candidate.rightId}`)
  }

  const result = {
    activeArticles: active.length,
    volumeCounts: Object.fromEntries(EXPECTED_VOLUMES.map(([volume]) => [volume, volumeChapters.get(volume)?.length || 0])),
    partRedirects: audit.redirects?.length || 0,
    companyRedirects: audit.companyRedirects?.length || 0,
    generatedRedirects: redirects.size,
    legacyGuides: legacy.length,
    topicIndexes: indexes.length,
    longestArticle: Math.max(...active.map((article) => article.length)),
    unresolvedNearDuplicates: audit.nearDuplicateCandidates.filter((candidate) => !candidate.resolution).length,
    crossArticleDuplicateQanda: crossArticleDuplicateQanda.length,
    repeatedParagraphGroups: repeatedParagraphGroups.length,
    longParagraphWarnings: warnings.filter((warning) => warning.startsWith('Long paragraph')).length,
    sparseSectionWarnings: warnings.filter((warning) => warning.startsWith('Sparse section')).length,
    editorialChanges: audit.editorialChanges?.length || 0,
    typoCorrections: audit.editorialChanges?.filter((change) => change.type === 'typo-corrected').length || 0,
    formatNormalizations: audit.editorialChanges?.filter((change) => change.type === 'format-normalized').length || 0,
    discardedEditorial: audit.editorialChanges?.filter((change) => change.type.startsWith('discarded-')).length || 0,
    unansweredQuestionsRemoved: audit.records?.filter((record) => record.reason === 'unanswered-question').length || 0,
    manualDecisionsApplied: audit.records?.filter((record) => record.manualDecisionId).length || 0,
    orderingMoves: audit.orderingMoves?.length || 0,
    conversationGroups: audit.conversationGroups?.length || 0,
    integrityErrors: audit.integrityErrors?.length || 0,
    restoredManualDecisions: audit.restoredManualDecisions?.length || 0,
    dangerousNumericChanges: audit.dangerousNumericChanges?.length || 0,
    editorialResidues: editorialResidues.length,
    errors: errors.length,
    warnings: warnings.length,
  }
  console.log(JSON.stringify(result, null, 2))
  if (warnings.length) console.log(warnings.slice(0, 30).map((warning) => `WARN ${warning}`).join('\n'))
  if (errors.length) {
    console.error(errors.slice(0, 100).map((error) => `ERROR ${error}`).join('\n'))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
