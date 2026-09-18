import test from 'node:test'
import assert from 'node:assert/strict'

import { findEditorialResidues, validateAuditData } from '../scripts/qanda-cleaning-audit-lib.mjs'
import { MERGED_COMPANY_REDIRECTS, TOPICS } from '../scripts/qanda-cleaning-config.mjs'

test('audit data accepts complete mappings and reviewed near duplicates', () => {
  const articles = TOPICS.map((topic) => ({
    slug: topic.slug,
    visibleLength: 100000,
    volumeOrder: topic.volumeOrder,
    chapterOrder: topic.chapterOrder,
    tags: topic.tags,
    blockIds: topic.slug === 'wenda-invest-01' ? ['a'] : [],
  }))
  const articleCleaningStats = TOPICS.map((topic) => ({
    slug: topic.slug,
    sourceUnits: topic.slug === 'wenda-invest-01' ? 2 : 1,
    keptUnits: topic.slug === 'wenda-invest-01' ? 1 : 1,
    duplicateUnits: topic.slug === 'wenda-invest-01' ? 1 : 0,
    discardedUnits: 0,
    movedUnits: topic.slug === 'wenda-invest-01' ? 1 : 0,
    conversationGroups: topic.slug === 'wenda-invest-01' ? 1 : 0,
  }))
  const errors = validateAuditData({
    sourceArticles: Array.from({ length: 20 }, (_, index) => ({ slug: `source-${index}` })),
    baseTopics: 45,
    generatedArticles: 45,
    bodyLimit: null,
    articles,
    redirects: [{ from: '/wenda-invest-01-part-1', to: '/wenda-invest-01' }],
    companyRedirects: [...MERGED_COMPANY_REDIRECTS].map(([from, to]) => ({ from: `/${from}`, to: `/${to}` })),
    counts: { editorialChanges: 1 },
    records: [
      {
        id: 'a',
        status: 'kept',
        targetSlugs: ['wenda-invest-01'],
        placement: {
          targetSlug: 'wenda-invest-01',
          sectionTitle: '核心原则',
          subsectionTitle: null,
          stage: 'principle',
          newIndex: 0,
        },
      },
      { id: 'b', status: 'duplicate', duplicateOf: 'a', targetSlugs: ['wenda-invest-01'] },
      { id: 'c', status: 'discarded-no-information', reason: 'pure-reaction' },
    ],
    articleCleaningStats,
    orderingMoves: [{
      blockId: 'a',
      targetSlug: 'wenda-invest-01',
      sectionTitle: '核心原则',
      stage: 'principle',
      originalIndex: 1,
      newIndex: 0,
    }],
    conversationGroups: [{
      id: 'group-a',
      memberIds: ['a'],
      targetSlug: 'wenda-invest-01',
      sectionTitle: '核心原则',
    }],
    integrityErrors: [],
    restoredManualDecisions: [],
    editorialChanges: [{
      blockId: 'a',
      sourceSlug: 'source-0',
      targetSlugs: ['wenda-invest-01'],
      type: 'format-normalized',
      rule: 'repeated-question-mark',
      before: '？？',
      after: '？',
    }],
    dangerousNumericChanges: [],
    nearDuplicateCandidates: [{ leftId: 'a', rightId: 'b', resolution: 'duplicate-reviewed' }],
  })

  assert.deepEqual(errors, [])
})

test('audit data reports metadata, tag, target and unresolved review failures', () => {
  const errors = validateAuditData({
    sourceArticles: [],
    baseTopics: 1,
    generatedArticles: 1,
    articles: [{ slug: 'article', visibleLength: 6001, tags: ['问答'], blockIds: ['missing'] }],
    companyRedirects: [],
    counts: { editorialChanges: 2 },
    records: [
      { id: 'a', status: 'kept', targetSlugs: [] },
      { id: 'b', status: 'discarded-no-information' },
    ],
    articleCleaningStats: [],
    orderingMoves: [{ blockId: 'missing', targetSlug: 'article' }],
    conversationGroups: [{ id: 'broken', memberIds: ['missing'], targetSlug: 'article' }],
    integrityErrors: ['question-without-answer:a'],
    restoredManualDecisions: ['manual-rule-missing'],
    editorialChanges: [{ blockId: 'missing', type: 'unknown', before: '', after: '' }],
    dangerousNumericChanges: [{ blockId: 'a', before: '1499', after: '1500' }],
    nearDuplicateCandidates: [{ leftId: 'a', rightId: 'b' }],
  })

  assert.ok(errors.some((error) => error.includes('20 source articles')))
  assert.ok(errors.some((error) => error.includes('45 base topics')))
  assert.ok(errors.some((error) => error.includes('19 company redirects')))
  assert.ok(errors.some((error) => error.includes('volume/chapter')))
  assert.ok(errors.some((error) => error.includes('tags')))
  assert.ok(errors.some((error) => error.includes('no target')))
  assert.ok(errors.some((error) => error.includes('discard reason')))
  assert.ok(errors.some((error) => error.includes('Editorial change')))
  assert.ok(errors.some((error) => error.includes('Dangerous numeric')))
  assert.ok(errors.some((error) => error.includes('unresolved')))
  assert.ok(errors.some((error) => error.includes('cleaning stats')))
  assert.ok(errors.some((error) => error.includes('Ordering move')))
  assert.ok(errors.some((error) => error.includes('Conversation group')))
  assert.ok(errors.some((error) => error.includes('integrity')))
  assert.ok(errors.some((error) => error.includes('Manual decision')))
  assert.ok(errors.some((error) => error.includes('article block')))
})

test('editorial residue scan reports malformed symbols ordinals typos and known garble', () => {
  const residues = findEditorialResidues([
    '05网友：问题？？',
    '大道：一位博有提到*()*。',
    '大道：除非……d[0we8qfy-97p yvbcn]',
    '_04.__错误的标签_',
    '尾部残留 __',
  ].join('\n'))

  assert.deepEqual(new Set(residues), new Set([
    'empty-markdown-link',
    'repeated-question-mark',
    'obsolete-question-ordinal',
    'known-typo:博有',
    'keyboard-garble',
    'malformed-italic-number-label',
    'trailing-underscore-debris',
  ]))
  assert.deepEqual(findEditorialResidues('网友：问题？\n\n大道：回答。'), [])
})
