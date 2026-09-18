import assert from 'node:assert/strict'
import test from 'node:test'

import puppeteer from 'puppeteer'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'

test('global font-size control changes article prose and preserves the preference', { timeout: 120_000 }, async (t) => {
  const browser = await puppeteer.launch({ headless: true })
  t.after(() => browser.close())

  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/pingchangxin`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.removeItem('article-font-size-percent'))
  await page.reload({ waitUntil: 'networkidle2' })

  const fontTrigger = await page.$('.mobile-topbar button[aria-label="调整正文字号"]')
  assert.ok(fontTrigger, 'mobile top bar should expose the global font-size control')

  const positions = await page.evaluate(() => {
    const fontButton = document.querySelector('.mobile-topbar button[aria-label="调整正文字号"]')
    const themeButton = document.querySelector('.mobile-topbar button[aria-label^="选择主题"]')
    assertElement(fontButton)
    assertElement(themeButton)
    return {
      font: fontButton.getBoundingClientRect().x,
      theme: themeButton.getBoundingClientRect().x,
    }

    function assertElement(value) {
      if (!(value instanceof HTMLElement)) throw new Error('expected toolbar button')
    }
  })
  assert.ok(positions.font < positions.theme, 'font-size control should sit left of the theme control')

  const initialFontSize = await page.$eval('.prose', (element) => Number.parseFloat(getComputedStyle(element).fontSize))
  await fontTrigger.click()
  await page.waitForSelector('[role="group"][aria-label="正文字号"]', { visible: true })
  await page.click('button[aria-label="增大正文字号"]')
  await page.waitForFunction(
    (before) => Number.parseFloat(getComputedStyle(document.querySelector('.prose')).fontSize) > before,
    {},
    initialFontSize,
  )

  const enlargedFontSize = await page.$eval('.prose', (element) => Number.parseFloat(getComputedStyle(element).fontSize))
  assert.ok(enlargedFontSize > initialFontSize)
  assert.equal(await page.evaluate(() => localStorage.getItem('article-font-size-percent')), '110')

  await page.reload({ waitUntil: 'networkidle2' })
  const restoredFontSize = await page.$eval('.prose', (element) => Number.parseFloat(getComputedStyle(element).fontSize))
  assert.equal(restoredFontSize, enlargedFontSize)

  await page.goto(baseUrl, { waitUntil: 'networkidle2' })
  assert.ok(
    await page.$('.mobile-topbar button[aria-label="调整正文字号"]'),
    'font-size control should remain available outside article pages',
  )
})
