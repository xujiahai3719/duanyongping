#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  answerFingerprint,
  deduplicateBlocks,
  normalizeForDuplicate,
  parseFrontmatter,
  reviewNearDuplicateBlocks,
  splitQuestionAnswerBlocks,
  validateQuestionAnswerIntegrity,
  visibleTextLength,
} from './qanda-cleaning-lib.mjs'
import {
  MERGED_COMPANY_REDIRECTS,
  TOPICS,
  TOPIC_BY_SLUG,
  VOLUMES,
  classifyBlock,
  sectionForBlock,
} from './qanda-cleaning-config.mjs'
import {
  buildTopicChapter,
  chineseNumber,
  classifyNoInformation,
  renderArticleFile,
} from './qanda-cleaning-generate-lib.mjs'
import { cleanEditorialMarkdown, hasDangerousNumericChange } from './qanda-editorial-cleaning.mjs'
import { applyManualDecisions, MANUAL_DECISIONS } from './qanda-cleaning-decisions.mjs'
import { buildConversationGroups, validateConversationGroups } from './qanda-conversation-groups.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_ROOT = path.join(ROOT, 'content', 'dao')
const AUDIT_PATH = path.join(ROOT, 'docs', 'content-audits', 'investment-qanda-cleaning-map.json')
const REDIRECTS_PATH = path.join(ROOT, 'public', '_redirects')
const WRITE = process.argv.includes('--write')

let priorityBySlug = new Map()

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

function originalSourcePaths(sourceCommit) {
  // 读的是「历史提交」里的原始问答文件，那时它们分散在 qanda / investment-logic / business-logic
  // 三个目录（2026-09 合并成一个 qanda/）：保留三条 pathspec 才能同时兼容合并前后的提交。
  return git(['ls-tree', '-r', '--name-only', sourceCommit, '--', 'content/dao/qanda', 'content/dao/investment-logic', 'content/dao/business-logic'])
    .split(/\r?\n/)
    .filter((file) => file.endsWith('.md'))
}

function readSourceFile(sourceCommit, file) {
  return git(['show', `${sourceCommit}:${file}`])
}

function loadSources(sourceCommit, sourceSlugs) {
  const sources = []
  for (const file of originalSourcePaths(sourceCommit)) {
    const raw = readSourceFile(sourceCommit, file)
    const parsed = parseFrontmatter(raw)
    if (parsed.data.category !== '投资问答录' || !sourceSlugs.has(parsed.data.slug)) continue
    sources.push({ file, raw, ...parsed })
  }
  sources.sort((left, right) => {
    const leftPriority = priorityBySlug.get(left.data.slug) ?? 999
    const rightPriority = priorityBySlug.get(right.data.slug) ?? 999
    return leftPriority - rightPriority
  })
  if (sources.length !== 20) throw new Error(`Expected 20 source articles, found ${sources.length}`)
  return sources
}

function buildBlocks(sources) {
  let sourceOrder = 0
  return sources.flatMap((source) => splitQuestionAnswerBlocks(source.body, { sourceSlug: source.data.slug })
    .map((block) => ({
      ...block,
      sourceFile: source.file,
      sourceTitle: source.data.title,
      sourceOrder: sourceOrder++,
    })))
}

function buildArticles(blocks) {
  const grouped = new Map(TOPICS.map((topic) => [topic.slug, []]))
  for (const block of blocks) {
    const topicSlug = block.targetSlug || classifyBlock(block)
    if (!topicSlug || !grouped.has(topicSlug)) throw new Error(`Unclassified block: ${block.id}`)
    grouped.get(topicSlug).push(block)
  }

  const articles = []
  for (const topic of TOPICS) {
    const topicBlocks = grouped.get(topic.slug)
    if (!topicBlocks.length) throw new Error(`Topic has no content: ${topic.slug}`)
    articles.push(buildTopicChapter(topic, topicBlocks))
  }
  return articles
}

