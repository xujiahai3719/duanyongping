import { sectionForBlock } from './qanda-cleaning-config.mjs'

export const LOGIC_STAGES = Object.freeze({
  principle: 1,
  definition: 2,
  boundary: 3,
  method: 4,
  case: 5,
  update: 6,
})

function plainText(markdown) {
  return String(markdown || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .normalize('NFKC')
    .trim()
}

function questionText(markdown) {
  const text = plainText(markdown)
  const answer = text.search(/(?:段永平|大道|答)\s*[：:]/u)
  return answer >= 0 ? text.slice(0, answer) : text
}

function dateForBlock(block) {
  const match = plainText(block.markdown).match(/(?:19|20)\d{2}[-./年]\d{1,2}(?:[-./月]\d{1,2})?日?/u)
  if (!match) return null
  const parts = match[0].replace(/[年月./]/g, '-').replace(/日$/, '').split('-')
  return [parts[0], String(parts[1] || 1).padStart(2, '0'), String(parts[2] || 1).padStart(2, '0')].join('-')
}

export function logicStageForBlock(topicSlug, block, sectionInfo = sectionForBlock(topicSlug, block)) {
  const headings = plainText((block.headingPath || []).join(' > '))
  const question = questionText(block.markdown)
  const context = `${headings}\n${question}`
  if (/读者更新|出版后|后续(?:补充|更新)|最新更新/u.test(headings)) {
    return { stage: 'update', rank: LOGIC_STAGES.update, rule: 'source-update-heading' }
  }
  if (topicSlug.startsWith('wenda-company-') || sectionInfo.subsectionTitle || /案例|公司点评/u.test(headings)) {
    return { stage: 'case', rank: LOGIC_STAGES.case, rule: 'company-or-case-context' }
  }
  if (/什么是|什么叫|是什么意思|如何理解|定义|本质/u.test(context)) {
    return { stage: 'definition', rank: LOGIC_STAGES.definition, rule: 'definition-marker' }
  }
  if (/风险|误区|能不能|是否|可不可以|该不该|不能|不该|不要|不懂|看不懂|能力圈|边界|做空|借钱|杠杆/u.test(context)) {
    return { stage: 'boundary', rank: LOGIC_STAGES.boundary, rule: 'boundary-marker' }
  }
  if (/如何|怎么|怎样|什么时候|何时|买入|卖出|持有|估值|判断|选择|操作|学习/u.test(context)) {
    return { stage: 'method', rank: LOGIC_STAGES.method, rule: 'method-marker' }
  }
  return { stage: 'principle', rank: LOGIC_STAGES.principle, rule: 'principle-fallback' }
}

function compareUnits(left, right) {
  if (left.sectionInfo.order !== right.sectionInfo.order) return left.sectionInfo.order - right.sectionInfo.order
  const leftSubsection = left.sectionInfo.subsectionOrder || 0
  const rightSubsection = right.sectionInfo.subsectionOrder || 0
  if (leftSubsection !== rightSubsection) return leftSubsection - rightSubsection
  if (left.stage.rank !== right.stage.rank) return left.stage.rank - right.stage.rank
  if (left.date && right.date) return left.date.localeCompare(right.date) || left.sourceOrder - right.sourceOrder
  if (left.date) return -1
  if (right.date) return 1
  return left.sourceOrder - right.sourceOrder
}

export function orderTopicUnits(topic, blocks) {
  const units = []
  const unitById = new Map()
  blocks.forEach((block, originalIndex) => {
    const groupId = block.conversationGroupId || `${block.id}::singleton`
    let unit = unitById.get(groupId)
    if (!unit) {
      const sectionInfo = block.sectionInfo || sectionForBlock(topic.slug, block)
      unit = {
        id: groupId,
        blocks: [],
        sectionInfo,
        stage: logicStageForBlock(topic.slug, block, sectionInfo),
        date: null,
        sourceOrder: block.sourceOrder ?? originalIndex,
        originalIndex,
      }
      unitById.set(groupId, unit)
      units.push(unit)
    }
    unit.blocks.push({ block, originalIndex })
    const date = dateForBlock(block)
    if (date && (!unit.date || date < unit.date)) unit.date = date
    unit.sourceOrder = Math.min(unit.sourceOrder, block.sourceOrder ?? originalIndex)
    unit.originalIndex = Math.min(unit.originalIndex, originalIndex)
  })

  units.sort(compareUnits)
  const ordered = []
  const placements = new Map()
  const moves = []
  for (const unit of units) {
    unit.blocks.sort((left, right) => (
      (left.block.conversationGroupIndex ?? left.originalIndex)
      - (right.block.conversationGroupIndex ?? right.originalIndex)
    ))
    for (const { block, originalIndex } of unit.blocks) {
      const newIndex = ordered.length
      ordered.push(block)
      const placement = {
        blockId: block.id,
        groupId: block.conversationGroupId || null,
        targetSlug: topic.slug,
        sectionTitle: unit.sectionInfo.title,
        subsectionTitle: unit.sectionInfo.subsectionTitle || null,
        sectionOrder: unit.sectionInfo.order,
        stage: unit.stage.stage,
        stageRank: unit.stage.rank,
        stageRule: unit.stage.rule,
        date: unit.date,
        originalIndex,
        newIndex,
      }
      placements.set(block.id, placement)
      if (originalIndex !== newIndex) moves.push(placement)
    }
  }
  return { ordered, placements, moves }
}
