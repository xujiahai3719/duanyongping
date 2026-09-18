import assert from 'node:assert/strict'
import test from 'node:test'

import puppeteer from 'puppeteer'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
const articlePath = '/wenda-invest-09'
const storageKey = 'dyp:read-pos:wenda-invest-09'

async function open(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
  if (path !== '/') await page.waitForSelector('#article-share-content')
}

async function follow(page, selector, pathname) {
  await page.$eval(selector, (element) => element.click())
  await page.waitForFunction((path) => location.pathname === path, {}, pathname)
}

test('article restores its reading position while explicit anchors take priority', { timeout: 120_000 }, async (t) => {
  const browser = await puppeteer.launch({ headless: true })
  t.after(() => browser.close())

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await open(page, articlePath)
  await page.evaluate((key) => localStorage.removeItem(key), storageKey)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#article-share-content')
  // Development hydration continues briefly after DOMContentLoaded.
  await new Promise((resolve) => setTimeout(resolve, 1_000))

  const originalTop = await page.evaluate(() => {
    const scroller = document.querySelector('.main-area')
    if (!(scroller instanceof HTMLElement)) throw new Error('missing article scroller')
    scroller.scrollTo({ top: 2200, behavior: 'instant' })
    return scroller.scrollTop
  })
  assert.ok(originalTop > 1000, 'test article should be long enough to establish a reading position')

  await page.waitForFunction(
    (key) => Boolean(localStorage.getItem(key)),
    { timeout: 5_000 },
    storageKey,
  )
  const saved = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), storageKey))
  assert.ok(Number.isInteger(saved.i) && saved.i > 0, 'saved position should identify a content block')
  assert.ok(Number.isFinite(saved.o) && saved.o >= 0, 'saved position should include an offset inside the block')

  await follow(page, '.desktop-sidebar .sidebar-brand', '/')
  assert.ok(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    'leaving the article should preserve its reading position',
  )
  await follow(page, `.desktop-sidebar a[href="${articlePath}"]`, articlePath)
  await page.waitForSelector('#article-share-content')
  await new Promise((resolve) => setTimeout(resolve, 500))
  const restoredTop = await page.$eval('.main-area', (element) => element.scrollTop)
  assert.ok(
    Math.abs(restoredTop - originalTop) < 120,
    `restored position should stay near the saved reading point (${originalTop} vs ${restoredTop})`,
  )

  const anchorHref = await page.$eval('.article-toc a', (element) => element.getAttribute('href'))
  assert.ok(anchorHref?.startsWith('#'), 'test article should expose a section anchor')

  await open(page, '/')
  await open(page, `${articlePath}${anchorHref}`)
  await page.waitForFunction(
    (hash) => {
      const id = decodeURIComponent(hash.replace(/^#/, ''))
      const target = document.getElementById(id)
      return target && Math.abs(target.getBoundingClientRect().top - 72) < 20
    },
    { timeout: 5_000 },
    anchorHref,
  )

  const anchoredTop = await page.$eval('.main-area', (element) => element.scrollTop)
  assert.ok(
    Math.abs(anchoredTop - restoredTop) > 400,
    'an explicit section anchor should override the saved reading position',
  )
})
