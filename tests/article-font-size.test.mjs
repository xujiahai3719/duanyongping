import assert from 'node:assert/strict'
import test from 'node:test'

const articleFontSizeModule = import('../app/utils/articleFontSize.ts').catch(() => null)

async function loadArticleFontSizeModule() {
  const module = await articleFontSizeModule
  assert.ok(module, 'article font-size behavior should be implemented')
  return module
}

test('normalizes stored font-size values to one of the supported reading levels', async () => {
  const { normalizeArticleFontSizePercent } = await loadArticleFontSizeModule()

  assert.equal(normalizeArticleFontSizePercent('90'), 90)
  assert.equal(normalizeArticleFontSizePercent(110), 110)
  assert.equal(normalizeArticleFontSizePercent('130'), 130)
  assert.equal(normalizeArticleFontSizePercent('115'), 100)
  assert.equal(normalizeArticleFontSizePercent('large'), 100)
  assert.equal(normalizeArticleFontSizePercent(null), 100)
})

test('steps through font-size levels and stops at both limits', async () => {
  const { stepArticleFontSizePercent } = await loadArticleFontSizeModule()

  assert.equal(stepArticleFontSizePercent(100, -1), 90)
  assert.equal(stepArticleFontSizePercent(100, 1), 110)
  assert.equal(stepArticleFontSizePercent(90, -1), 90)
  assert.equal(stepArticleFontSizePercent(130, 1), 130)
  assert.equal(stepArticleFontSizePercent('invalid', 1), 110)
})

test('loads, saves, and applies a persistent article font-size preference', async () => {
  const {
    ARTICLE_FONT_SIZE_STORAGE_KEY,
    applyArticleFontSizePercent,
    loadArticleFontSizePercent,
    saveArticleFontSizePercent,
  } = await loadArticleFontSizeModule()
  const values = new Map([[ARTICLE_FONT_SIZE_STORAGE_KEY, '120']])
  const cssProperties = new Map()
  const storage = {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
  const style = {
    setProperty(name, value) {
      cssProperties.set(name, value)
    },
  }

  assert.equal(loadArticleFontSizePercent(storage), 120)
  assert.equal(applyArticleFontSizePercent(style, 120), 120)
  assert.equal(cssProperties.get('--article-font-scale'), '120%')

  assert.equal(saveArticleFontSizePercent(storage, style, 130), 130)
  assert.equal(values.get(ARTICLE_FONT_SIZE_STORAGE_KEY), '130')
  assert.equal(cssProperties.get('--article-font-scale'), '130%')

  assert.equal(saveArticleFontSizePercent(storage, style, 115), 100)
  assert.equal(values.get(ARTICLE_FONT_SIZE_STORAGE_KEY), '100')
  assert.equal(cssProperties.get('--article-font-scale'), '100%')
})
