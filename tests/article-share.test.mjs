import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { buildArticleCopyContent, buildArticleShareText } from '../app/utils/articleShare.ts'

test('buildArticleShareText leads with the bare title, then the article link', () => {
  const text = buildArticleShareText({
    title: '段永平谈买股票就是买公司',
    url: 'https://duan.example/maigupiao',
  })

  assert.equal(text, '段永平谈买股票就是买公司\n原文链接：https://duan.example/maigupiao')
})

test('buildArticleShareText keeps title punctuation verbatim', () => {
  const text = buildArticleShareText({
    title: '<投资 & 经营>',
    url: 'https://duan.example/a?x=1&y=2',
  })

  assert.equal(text, '<投资 & 经营>\n原文链接：https://duan.example/a?x=1&y=2')
})

test('buildArticleCopyContent appends the share attribution to the copied selection', () => {
  const content = buildArticleCopyContent(
    { title: '苹果：产品、商业模式与生态｜段永平投资问答录', url: 'https://duan.example/apple' },
    { html: '<p>正文 <strong>重点</strong></p>', text: '正文 重点' },
  )

  assert.equal(
    content.text,
    '正文 重点\n\n苹果：产品、商业模式与生态｜段永平投资问答录\n原文链接：https://duan.example/apple',
  )
  assert.equal(
    content.html,
    '<p>正文 <strong>重点</strong></p><p>苹果：产品、商业模式与生态｜段永平投资问答录<br>原文链接：<a href="https://duan.example/apple">https://duan.example/apple</a></p>',
  )
})

test('buildArticleCopyContent escapes the header without touching the selection markup', () => {
  const content = buildArticleCopyContent(
    { title: '<投资 & 经营>', url: 'https://duan.example/a?x=1&y="2"' },
    { html: '<ul><li><a href="https://duan.example/b">正文链接</a></li></ul>', text: '正文链接' },
  )

  assert.match(content.html, /<ul><li><a href="https:\/\/duan\.example\/b">正文链接<\/a><\/li><\/ul><p>&lt;投资 &amp; 经营&gt;<br>/)
  assert.match(content.html, /href="https:\/\/duan\.example\/a\?x=1&amp;y=&quot;2&quot;"/)
})

const readProjectFile = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('article page shares the seoTitle through a single share control', () => {
  const page = readProjectFile('app/pages/[slug].vue')
  const component = readProjectFile('app/components/ShareButtons.vue')

  assert.match(page, /const shareTitle = computed\(\(\) => pageData\.value\?\.seoTitle \|\| displayTitle\.value\)/)
  assert.match(page, /:title="shareTitle"/)
  assert.doesNotMatch(page, /content-id=/)
  assert.match(component, /buildArticleShareText/)
  assert.match(component, /navigator\.clipboard\.writeText/)
  assert.doesNotMatch(component, /contentId|getElementById|cloneNode|bodyHtml|bodyText/)
  assert.equal((component.match(/<button\b/g) || []).length, 1)
  assert.doesNotMatch(component, /分享链接|分享图片|QRCode/)
})

test('rendered article keeps the id ReadingPosition anchors on', () => {
  const page = readProjectFile('app/pages/[slug].vue')
  const readingPosition = readProjectFile('app/components/ReadingPosition.vue')

  assert.match(page, /id="article-share-content"/)
  assert.match(readingPosition, /getElementById\('article-share-content'\)/)
})

test('copying inside the article body is decorated with the same share header', () => {
  const page = readProjectFile('app/pages/[slug].vue')
  const composable = readProjectFile('app/composables/useArticleCopyAttribution.ts')

  assert.match(page, /useArticleCopyAttribution\('article-share-content'/)
  assert.match(composable, /addEventListener\('copy'/)
  assert.match(composable, /removeEventListener\('copy'/)
  // 选区跨出正文时必须放行浏览器默认复制，否则框选侧边栏也会被塞进出处
  assert.match(composable, /root\.contains\(range\.commonAncestorContainer\)/)
  assert.match(composable, /setData\('text\/plain'/)
  assert.match(composable, /setData\('text\/html'/)
  // Vue 的 fragment 锚点注释不能跟着选区一起粘出去
  assert.match(composable, /stripComments\(holder\)/)
})

test('share button and copy header resolve the article URL through one helper', () => {
  const component = readProjectFile('app/components/ShareButtons.vue')
  const page = readProjectFile('app/pages/[slug].vue')
  const composable = readProjectFile('app/composables/useArticleShareUrl.ts')

  assert.match(component, /useArticleShareUrl\(\(\) => props\.slug\)/)
  assert.match(page, /const shareUrl = useArticleShareUrl\(slug\)/)
  assert.equal((composable.match(/duan\.ayaseeri\.com/g) || []).length, 1)
  assert.doesNotMatch(component, /duan\.ayaseeri\.com/)
})