function prepareRetainedBlocks(blocks, sourceGroups) {
  const prepared = blocks.map((block) => {
    const targetSlug = classifyBlock(block)
    if (!targetSlug) throw new Error(`Unclassified block: ${block.id}`)
    return {
      ...block,
      targetSlug,
      sectionInfo: sectionForBlock(targetSlug, block),
    }
  })
  const blockById = new Map(prepared.map((block) => [block.id, block]))
  const conversationGroups = []
  for (const group of sourceGroups) {
    const members = group.memberIds.map((id) => blockById.get(id)).filter(Boolean)
    if (members.length < 2) continue
    const groupTargetSlug = members[0].targetSlug
    const groupSectionInfo = members[0].sectionInfo
    members.forEach((block, index) => {
      block.conversationGroupId = group.id
      block.conversationGroupIndex = index
      block.targetSlug = groupTargetSlug
      block.sectionInfo = groupSectionInfo
    })
    conversationGroups.push({ ...group, memberIds: members.map((block) => block.id) })
  }
  return { prepared, conversationGroups }
}

function buildArticleCleaningStats(allBlocks, records, articles, orderingMoves, conversationGroups) {
  const stats = new Map(TOPICS.map((topic) => [topic.slug, {
    slug: topic.slug,
    sourceUnits: 0,
    keptUnits: 0,
    duplicateUnits: 0,
    discardedUnits: 0,
    movedUnits: 0,
    conversationGroups: 0,
  }]))
  const sourceTargetById = new Map()
  for (const block of allBlocks) {
    const targetSlug = classifyBlock(block)
    if (!targetSlug || !stats.has(targetSlug)) throw new Error(`Unclassified source block: ${block.id}`)
    sourceTargetById.set(block.id, targetSlug)
    stats.get(targetSlug).sourceUnits += 1
  }
  for (const record of records) {
    const targetSlug = record.targetSlugs?.[0] || sourceTargetById.get(record.id)
    if (!targetSlug || !stats.has(targetSlug)) continue
    if (record.status === 'kept') stats.get(targetSlug).keptUnits += 1
    else if (record.status === 'duplicate') stats.get(targetSlug).duplicateUnits += 1
    else stats.get(targetSlug).discardedUnits += 1
  }
  for (const move of orderingMoves) stats.get(move.targetSlug).movedUnits += 1
  for (const group of conversationGroups) stats.get(group.targetSlug).conversationGroups += 1
  for (const article of articles) {
    if (!stats.has(article.slug)) throw new Error(`Missing article cleaning stats: ${article.slug}`)
  }
  return [...stats.values()]
}

function nearDuplicateCanonical(left, right) {
  const score = (block) => (block.hasQuestion ? 100 : 0)
    + (block.hasAnswer ? 100 : 0)
    + (block.headingPath?.length || 0) * 10
    + Math.min(visibleTextLength(block.markdown), 2000) / 2000
    - (priorityBySlug.get(block.sourceSlug) ?? 999) / 1000
  return score(left) >= score(right) ? left : right
}

function reviewNearDuplicates(blocks) {
  return reviewNearDuplicateBlocks(blocks, {
    threshold: 0.94,
    minimumLength: 50,
    canonical: nearDuplicateCanonical,
  })
}

