import assert from 'node:assert/strict'
import test from 'node:test'

import puppeteer from 'puppeteer'

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

// 搜索浮层 → 点击结果 → 跳到正文对应小节 → 命中词临时高亮
test('sidebar search shows a result panel and jumps to the matched section', { timeout: 180_000 }, async (t) => {
  const browser = await puppeteer.launch({ headless: true })
  t.after(() => browser.close())

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2' })

  const input = await page.$('.sidebar-search input')
  assert.ok(input, '侧边栏应有搜索框')

  // 聚焦时才懒加载全文索引
  await input.click()
  await page.type('.sidebar-search input', '长坡厚雪', { delay: 30 })

  const panel = await page.waitForSelector('.search-panel', { visible: true, timeout: 60_000 })
  assert.ok(panel, '输入后应弹出结果浮层')

  // 索引就绪前先给元数据结果，就绪后是带片段的结果；等片段出现
  await page.waitForFunction(
    () => document.querySelectorAll('.search-panel .search-hit').length > 0,
    { timeout: 60_000 },
  )
  await page.waitForFunction(
    () => document.querySelectorAll('.search-panel .search-hit-mark').length > 0,
    { timeout: 60_000 },
  )

  const hits = await page.$$eval('.search-panel .search-hit', (rows) => rows.map((row) => ({
    title: row.querySelector('.search-hit-title')?.textContent?.trim() || '',
    crumb: row.querySelector('.search-hit-crumb')?.textContent?.trim() || '',
    snippet: row.querySelector('.search-hit-snippet')?.textContent?.trim() || '',
    marks: [...row.querySelectorAll('.search-hit-mark')].map((mark) => mark.textContent || ''),
  })))

  assert.ok(hits.length > 0, '应有结果行')
  assert.ok(hits[0].title.length > 0, '结果行应显示文章名')
  assert.ok(hits[0].snippet.length > 10, '结果行应显示命中片段')
  assert.ok(hits[0].marks.length > 0, '命中词应被标记为高亮')
  assert.ok(
    hits[0].marks.every((mark) => mark.includes('长坡厚雪')),
    '高亮段应当就是检索词',
  )

  // 浮层贴在搜索框正下方，且左右边缘与搜索框（含外框）严格对齐
  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`missing ${selector}`)
      return el.getBoundingClientRect()
    }
    const box = rect('.sidebar-search')
    const input = rect('.sidebar-search input')
    const panel = rect('.search-panel')
    return {
      boxLeft: box.left,
      boxRight: box.right,
      boxWidth: box.width,
      inputBottom: input.bottom,
      panelTop: panel.top,
      panelLeft: panel.left,
      panelRight: panel.right,
      panelWidth: panel.width,
      viewportWidth: window.innerWidth,
    }
  })
  assert.ok(geometry.panelTop >= geometry.inputBottom - 1, '浮层应贴在输入框下方')
  assert.ok(
    Math.abs(geometry.panelLeft - geometry.boxLeft) <= 1,
    `浮层左边缘应与搜索框对齐（搜索框 ${geometry.boxLeft} vs 浮层 ${geometry.panelLeft}）`,
  )
  assert.ok(
    Math.abs(geometry.panelRight - geometry.boxRight) <= 1,
    `浮层右边缘应与搜索框对齐（搜索框 ${geometry.boxRight} vs 浮层 ${geometry.panelRight}）`,
  )
  assert.ok(
    geometry.panelWidth >= geometry.boxWidth - 1,
    `浮层不应窄于搜索框（搜索框 ${geometry.boxWidth} vs 浮层 ${geometry.panelWidth}）`,
  )
  assert.ok(
    geometry.panelRight <= geometry.viewportWidth,
    `浮层不应超出视口（右边缘 ${geometry.panelRight} > 视口 ${geometry.viewportWidth}）`,
  )

  // 浮层被 Teleport 到 body，拿不到 .sidebar 里的 --sb-*；一旦这些令牌没在主题层
  // 定义好，颜色会静默回退成写死的白底（绿色/深色主题下会突兀成白卡片）
  const themed = await page.evaluate(() => {
    const panel = document.querySelector('.search-panel')
    if (!panel) return null
    const style = getComputedStyle(panel)

    // color-mix 的结果可能是 color(srgb …) / oklab(…) 等格式，交给浏览器自己归一化
    const toRgb = (value) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d')
      if (!context) return [0, 0, 0]
      context.fillStyle = '#000'
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
      return [red ?? 0, green ?? 0, blue ?? 0]
    }

    // 契约：浮层底色 = mix(主题 --bg 96%, 主题 --fg)，也就是必须跟着主题走
    const bg = toRgb(style.getPropertyValue('--sb-bg').trim() || 'rgb(255,255,255)')
    const fg = toRgb(style.getPropertyValue('--sb-fg').trim() || 'rgb(0,0,0)')
    const expected = bg.map((channel, index) => channel * 0.96 + (fg[index] ?? 0) * 0.04)

    return {
      resolvedBg: style.getPropertyValue('--sb-bg').trim(),
      panelBg: toRgb(style.backgroundColor),
      expected,
      raw: style.backgroundColor,
    }
  })
  assert.ok(themed, '应能读到浮层计算样式')
  assert.ok(themed.resolvedBg, '浮层根节点上应能解析出 --sb-bg（说明主题令牌可用，没走兜底）')

  const drift = Math.max(...themed.panelBg.map((channel, index) => Math.abs(channel - themed.expected[index])))
  assert.ok(
    drift <= 2,
    `浮层底色应等于「主题底色 96% + 主题前景色 4%」（期望 ${themed.expected.map((c) => Math.round(c))}，实际 ${themed.panelBg} / ${themed.raw}）`,
  )
  assert.ok(
    !themed.panelBg.every((channel) => channel === 255),
    `浮层底色不应是写死的白色（实际 ${themed.raw}）`,
  )

  // 点第一条 → 跳到该小节锚点
  const firstHitAnchor = await page.evaluate(() => {
    const row = document.querySelector('.search-panel .search-hit')
    row?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    return true
  })
  assert.ok(firstHitAnchor)

  await page.click('.search-panel .search-hit')

  // 等真的落到文章页，并且锚点元素已经渲染出来
  await page.waitForFunction(() => Boolean(location.hash) && location.pathname !== '/', { timeout: 30_000 })
  const anchorId = await page.evaluate(() => decodeURIComponent(location.hash.replace(/^#/, '')))
  await page.waitForFunction(
    (id) => Boolean(document.getElementById(id)),
    { timeout: 30_000 },
    anchorId,
  )

  const afterNav = await page.evaluate(() => ({
    hash: decodeURIComponent(location.hash.replace(/^#/, '')),
    path: location.pathname,
    anchorExists: Boolean(document.getElementById(decodeURIComponent(location.hash.replace(/^#/, '')))),
    highlighted: document.querySelectorAll('.prose mark.search-hit').length,
    panelGone: !document.querySelector('.search-panel'),
    queryCleared: (document.querySelector('.sidebar-search input'))?.value === '',
  }))

  assert.notEqual(afterNav.path, '/', '应跳到文章页')
  assert.ok(afterNav.hash.length > 0, 'URL 应带上小节锚点')
  assert.ok(afterNav.anchorExists, '锚点元素应存在于正文里')
  assert.ok(afterNav.panelGone, '跳转后浮层应关闭')
  assert.ok(afterNav.queryCleared, '跳转后搜索框应清空')

  await page.waitForFunction(
    () => document.querySelectorAll('.prose mark.search-hit').length > 0,
    { timeout: 15_000 },
  )
  assert.ok(
    await page.$$eval('.prose mark.search-hit', (marks) => marks.length > 0),
    '正文里应出现命中词高亮',
  )

  // 小节应被滚到视口附近（不是停在文章顶部）：平滑滚动需要几百毫秒，等它稳定下来
  await page.waitForFunction(
    () => (document.querySelector('.main-area')?.scrollTop ?? 0) > 0,
    { timeout: 15_000 },
  )
  await new Promise((resolve) => setTimeout(resolve, 700))

  const landed = await page.evaluate(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    const el = document.getElementById(id)
    const scroller = document.querySelector('.main-area')
    return {
      scrollerTop: Math.round(scroller?.scrollTop ?? -1),
      titleTop: Math.round(el?.getBoundingClientRect().top ?? -1),
    }
  })
  assert.ok(landed.scrollerTop > 0, '应真的滚动了（不是停在文章顶部）')
  assert.ok(landed.titleTop >= 0 && landed.titleTop < 300, `小节标题应落在视口上方（实际 ${landed.titleTop}px）`)

  // 高亮是临时的：几秒后自动撤回
  await page.waitForFunction(
    () => document.querySelectorAll('.prose mark.search-hit').length === 0,
    { timeout: 15_000 },
  )

  const marksAfter = await page.$$eval('.prose mark.search-hit', (marks) => marks.length)
  assert.equal(marksAfter, 0, '高亮应自动撤掉')
})

// 键盘操作与浮层关闭：↑↓ 选择、Enter 跳转、Esc 关闭、点外部关闭
test('search panel supports keyboard navigation and closes on Escape / outside click', { timeout: 180_000 }, async (t) => {
  const browser = await puppeteer.launch({ headless: true })
  t.after(() => browser.close())

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2' })

  const input = await page.$('.sidebar-search input')
  await input.click()
  await page.type('.sidebar-search input', '安全边际', { delay: 30 })
  await page.waitForFunction(
    () => document.querySelectorAll('.search-panel .search-hit').length > 1,
    { timeout: 60_000 },
  )

  // ↓ 高亮下移一行
  await page.keyboard.press('ArrowDown')
  const activeIndex = await page.$eval('.search-panel .search-hit.active', (row) => Number(row.dataset.index))
  assert.equal(activeIndex, 1, '↓ 应把选中项移到第二行')

  await page.keyboard.press('ArrowUp')
  const backIndex = await page.$eval('.search-panel .search-hit.active', (row) => Number(row.dataset.index))
  assert.equal(backIndex, 0, '↑ 应回到第一行')

  // Enter 直接跳第一条
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname !== '/', { timeout: 30_000 })
  assert.notEqual(await page.evaluate(() => location.pathname), '/', 'Enter 应跳转到结果文章')

  // Esc 关闭浮层但不跳转（换一页重来一遍，避免和上一步的跳转搅在一起）
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2' })
  const escInput = await page.$('.sidebar-search input')
  await escInput.click()
  await page.type('.sidebar-search input', '安全边际', { delay: 20 })
  await page.waitForSelector('.search-panel .search-hit', { visible: true, timeout: 60_000 })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.search-panel'), { timeout: 10_000 })
  assert.equal(await page.evaluate(() => location.pathname), '/', 'Esc 不应触发跳转')

  // 侧边栏目录过滤不该在清空搜索后被整棵折起来（回归：旧的 :open 绑定会重置 details）
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2' })

  // 先手动展开一个分类，搜索再清空后它必须还是展开的
  const categorySummary = await page.$('.category-group > .category-summary')
  await categorySummary.click()
  await page.waitForFunction(() => document.querySelectorAll('.category-group[open]').length > 0, { timeout: 10_000 })

  const searchInput = await page.$('.sidebar-search input')
  await searchInput.click()
  await page.type('.sidebar-search input', '段永平', { delay: 20 })
  await page.waitForFunction(
    () => document.querySelectorAll('.category-group.search-open').length > 0,
    { timeout: 30_000 },
  )
  const expandedDuringSearch = await page.$$eval('.category-group.search-open', (groups) => groups.length)
  assert.ok(expandedDuringSearch > 0, '搜索时目录应整体展开')

  await page.click('.search-clear')
  await page.waitForFunction(() => !document.querySelector('.category-group.search-open'), { timeout: 10_000 })
  const stillOpen = await page.$$eval('.category-group[open] > .article-list', (lists) => lists.length)
  assert.ok(
    stillOpen > 0,
    '清空搜索后，之前展开的分类不应被折起来（旧的 :open 绑定会把它重置）',
  )

  // 点浮层外部关闭
  await searchInput.click()
  await page.type('.sidebar-search input', '苹果', { delay: 20 })
  await page.waitForSelector('.search-panel', { visible: true, timeout: 30_000 })
  await page.mouse.click(900, 700)
  await page.waitForFunction(() => !document.querySelector('.search-panel'), { timeout: 10_000 })
})

// 移动端：抽屉里搜索 → 点结果 → 抽屉关闭并落到对应小节
test('mobile drawer search jumps to the matched section and closes the drawer', { timeout: 180_000 }, async (t) => {
  const browser = await puppeteer.launch({ headless: true })
  t.after(() => browser.close())

  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2' })

  await page.click('.mobile-menu-btn')
  await page.waitForSelector('.mobile-drawer .sidebar-search input', { visible: true, timeout: 30_000 })
  // 抽屉是位移动画，动画期间输入框还在视口外，点不到
  await page.waitForFunction(() => {
    const rect = document.querySelector('.mobile-drawer .sidebar-search input')?.getBoundingClientRect()
    return Boolean(rect) && rect.left >= 0 && rect.right <= window.innerWidth
  }, { timeout: 30_000 })

  await page.click('.mobile-drawer .sidebar-search input')
  await page.type('.mobile-drawer .sidebar-search input', '长坡厚雪', { delay: 30 })
  await page.waitForFunction(
    () => document.querySelectorAll('.search-panel .search-hit-mark').length > 0,
    { timeout: 60_000 },
  )

  // 浮层不能被抽屉/侧边栏裁剪
  const fits = await page.evaluate(() => {
    const rect = document.querySelector('.search-panel')?.getBoundingClientRect()
    if (!rect) return null
    return { left: rect.left, right: rect.right, width: rect.width, viewport: window.innerWidth }
  })
  assert.ok(fits, '移动端也应出现结果浮层')
  assert.ok(fits.left >= 0 && fits.right <= fits.viewport + 1, '浮层应完整落在视口内')

  await page.click('.search-panel .search-hit')
  await page.waitForFunction(() => Boolean(location.hash) && location.pathname !== '/', { timeout: 30_000 })
  const anchorId = await page.evaluate(() => decodeURIComponent(location.hash.replace(/^#/, '')))
  await page.waitForFunction((id) => Boolean(document.getElementById(id)), { timeout: 30_000 }, anchorId)

  // 记录滚动前目标小节的位置，用来判断"确实滚过去了"
  const beforeClickTop = await page.evaluate((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0, anchorId)

  await page.waitForFunction(
    () => (document.querySelector('.main-area')?.scrollTop ?? 0) > 0,
    { timeout: 15_000 },
  )
  await new Promise((resolve) => setTimeout(resolve, 800))

  const state = await page.evaluate(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    const el = document.getElementById(id)
    return {
      drawerOpen: Boolean(document.querySelector('.mobile-drawer')),
      titleTop: Math.round(el?.getBoundingClientRect().top ?? -1),
      scrollerTop: Math.round(document.querySelector('.main-area')?.scrollTop ?? -1),
    }
  })
  if (state.drawerOpen) {
    // 抽屉关闭是 0.3s 过渡动画，短暂残留不算失败，但不能一直留着
    await page.waitForFunction(() => !document.querySelector('.mobile-drawer'), { timeout: 10_000 })
  }

  // 移动端文章更长、视口更矮，命中小节不一定能滚进首屏；
  // 这里要求的是"确实朝目标滚过去了"（标题位置明显上移），而不是必须停在顶部
  const moved = await page.evaluate((before) => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    const after = document.getElementById(id)?.getBoundingClientRect().top ?? -1
    return { after: Math.round(after), improved: before - after > 80 }
  }, beforeClickTop)
  assert.ok(state.scrollerTop > 0, '移动端也应发生滚动')
  assert.ok(moved.improved, `移动端应明显滚向命中小节（${Math.round(beforeClickTop)}px → ${moved.after}px）`)
})
