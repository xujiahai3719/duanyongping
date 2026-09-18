function plainText(markdown) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

function blockDate(block) {
  const match = String(block.markdown || '').normalize('NFKC').match(/(?:19|20)\d{2}[-./年]\d{1,2}(?:[-./月]\d{1,2})?日?/u)
  if (!match) return null
  const parts = match[0].replace(/[年月./]/g, '-').replace(/日$/, '').split('-')
  return [parts[0], String(parts[1] || 1).padStart(2, '0'), String(parts[2] || 1).padStart(2, '0')].join('-')
}

function sameHeading(left, right) {
  return JSON.stringify(left.headingPath || []) === JSON.stringify(right.headingPath || [])
}

function explicitContinuation(block) {
  const text = plainText(block.markdown)
  return /^(?:网友|读者|用户|投资者)?\s*(?:追问|续问|补充问)[^：:]{0,20}[：:]/u.test(text)
    || /^(?:网友|读者|用户|投资者)[^：:]{0,20}[：:]\s*(?:那为什么|那么为什么|上述|这个问题|那这个|接着问)/u.test(text)
}

function sameDateSupplement(previous, block) {
  const previousDate = blockDate(previous)
  return Boolean(
    previousDate
    && previousDate === blockDate(block)
    && !block.hasQuestion
    && block.hasAnswer,
  )
}

function createGroup(block) {
  return {
    id: `${block.id}::conversation`,
    sourceSlug: block.sourceSlug,
    memberIds: [block.id],
    blocks: [block],
    date: blockDate(block),
    sourceOrder: block.sourceOrder,
  }
}

export function buildConversationGroups(blocks) {
  const groups = []
  for (const block of blocks) {
    const previousGroup = groups.at(-1)
    const previous = previousGroup?.blocks.at(-1)
    const shouldJoin = previous
      && previous.sourceSlug === block.sourceSlug
      && sameHeading(previous, block)
      && (explicitContinuation(block) || sameDateSupplement(previous, block))
    if (!shouldJoin) {
      groups.push(createGroup(block))
      continue
    }
    previousGroup.memberIds.push(block.id)
    previousGroup.blocks.push(block)
    if (!previousGroup.date) previousGroup.date = blockDate(block)
  }
  return groups
}

export function validateConversationGroups(groups, placementByBlockId) {
  const errors = []
  for (const group of groups) {
    const placements = group.memberIds
      .map((id) => placementByBlockId.get(id))
      .filter(Boolean)
    if (placements.length <= 1) continue
    const keys = new Set(placements.map((placement) => `${placement.targetSlug}\n${placement.sectionTitle}`))
    if (keys.size > 1) errors.push(`split-conversation-group:${group.id}`)
  }
  return errors
}
