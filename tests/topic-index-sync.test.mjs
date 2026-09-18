import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { anchorFor, chapterBookmarks, syncTopicIndex } from '../scripts/sync-topic-index.mjs'

test('anchorFor reproduces the anchors already used in the topic index', () => {
  assert.equal(anchorFor('第三节 PE、估值指标与案例'), '第三节-pe估值指标与案例')
  assert.equal(anchorFor('第一节 Stop Doing List'), '第一节-stop-doing-list')
  assert.equal(anchorFor('第一节 Zone 2与日常运动'), '第一节-zone-2与日常运动')
  assert.equal(anchorFor('第四节 ROE与经营效率'), '第四节-roe与经营效率')
  assert.equal(anchorFor('OXY（西方石油）'), 'oxy西方石油')
})

test('chapterBookmarks lists sections and their sub headings in order', () => {
  const chapter = [
    '---', 'title: "x"', '---', '',
    '## 第一节 互联网平台', '', '### 腾讯', '', '正文', '', '### 拼多多', '',
    '## 第二节 科技与新产业', '', '### 英伟达', '',
  ].join('\n')
  assert.deepEqual(chapterBookmarks(chapter), [
    { level: 2, title: '第一节 互联网平台' },
    { level: 3, title: '腾讯' },
    { level: 3, title: '拼多多' },
    { level: 2, title: '第二节 科技与新产业' },
    { level: 3, title: '英伟达' },
  ])
})

