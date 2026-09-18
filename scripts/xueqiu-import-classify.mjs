// 把清洗好的问答块映射到既有章节 slug + 建议节标题。
//
// 规则按数组顺序取第一个命中，所以窄主题（公司名）必须排在宽主题（估值、文化）前面。
// 数组顺序即优先级，重排会改变分类结果——新增规则时先想清楚它应该压在谁前面。
//
// `section` 是**建议**落点，人工审稿阶段可改。但它必须是目标章节里真实存在的
// `## ` 标题：章节一重排（改 `## 第N节` 标题）这里就会烂掉，而 --apply 要跑到
// insertIntoSection 才炸，那时正文已经改了一半。tests/xueqiu-import.test.mjs 里
// 「every chapter rule points at an existing chapter file and section heading」
// 就是这道防线，重排完章节要么改这里、要么等它变红。
export const CHAPTER_RULES = [
  // —— 公司案例（窄主题优先）——
  { slug: 'wenda-company-pop-mart', section: '第二节 情绪价值与潮玩需求',
    pattern: /泡泡玛特|popmart|pop\s?mart|labubu|molly|dimoo|潮玩|盲盒|王宁|09992|城市乐园/i },
  { slug: 'wenda-company-apple-03', section: '第五节 成熟期的苹果与今天的估值',
    pattern: /苹果|aapl|iphone|ipad|库克|ternus|siri|app\s?store/i },
  { slug: 'wenda-company-maotai-01', section: '第二节 品牌与消费者心智',
    pattern: /茅台|飞天|酱酒|i茅台/i },
  { slug: 'wenda-company-netease', section: '第六节 梦幻情缘与近况',
    pattern: /网易|丁磊|梦幻西游|大话西游/i },
  { slug: 'wenda-company-tech-platforms', section: '第二节 科技与新产业',
    pattern: /腾讯|拼多多|谷歌|google|英伟达|nvidia|特斯拉|tesla|spacex|马斯克|美光|台积电|openai/i },
  { slug: 'wenda-company-energy-industrial', section: '第一节 OXY（西方石油）',
    // oxy 加词边界：不带边界会命中 proxy / epoxy / oxygen。
    pattern: /神华|中石油|中石化|\boxy\b|西方石油|uhal|通用电气/i },

  // —— 投资原则与方法 ——
  { slug: 'wenda-invest-11', section: '第五节 卖put的实务与限制',
    pattern: /卖\s?put|covered\s?call|期权|权证|杠杆|margin|套利|量化|投机/i },
  { slug: 'wenda-invest-07', section: '第一节 什么是估值：定性判断与毛估估',
    pattern: /估值|现金流折现|dcf|市盈率|\bpe\b|财报|净利润/i },
  { slug: 'wenda-invest-04', section: '第六节 不懂不碰',
    pattern: /做空|借钱|不懂不碰|满仓|风险控制/i },
  { slug: 'wenda-invest-05', section: '第一节 把波动当作朋友',
    pattern: /波动|宏观|牛市|熊市|大盘|指数基金|关税|加息/i },
  { slug: 'wenda-invest-06', section: '第五节 集中投资与仓位',
    pattern: /长期持有|集中投资|机会成本|仓位/i },
  { slug: 'wenda-invest-03', section: '第一节 什么叫看懂',
    pattern: /看懂|能力圈|商业模式/i },
  { slug: 'wenda-invest-01', section: '第六节 好公司比好价格重要与满仓主义',
    pattern: /买股票就是买公司|价值投资|巴菲特|芒格|伯克希尔/i },
  { slug: 'wenda-invest-12', section: '第二节 Golf与投资',
    pattern: /平常心|golf|高尔夫|莱德杯|球场/i },

  // —— 商业模式与经营 ——
  { slug: 'wenda-business-08', section: '第一节 什么是企业文化',
    pattern: /企业文化|本分|核心价值观|诚信/i },
  { slug: 'wenda-business-10', section: '第二节 CEO与管理层',
    pattern: /创始人|\bceo\b|管理层|接班|激励|团队建设/i },
  { slug: 'wenda-business-04', section: '第二节 什么是好产品',
    pattern: /产品力|用户体验|消费者需求|品质/i },
  { slug: 'wenda-business-07', section: '第五节 价格体系与渠道',
    pattern: /营销|广告|渠道|出海|零售|门店|加盟/i },
  { slug: 'wenda-business-11', section: '第四节 聚焦与取舍',
    pattern: /stop\s?doing|不为清单|聚焦/i },
  { slug: 'wenda-business-09', section: '第四节 利润之上的追求',
    pattern: /利润之上|使命|社会价值/i },

  // —— 人生与成长 ——
  { slug: 'wenda-life-06', section: '第一节 Zone 2、力量训练与减重',
    pattern: /睡眠|减重|走路|力量训练|zone\s?2|体检|息肉|肠镜|医保|健康/i },
  { slug: 'wenda-life-04', section: '第五节 多子女、选择与传承',
    pattern: /孩子|儿子|女儿|太太|家庭|传承|教育/i },
  { slug: 'wenda-life-05', section: '第四节 公益与社会责任',
    pattern: /公益|捐|慈善|贷学金|社会责任/i },
  { slug: 'wenda-life-03', section: '第二节 做喜欢的事情',
    pattern: /职业选择|创业|找工作|喜欢的事/i },
  { slug: 'wenda-life-02', section: '第二节 理性与原则',
    pattern: /正直|理性|原则|长期主义/i },
  { slug: 'wenda-life-01', section: '第一节 做对的事情',
    pattern: /做对的事情|把事情做对/i },
]

// 问题往往是长篇引用帖，尾部会污染匹配，所以只看开头。
const QUESTION_HEAD = 120

// 返回 `{ slug, section, answerMatched }`，命不中任何规则时返回 null。
//
// 匹配口径是「answer 全文 + question 前 120 字」，这是计划定死的规格，不要动——
// 改它会静默改变全批分类结果。
//
// `answerMatched` 是可见性字段，不参与分类：命中的那条规则的 pattern 在 answer
// 单独匹配时是否也成立。false 表示这一条纯粹是被提问语境带过去的（「王宁」
// 这类常见人名尤其容易劫持通用回答），下游审稿文件据此打优先复核标记。
export function classifyBlock(block) {
  const answer = block.answer
  const haystack = `${answer} ${String(block.question || '').slice(0, QUESTION_HEAD)}`
  const rule = CHAPTER_RULES.find((item) => item.pattern.test(haystack))
  if (!rule) return null
  return { slug: rule.slug, section: rule.section, answerMatched: rule.pattern.test(answer) }
}