function headingId(value) {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function renderIndexFile(articles) {
  const body = VOLUMES.map((volume) => {
    const chapters = articles
      .filter((article) => article.volumeOrder === volume.order)
      .sort((left, right) => left.chapterOrder - right.chapterOrder)
      .map((article) => {
        const sections = [...article.body.matchAll(/^(#{2,3})\s+(.+)$/gm)]
          .map((match) => `${match[1] === '###' ? '  ' : ''}- [${match[2]}](/${article.slug}#${headingId(match[2])})`)
          .join('\n')
        return `### 第${chineseNumber(article.chapterOrder)}章 [${article.title}](/${article.slug})\n\n${sections}`
      })
      .join('\n\n')
    return `## 第${chineseNumber(volume.order)}卷 ${volume.name}\n\n${chapters}`
  }).join('\n\n')
  const description = '按投资原则、商业经营、公司案例、人生与成长整理的段永平投资问答主题目录。'
  return [
    '---',
    'title: "投资问答录主题目录"',
    'slug: "wenda-topic-index"',
    `description: ${JSON.stringify(description)}`,
    'category: "投资问答录"',
    'order: 190',
    'seoTitle: "投资问答录主题目录｜段永平投资问答录"',
    `seoDescription: ${JSON.stringify(description)}`,
    'type: "topic-index"',
    'tags: ["投资问答录","主题目录","投资原则","商业经营","公司案例","人生与成长"]',
    '---',
    '',
    body,
    '',
  ].join('\n')
}

function renderLegacyFile(source, targetSlugs) {
  const targets = new Set(targetSlugs)
  const links = TOPICS
    .filter((topic) => targets.has(topic.slug))
    .map((topic) => `- [${topic.title}](/${topic.slug})`)
    .join('\n')
  const description = `${source.data.title}已按主题拆分，本页保留旧地址并提供新文章入口。`
  return [
    '---',
    `title: ${JSON.stringify(source.data.title)}`,
    `slug: ${JSON.stringify(source.data.slug)}`,
    `description: ${JSON.stringify(description)}`,
    'category: "投资问答录"',
    `order: ${source.data.order}`,
    `seoTitle: ${JSON.stringify(`${source.data.title}｜主题迁移导读`)}`,
    `seoDescription: ${JSON.stringify(description)}`,
    'type: "legacy-index"',
    'tags: ["投资问答录","旧版导读","主题索引"]',
    '---',
    '',
    '## 本章内容已按主题重组',
    '',
    '原地址继续保留。正文已去重并迁移到以下主题文章：',
    '',
    links || '- [投资问答录主题目录](/wenda-topic-index)',
    '',
    '完整目录见：[投资问答录主题目录](/wenda-topic-index)。',
    '',
  ].join('\n')
}

async function removeGeneratedFiles() {
  const dir = path.join(CONTENT_ROOT, 'qanda')
  for (const name of await readdir(dir)) {
    if (/^wenda-(?:invest|business|company|life)-.+\.md$/.test(name) || name === 'wenda-topic-index.md') {
      await rm(path.join(dir, name))
    }
  }
}

async function collectPartRedirects() {
  const redirects = []
  const dir = path.join(CONTENT_ROOT, 'qanda')
  for (const name of await readdir(dir)) {
    const match = name.match(/^(wenda-(?:invest|business|company|life)-.+)-part-(\d+)\.md$/)
    if (!match) continue
    redirects.push({ from: `/${match[1]}-part-${match[2]}`, to: `/${match[1]}` })
  }
  return redirects.sort((left, right) => left.from.localeCompare(right.from, 'en', { numeric: true }))
}

async function writePartRedirects(redirects) {
  let existing = ''
  try {
    existing = await readFile(REDIRECTS_PATH, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const start = '# BEGIN GENERATED QANDA CHAPTER REDIRECTS'
  const end = '# END GENERATED QANDA CHAPTER REDIRECTS'
  const block = [start, ...redirects.map((item) => `${item.from} ${item.to} 301`), end].join('\n')
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'g')
  const withoutGenerated = existing.replace(pattern, '').trim()
  const output = withoutGenerated ? `${withoutGenerated}\n\n${block}\n` : `${block}\n`
  await writeFile(REDIRECTS_PATH, output, 'utf8')
}

function activeRedirectTarget(pathname) {
  const slug = String(pathname || '').replace(/^\//, '')
  return `/${MERGED_COMPANY_REDIRECTS.get(slug) || slug}`
}

function buildCompanyRedirects() {
  return [...MERGED_COMPANY_REDIRECTS].map(([from, to]) => ({ from: `/${from}`, to: `/${to}` }))
}

async function pinnedSourceManifest() {
  const existingAudit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'))
  let committedAudit = null
  if (!Array.isArray(existingAudit.redirects) || existingAudit.redirects.length === 0) {
    committedAudit = JSON.parse(git(['show', `HEAD:${path.relative(ROOT, AUDIT_PATH)}`]))
  }
  const redirects = existingAudit.redirects?.length ? existingAudit.redirects : committedAudit?.redirects
  if (!/^[0-9a-f]{40}$/.test(existingAudit.sourceCommit || '')) {
    throw new Error('Existing audit does not contain a valid pinned sourceCommit')
  }
  if (!Array.isArray(existingAudit.sourceArticles) || existingAudit.sourceArticles.length !== 20) {
    throw new Error('Existing audit does not contain the expected 20 sourceArticles')
  }
  if (!Array.isArray(redirects) || redirects.length !== 208) {
    throw new Error(`Expected 208 persisted part redirects, found ${redirects?.length || 0}`)
  }
  return {
    sourceCommit: existingAudit.sourceCommit,
    sourceArticles: existingAudit.sourceArticles,
    redirects,
  }
}

async function main() {
  const { sourceCommit, sourceArticles, redirects } = await pinnedSourceManifest()
  const partRedirects = redirects.map((redirect) => ({ ...redirect, to: activeRedirectTarget(redirect.to) }))
  const companyRedirects = buildCompanyRedirects()
  priorityBySlug = new Map(sourceArticles.map((source, index) => [source.slug, index]))
  const sources = loadSources(sourceCommit, new Set(sourceArticles.map((source) => source.slug)))
  const sourceBlocks = buildBlocks(sources)
  const editorialChangesByBlock = new Map()
  const dangerousNumericChanges = []
  const allBlocks = sourceBlocks.map((block) => {
    const editorial = cleanEditorialMarkdown(block.markdown, { blockId: block.id })
    editorialChangesByBlock.set(block.id, editorial.changes)
    if (editorial.changes.length && hasDangerousNumericChange(editorial.numericBaseline, editorial.markdown)) {
      dangerousNumericChanges.push({ blockId: block.id, before: block.markdown, after: editorial.markdown })
    }
    return { ...block, markdown: editorial.markdown }
  })
  const manualResult = applyManualDecisions(allBlocks, MANUAL_DECISIONS)
  const manualDiscardedById = new Map(manualResult.discarded.map((item) => [item.block.id, item]))
  const noInformationStates = new Map(manualResult.kept.map((block) => [block.id, classifyNoInformation(block)]))
  const noInformation = manualResult.kept.filter((block) => noInformationStates.get(block.id).discard)
  const noInformationIds = new Set(noInformation.map((block) => block.id))
  const informative = manualResult.kept.filter((block) => !noInformationIds.has(block.id))
  const integrityErrors = informative.flatMap((block) => validateQuestionAnswerIntegrity(block))
  if (integrityErrors.length) {
    throw new Error(`Question and answer integrity failed:\n${integrityErrors.slice(0, 30).join('\n')}`)
  }
  const sourceConversationGroups = buildConversationGroups(informative)
  const deduplicated = deduplicateBlocks(informative, { minimumLength: 30, fingerprint: answerFingerprint })
  const dedupAudit = new Map(deduplicated.audit.map((item) => [item.id, item]))
  const nearReview = reviewNearDuplicates(deduplicated.kept)
  const retained = prepareRetainedBlocks(nearReview.kept, sourceConversationGroups)
  const articles = buildArticles(retained.prepared)

  const blockTargets = new Map()
  const placementByBlockId = new Map()
  const orderingMoves = []
  for (const article of articles) {
    for (const blockId of article.blockIds) {
      const targets = blockTargets.get(blockId) || []
      targets.push(article.slug)
      blockTargets.set(blockId, [...new Set(targets)])
    }
    for (const [blockId, placement] of article.placements) placementByBlockId.set(blockId, placement)
    orderingMoves.push(...article.orderingMoves.map((move) => ({
      blockId: move.blockId,
      groupId: move.groupId,
      targetSlug: move.targetSlug,
      sectionTitle: move.sectionTitle,
      subsectionTitle: move.subsectionTitle,
      stage: move.stage,
      stageRule: move.stageRule,
      date: move.date,
      originalIndex: move.originalIndex,
      newIndex: move.newIndex,
    })))
  }
  const conversationIntegrityErrors = validateConversationGroups(retained.conversationGroups, placementByBlockId)
  if (conversationIntegrityErrors.length) {
    throw new Error(`Conversation group integrity failed:\n${conversationIntegrityErrors.join('\n')}`)
  }
  const conversationGroups = retained.conversationGroups.map((group) => {
    const placement = placementByBlockId.get(group.memberIds[0])
    return {
      id: group.id,
      sourceSlug: group.sourceSlug,
      memberIds: group.memberIds,
      targetSlug: placement.targetSlug,
      sectionTitle: placement.sectionTitle,
      subsectionTitle: placement.subsectionTitle,
      date: group.date,
    }
  })

  const nearDuplicateCandidates = nearReview.candidates

  const records = allBlocks.map((block) => {
    if (manualDiscardedById.has(block.id)) {
      return {
        id: block.id,
        sourceSlug: block.sourceSlug,
        headingPath: block.headingPath,
        status: 'discarded-no-information',
        reason: manualDiscardedById.get(block.id).decision.reason,
        manualDecisionId: manualDiscardedById.get(block.id).decision.id,
      }
    }
    if (noInformationIds.has(block.id)) {
      return {
        id: block.id,
        sourceSlug: block.sourceSlug,
        headingPath: block.headingPath,
        status: 'discarded-no-information',
        reason: noInformationStates.get(block.id).reason,
      }
    }
    const state = dedupAudit.get(block.id)
    if (state?.status === 'duplicate') {
      const canonical = nearReview.resolve(state.duplicateOf)
      return {
        id: block.id,
        sourceSlug: block.sourceSlug,
        headingPath: block.headingPath,
        status: 'duplicate',
        duplicateOf: canonical,
        targetSlugs: blockTargets.get(canonical) || [],
      }
    }
    if (nearReview.duplicateOf.has(block.id)) {
      const canonical = nearReview.resolve(block.id)
      return {
        id: block.id,
        sourceSlug: block.sourceSlug,
        headingPath: block.headingPath,
        status: 'duplicate',
        duplicateOf: canonical,
        targetSlugs: blockTargets.get(canonical) || [],
      }
    }
    return {
      id: block.id,
      sourceSlug: block.sourceSlug,
      headingPath: block.headingPath,
      status: 'kept',
      targetSlugs: blockTargets.get(block.id) || [],
      placement: placementByBlockId.has(block.id) ? {
        targetSlug: placementByBlockId.get(block.id).targetSlug,
        sectionTitle: placementByBlockId.get(block.id).sectionTitle,
        subsectionTitle: placementByBlockId.get(block.id).subsectionTitle,
        stage: placementByBlockId.get(block.id).stage,
        newIndex: placementByBlockId.get(block.id).newIndex,
      } : undefined,
    }
  })

  const recordById = new Map(records.map((record) => [record.id, record]))
  const blockById = new Map(sourceBlocks.map((block) => [block.id, block]))
  const editorialChanges = []
  for (const [blockId, changes] of editorialChangesByBlock) {
    const block = blockById.get(blockId)
    const record = recordById.get(blockId)
    for (const change of changes) {
      editorialChanges.push({
        ...change,
        sourceSlug: block.sourceSlug,
        targetSlugs: record?.targetSlugs || [],
      })
    }
  }
  for (const block of noInformation) {
    const state = noInformationStates.get(block.id)
    editorialChanges.push({
      blockId: block.id,
      sourceSlug: block.sourceSlug,
      targetSlugs: [],
      type: 'discarded-no-information',
      rule: state.reason,
      before: block.markdown,
      after: '',
    })
  }
  for (const { block, decision } of manualResult.discarded) {
    editorialChanges.push({
      blockId: block.id,
      sourceSlug: block.sourceSlug,
      targetSlugs: [],
      type: 'discarded-no-information',
      rule: decision.reason,
      before: block.markdown,
      after: '',
      manualDecisionId: decision.id,
    })
  }
  for (const change of manualResult.fragmentChanges) {
    const block = blockById.get(change.blockId)
    const record = recordById.get(change.blockId)
    editorialChanges.push({
      blockId: change.blockId,
      sourceSlug: block.sourceSlug,
      targetSlugs: record?.targetSlugs || [],
      type: 'format-normalized',
      rule: change.reason,
      before: change.before,
      after: change.after,
      manualDecisionId: change.decisionId,
    })
  }

  const articleCleaningStats = buildArticleCleaningStats(
    allBlocks,
    records,
    articles,
    orderingMoves,
    conversationGroups,
  )

  const audit = {
    version: 2,
    sourceCommit,
    sourceArticles: sources.map((source) => ({ file: source.file, slug: source.data.slug, title: source.data.title })),
    baseTopics: TOPICS.length,
    generatedArticles: articles.length,
    bodyLimit: null,
    counts: {
      sourceBlocks: allBlocks.length,
      keptBlocks: records.filter((item) => item.status === 'kept').length,
      duplicateBlocks: records.filter((item) => item.status === 'duplicate').length,
      discardedNoInformation: records.filter((item) => item.status === 'discarded-no-information').length,
      nearDuplicateCandidates: nearDuplicateCandidates.length,
      editorialChanges: editorialChanges.length,
    },
    articles: articles.map((article) => ({
      slug: article.slug,
      baseSlug: article.baseSlug,
      title: article.title,
      group: article.group,
      volume: article.volume,
      volumeOrder: article.volumeOrder,
      chapterOrder: article.chapterOrder,
      order: article.order,
      tags: article.tags,
      visibleLength: visibleTextLength(article.body),
      blockIds: article.blockIds,
    })),
    articleCleaningStats,
    orderingMoves,
    conversationGroups,
    integrityErrors: [...integrityErrors, ...conversationIntegrityErrors],
    restoredManualDecisions: [],
    redirects: partRedirects,
    companyRedirects,
    editorialChanges,
    dangerousNumericChanges,
    nearDuplicateCandidates,
    records,
  }

  console.log(JSON.stringify({
    sources: sources.length,
    sourceBlocks: allBlocks.length,
    informativeBlocks: informative.length,
    keptBlocks: nearReview.kept.length,
    generatedArticles: articles.length,
    nearDuplicateCandidates: nearDuplicateCandidates.length,
    editorialChanges: editorialChanges.length,
    dangerousNumericChanges: dangerousNumericChanges.length,
    longestArticle: Math.max(...audit.articles.map((article) => article.visibleLength)),
    orderingMoves: orderingMoves.length,
    conversationGroups: conversationGroups.length,
    manualDiscards: manualResult.discarded.length,
  }, null, 2))

  if (!WRITE) {
    console.log('Dry run only. Pass --write to generate files.')
    return
  }

  await removeGeneratedFiles()
  for (const article of articles) {
    const topic = TOPIC_BY_SLUG.get(article.baseSlug)
    const target = path.join(CONTENT_ROOT, topic.directory, `${article.slug}.md`)
    await writeFile(target, renderArticleFile(article), 'utf8')
  }
  await writeFile(path.join(CONTENT_ROOT, 'qanda', 'wenda-topic-index.md'), renderIndexFile(articles), 'utf8')
  await writePartRedirects([...partRedirects, ...companyRedirects])

  const recordBySource = new Map()
  for (const record of records) {
    const list = recordBySource.get(record.sourceSlug) || []
    list.push(record)
    recordBySource.set(record.sourceSlug, list)
  }
  for (const source of sources) {
    const targetSlugs = [...new Set((recordBySource.get(source.data.slug) || []).flatMap((record) => record.targetSlugs || []))]
    await writeFile(path.join(ROOT, source.file), renderLegacyFile(source, targetSlugs), 'utf8')
  }

  await mkdir(path.dirname(AUDIT_PATH), { recursive: true })
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${articles.length} chapters, 1 topic index, 20 legacy guides, ${partRedirects.length} part redirects, ${companyRedirects.length} company redirects and ${path.relative(ROOT, AUDIT_PATH)}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