test('syncTopicIndex rewrites bookmarks and keeps the volume/chapter skeleton', () => {
  const index = [
    '---', 'title: "目录"', '---', '',
    '## 第一卷 甲', '',
    '### 第一章 [示例](/wenda-invest-01)', '',
    '- [第一节 旧](/wenda-invest-01#第一节-旧)', '',
  ].join('\n')
  const chapters = new Map([
    ['wenda-invest-01', '## 第一节 新甲\n\n### 子项\n\n## 第二节 新乙\n'],
  ])
  const result = syncTopicIndex(index, chapters)
  assert.match(result, /## 第一卷 甲/)
  assert.match(result, /### 第一章 \[示例\]\(\/wenda-invest-01\)/)
  assert.match(result, /- \[第一节 新甲\]\(\/wenda-invest-01#第一节-新甲\)/)
  assert.match(result, /  - \[子项\]\(\/wenda-invest-01#子项\)/)
  assert.match(result, /- \[第二节 新乙\]\(\/wenda-invest-01#第二节-新乙\)/)
  assert.doesNotMatch(result, /第一节 旧/)
})

test('syncTopicIndex keeps the frontmatter untouched', () => {
  const index = [
    '---',
    'title: "投资问答录主题目录"',
    'slug: "wenda-topic-index"',
    'description: "d"',
    'seoTitle: "s"',
    'seoDescription: "sd"',
    '---',
    '',
    '## 第一卷 甲',
    '',
    '### 第一章 [示例](/wenda-invest-01)',
    '',
    '- [第一节 旧](/wenda-invest-01#第一节-旧)',
    '',
  ].join('\n')
  const chapters = new Map([['wenda-invest-01', '## 第一节 新甲\n']])
  const result = syncTopicIndex(index, chapters)
  assert.equal(
    result.slice(0, result.indexOf('\n---\n', 3) + 5),
    index.slice(0, index.indexOf('\n---\n', 3) + 5),
  )
})

test('syncTopicIndex refuses to sync when a chapter has no source file', () => {
  // 从前这里会把该章书签整段删掉还 exit 0；现在必须报错，免得手工目录被无声抹平。
  const index = [
    '---', 'title: "目录"', '---', '',
    '## 第一卷 甲', '',
    '### 第一章 [在册](/wenda-invest-01)', '',
    '- [第一节 旧甲](/wenda-invest-01#第一节-旧甲)', '',
    '### 第二章 [缺席](/wenda-invest-99)', '',
    '- [第一节 旧乙](/wenda-invest-99#第一节-旧乙)', '',
  ].join('\n')
  const chapters = new Map([['wenda-invest-01', '## 第一节 新甲\n']])
  assert.throws(
    () => syncTopicIndex(index, chapters),
    (error) => {
      assert.match(error.message, /wenda-invest-99/, '报错要点名缺失的 slug')
      assert.doesNotMatch(error.message, /wenda-invest-01/, '找得到的章不该被点名')
      assert.match(error.message, /白名单/, '要提示文件名白名单')
      assert.match(error.message, /content\/dao\/qanda/, '要提示扫描的目录')
      assert.match(error.message, /slug/, '要提示文件名与 slug 可能不一致')
      return true
    },
  )
})

test('syncTopicIndex names every chapter that has no source file', () => {
  const index = [
    '---', 'title: "目录"', '---', '',
    '## 第一卷 甲', '',
    '### 第一章 [缺席甲](/wenda-invest-99)', '',
    '### 第二章 [缺席乙](/wenda-people-01)', '',
  ].join('\n')
  assert.throws(() => syncTopicIndex(index, new Map()), (error) => {
    assert.match(error.message, /wenda-invest-99/)
    assert.match(error.message, /wenda-people-01/)
    return true
  })
})

test('syncTopicIndex keeps handwritten prose that follows a chapter bookmark list', () => {
  const index = [
    '---', 'title: "目录"', '---', '',
    '## 第一卷 甲', '',
    '### 第一章 [示例](/wenda-invest-01)', '',
    '- [第一节 旧](/wenda-invest-01#第一节-旧)', '',
    '> 本章导读：先看商业模式，再谈价格。', '',
  ].join('\n')
  const chapters = new Map([['wenda-invest-01', '## 第一节 新甲\n']])
  const result = syncTopicIndex(index, chapters)
  assert.match(result, /> 本章导读：先看商业模式，再谈价格。/, '手写散文不许被吞掉')
  assert.match(result, /- \[第一节 新甲\]\(\/wenda-invest-01#第一节-新甲\)/)
  assert.doesNotMatch(result, /第一节 旧/)
})

test('syncTopicIndex keeps prose sitting between the chapter heading and its bookmarks', () => {
  const index = [
    '---', 'title: "目录"', '---', '',
    '## 第一卷 甲', '',
    '### 第一章 [示例](/wenda-invest-01)', '',
    '本章按主题分节，顺序与正文一致。', '',
    '- [第一节 旧](/wenda-invest-01#第一节-旧)', '',
  ].join('\n')
  const chapters = new Map([['wenda-invest-01', '## 第一节 新甲\n']])
  const result = syncTopicIndex(index, chapters)
  // 散文一挡住重建就停手：新书签插在散文之前，散文连同其后的旧书签原样留着。
  // 这个形态下书签会重复，但脚本分不清散文后面的 `- [` 是书签还是正文，宁可多留不可误删。
  assert.match(result, /本章按主题分节，顺序与正文一致。/, '手写散文不许被吞掉')
  assert.match(result, /- \[第一节 新甲\]\(\/wenda-invest-01#第一节-新甲\)/)
  assert.equal(syncTopicIndex(result, chapters), result, '再跑一次必须是不动点')
})

test('the committed topic index matches every chapter on disk', async () => {
  // 相对 import.meta.url 定位，跟仓库其余测试一致；用 cwd 相对路径在非仓库根目录跑会失败。
  const root = fileURLToPath(new URL('../', import.meta.url))
  const dirs = ['content/dao/qanda']
  const chapters = new Map()
  for (const dir of dirs) {
    for (const name of await readdir(path.join(root, dir))) {
      if (!/^wenda-(?:invest|business|company|life)-.+\.md$/.test(name)) continue
      chapters.set(name.replace(/\.md$/, ''), await readFile(path.join(root, dir, name), 'utf8'))
    }
  }
  const indexPath = path.join(root, 'content/dao/qanda/wenda-topic-index.md')
  const current = await readFile(indexPath, 'utf8')
  assert.equal(syncTopicIndex(current, chapters), current, '主题目录与章节标题不同步，请运行 node scripts/sync-topic-index.mjs --write')
})
