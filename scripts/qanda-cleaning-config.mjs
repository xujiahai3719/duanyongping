export const VOLUMES = [
  { name: '投资原则与方法', order: 1, group: '投资原则' },
  { name: '商业模式与经营', order: 2, group: '商业经营' },
  { name: '公司案例', order: 3, group: '公司案例' },
  { name: '人生与成长', order: 4, group: '人生与成长' },
]

const chapterCounters = new Map()
const topic = (group, directory, order, slug, title, tags) => {
  const volume = VOLUMES.find((item) => item.group === group)
  const chapterOrder = (chapterCounters.get(group) || 0) + 1
  chapterCounters.set(group, chapterOrder)
  return {
    group,
    volume: volume.name,
    volumeOrder: volume.order,
    chapterOrder,
    directory,
    order,
    slug,
    title,
    tags: [group, ...tags],
  }
}

export const TOPICS = [
  topic('投资原则', 'qanda', 200, 'wenda-invest-01', '买股票就是买公司与价值投资', ['买股票就是买公司', '价值投资']),
  topic('投资原则', 'qanda', 201, 'wenda-invest-02', '投资为什么简单但不容易', ['投资理解', '投资者']),
  topic('投资原则', 'qanda', 202, 'wenda-invest-03', '看懂生意与能力圈', ['能力圈', '看懂生意']),
  topic('投资原则', 'qanda', 203, 'wenda-invest-04', '风险第一：不做空、不借钱、不懂不碰', ['风险控制', '不做空', '不加杠杆']),
  topic('投资原则', 'qanda', 204, 'wenda-invest-05', '市场波动、宏观与牛熊', ['宏观经济', '市场波动', '牛熊市']),
  topic('投资原则', 'qanda', 205, 'wenda-invest-06', '长期持有、集中投资与机会成本', ['长期持有', '集中投资', '机会成本']),
  topic('投资原则', 'qanda', 206, 'wenda-invest-07', '现金流折现、PE与定性判断', ['现金流折现', '估值', '市盈率']),
  topic('投资原则', 'qanda', 207, 'wenda-invest-08', '买卖时机与“持有就是买入”', ['买卖时机', '持有', '估值']),
  topic('投资原则', 'qanda', 208, 'wenda-invest-09', '财报、现金流、ROE与净资产', ['财务报表', '现金流', 'ROE']),
  topic('投资原则', 'qanda', 209, 'wenda-invest-10', '分红、回购与资本配置', ['分红', '回购', '资本配置']),
  topic('投资原则', 'qanda', 210, 'wenda-invest-11', '投机、套利、量化与衍生品', ['投机', '套利', '量化交易']),
  topic('投资原则', 'qanda', 211, 'wenda-invest-12', '投资心态、Golf、阅读与学习', ['平常心', 'Golf', '阅读']),

  topic('商业经营', 'qanda', 230, 'wenda-business-01', '伟大企业与长坡厚雪', ['伟大企业', '长坡厚雪']),
  topic('商业经营', 'qanda', 231, 'wenda-business-02', '商业模式与投资确定性', ['商业模式', '投资确定性']),
  topic('商业经营', 'qanda', 232, 'wenda-business-03', '护城河与差异化', ['护城河', '差异化']),
  topic('商业经营', 'qanda', 233, 'wenda-business-04', '好产品与用户导向', ['好产品', '用户导向']),
  topic('商业经营', 'qanda', 234, 'wenda-business-05', '创新与敢为天下后', ['创新', '敢为天下后']),
  topic('商业经营', 'qanda', 235, 'wenda-business-06', '品牌的本质', ['品牌', '产品']),
  topic('商业经营', 'qanda', 236, 'wenda-business-07', '营销、广告、渠道与出海', ['营销', '广告', '渠道']),
  topic('商业经营', 'qanda', 237, 'wenda-business-08', '企业文化', ['企业文化', '基业长青']),
  topic('商业经营', 'qanda', 238, 'wenda-business-09', '本分、平常心与利润之上的追求', ['本分', '平常心', '利润之上的追求']),
  topic('商业经营', 'qanda', 239, 'wenda-business-10', '创始人、CEO、团队与激励', ['管理层', '团队', '激励']),
  topic('商业经营', 'qanda', 240, 'wenda-business-11', 'Stop Doing List、聚焦与更健康更长久', ['Stop Doing List', '聚焦', '长期主义']),
  topic('商业经营', 'qanda', 241, 'wenda-business-12', '收购与多元化', ['收购', '多元化']),

  topic('公司案例', 'qanda', 260, 'wenda-company-apple-01', '苹果：产品、商业模式与生态', ['苹果', '产品', '生态系统']),
  topic('公司案例', 'qanda', 261, 'wenda-company-apple-02', '苹果：管理层与企业文化', ['苹果', '乔布斯', '库克']),
  topic('公司案例', 'qanda', 262, 'wenda-company-apple-03', '苹果：估值、持有与资本配置', ['苹果', '估值', '资本配置']),
  topic('公司案例', 'qanda', 263, 'wenda-company-maotai-01', '贵州茅台：产品、品牌与商业模式', ['贵州茅台', '品牌', '商业模式']),
  topic('公司案例', 'qanda', 264, 'wenda-company-maotai-02', '贵州茅台：治理、渠道与i茅台', ['贵州茅台', '公司治理', 'i茅台']),
  topic('公司案例', 'qanda', 265, 'wenda-company-maotai-03', '贵州茅台：估值与投资判断', ['贵州茅台', '估值', '长期持有']),
  topic('公司案例', 'qanda', 266, 'wenda-company-bbk', '小霸王与步步高', ['小霸王', '步步高']),
  topic('公司案例', 'qanda', 267, 'wenda-company-netease', '网易', ['网易', '丁磊', '游戏']),
  topic('公司案例', 'qanda', 268, 'wenda-company-alibaba-yahoo', '阿里巴巴与雅虎', ['阿里巴巴', '雅虎', '马云']),
  topic('公司案例', 'qanda', 269, 'wenda-company-pop-mart', '泡泡玛特', ['泡泡玛特', '情绪价值']),
  topic('公司案例', 'qanda', 270, 'wenda-company-consumer-electronics', '消费电子与日本制造', ['消费电子', '日本制造']),
  topic('公司案例', 'qanda', 271, 'wenda-company-china-games', '中国游戏公司群像', ['游戏公司', '中国游戏']),
  topic('公司案例', 'qanda', 272, 'wenda-company-tech-platforms', '互联网、科技与新产业', ['互联网平台', '科技产业']),
  topic('公司案例', 'qanda', 273, 'wenda-company-retail-services', '零售与服务业案例', ['零售', '服务业']),
  topic('公司案例', 'qanda', 274, 'wenda-company-energy-industrial', '能源与工业企业案例', ['能源', '工业企业']),

  topic('人生与成长', 'qanda', 320, 'wenda-life-01', '做对的事情与把事情做对', ['做对的事情', '把事情做对']),
  topic('人生与成长', 'qanda', 321, 'wenda-life-02', '正直、理性与长期视角', ['正直', '理性', '长期主义']),
  topic('人生与成长', 'qanda', 322, 'wenda-life-03', '职业、创业与享受过程', ['职业', '创业', '享受过程']),
  topic('人生与成长', 'qanda', 323, 'wenda-life-04', '家庭、孩子与教育', ['家庭', '孩子', '教育']),
  topic('人生与成长', 'qanda', 324, 'wenda-life-05', '开放学习、公益与社会责任', ['开放心态', '公益', '社会责任']),
  topic('人生与成长', 'qanda', 325, 'wenda-life-06', '睡眠、减重、Zone 2与日常健康', ['健康', '睡眠', 'Zone 2']),
]

export const MERGED_COMPANY_REDIRECTS = new Map([
  ['wenda-company-oppo', 'wenda-company-consumer-electronics'],
  ['wenda-company-vivo', 'wenda-company-consumer-electronics'],
  ['wenda-company-nintendo', 'wenda-company-consumer-electronics'],
  ['wenda-company-sony', 'wenda-company-consumer-electronics'],
  ['wenda-company-panasonic', 'wenda-company-consumer-electronics'],
  ['wenda-company-perfect-world', 'wenda-company-china-games'],
  ['wenda-company-giant-network', 'wenda-company-china-games'],
  ['wenda-company-kingsoft', 'wenda-company-china-games'],
  ['wenda-company-changyou', 'wenda-company-china-games'],
  ['wenda-company-the9', 'wenda-company-china-games'],
  ['wenda-company-tencent', 'wenda-company-tech-platforms'],
  ['wenda-company-pinduoduo', 'wenda-company-tech-platforms'],
  ['wenda-company-google', 'wenda-company-tech-platforms'],
  ['wenda-company-nvidia', 'wenda-company-tech-platforms'],
  ['wenda-company-tesla', 'wenda-company-tech-platforms'],
  ['wenda-company-costco', 'wenda-company-retail-services'],
  ['wenda-company-new-oriental', 'wenda-company-retail-services'],
  ['wenda-company-oxy', 'wenda-company-energy-industrial'],
  ['wenda-company-ge', 'wenda-company-energy-industrial'],
])

export const TOPIC_BY_SLUG = new Map(TOPICS.map((item) => [item.slug, item]))

const includesAny = (value, words) => words.some((word) => value.toLowerCase().includes(word.toLowerCase()))

const section = (title, order, keywords) => ({ title, order, keywords })

const SECTION_CATALOGS = new Map(Object.entries({
  'wenda-invest-01': [
    section('买股票就是买公司', 1, ['买股票就是买公司', '上市公司看成非上市公司']),
    section('价值投资的定义', 2, ['价值投资', '投资是什么', '投资理解']),
    section('价值、价格与原则边界', 3, ['信仰', '称重机', '投票器', 'must believe', '价格围绕价值', '内在价值', '市场价格', '捷径', '唯一的路', '容易', '困难']),
  ],
  'wenda-invest-02': [
    section('简单、不容易与长期学习', 1, ['简单但不容易', '简单但绝不容易', '道需悟', '术可学', '学习', '悟性']),
    section('投资没有捷径', 2, ['捷径', '大道', '小路', '快即是慢']),
    section('什么人适合投资', 3, ['适合', '85%', '投资者', '小额投资者']),
  ],
  'wenda-invest-03': [
    section('什么叫看懂', 1, ['什么是懂', '什么叫懂', '看懂', '懂公司']),
    section('能力圈与放弃', 2, ['能力圈', '放弃', '不懂']),
    section('先看商业模式', 3, ['商业模式', '生意模式', '好生意']),
    section('理解企业的方法', 4, ['企业文化', '财报', '调研', '产品']),
  ],
  'wenda-invest-04': [
    section('风险考量与纪律', 1, ['风险第一', '风险', '安全', '黑天鹅', '错误率', '概率', '期货', '衍生品', '保险', '风险纪律']),
    section('不做空', 2, ['做空', '空头', 'short']),
    section('不借钱、不加杠杆', 3, ['margin', '杠杆', '借钱', '贷款', '有息负债']),
    section('不懂不碰', 4, ['不懂不碰', '不懂', '能力圈']),
  ],
  'wenda-invest-05': [
    section('把波动当作朋友', 1, ['波动', '下跌', '涨跌']),
    section('忽略市场噪声', 2, ['市场', '消息', '预测']),
    section('如何看待宏观', 3, ['宏观', '经济周期', '通胀']),
    section('牛市与熊市', 4, ['牛市', '熊市', '萧条', '金融危机']),
  ],
  'wenda-invest-06': [
    section('长期持有与集中投资', 1, ['长期持有', '持有十年', '封仓', '十年', '二十年', '集中投资', '集中', '满仓', '仓位']),
    section('机会成本', 2, ['机会成本', '更好的机会']),
    section('耐心与复利', 3, ['耐心', '复利', '等待']),
  ],
  'wenda-invest-07': [
    section('估值逻辑与定性判断', 1, ['估值', '价值怎么算', '毛估估', '定性', '定量', '计算器']),
    section('未来现金流折现', 2, ['现金流', '折现', 'dcf']),
    section('PE、估值指标与案例', 3, ['市盈率', 'pe', '市净率', 'pb', '雅虎', 'uhal', '万科', '中石油']),
  ],
  'wenda-invest-08': [
    section('持有就是买入', 1, ['持有就是买入', '持有=买入']),
    section('买入、卖出与成本', 2, ['买入', '买股票', '加仓', '卖出', '卖股票', '该卖', '成本', '市场', '涨了', '跌了']),
    section('买卖案例', 3, ['网易', '苹果', '茅台']),
  ],
  'wenda-invest-09': [
    section('财报的作用', 1, ['财报', '财务报表', '会计']),
    section('现金流与真实利润', 2, ['现金流', '真实利润', '自由现金']),
    section('净资产与负债', 3, ['净资产', '资产负债', '负债', '有效净资产']),
    section('ROE与经营效率', 4, ['roe', '净资产收益率', '资本回报']),
    section('财务指标的边界', 5, ['ebitda', '指标', '排除']),
  ],
  'wenda-invest-10': [
    section('资本配置原则', 1, ['资本配置', '资金使用', '现金']),
    section('分红', 2, ['分红', '股息']),
    section('回购与负债边界', 3, ['回购', '注销', '负债', '借债', 'ibm']),
  ],
  'wenda-invest-11': [
    section('投资与投机', 1, ['投机', '赌博', '短线']),
    section('套利与衍生品', 2, ['套利', '衍生品', '期权', '期货']),
    section('量化交易', 3, ['量化', '算法', '程序交易']),
    section('不做空', 4, ['做空', '空头']),
  ],
  'wenda-invest-12': [
    section('平常心、理性与投资经验', 1, ['平常心', '理性', '恐惧', '贪婪', '经验', '心态', '耐心']),
    section('Golf与投资', 2, ['golf', '高尔夫']),
    section('阅读与学习', 3, ['书', '阅读', '学习', '芒格主义']),
  ],
  'wenda-business-01': [
    section('伟大企业的标准', 1, ['伟大企业', '伟大的企业', '好公司']),
    section('长坡厚雪与长期价值', 2, ['长坡', '厚雪', '滚雪球', '长期']),
  ],
  'wenda-business-02': [
    section('商业模式与好坏生意', 1, ['什么是商业模式', '商业模式', '生意模式', '好生意', '坏生意', '烂生意']),
    section('确定性与未来现金流', 2, ['确定性', '现金流', '风险']),
    section('商业模式案例', 3, ['案例', '行业', '公司']),
  ],
  'wenda-business-03': [
    section('护城河的本质', 1, ['护城河', '垄断', '竞争优势']),
    section('差异化', 2, ['差异化', '用户需要']),
    section('价格战与同质化', 3, ['价格战', '同质化', '降价']),
    section('行业与产品案例', 4, ['航空', '硅片', '白酒', '游戏']),
  ],
  'wenda-business-04': [
    section('产品标准、用户需求与取舍', 1, ['好产品', '产品质量', '最好产品', '用户导向', '消费者导向', '用户体验', '消费者体验', '真实需求', '用户需要', '取舍', '功能']),
    section('产品案例', 2, ['苹果', 'oppo', 'vivo', '小天才']),
  ],
  'wenda-business-05': [
    section('创新的目的', 1, ['创新', '用户需要', '产品']),
    section('敢为天下后', 2, ['敢为天下后', '后中争先']),
    section('反对盲目创新', 3, ['盲目创新', '为创新而创新']),
    section('创新案例', 4, ['苹果', 'oppo', '三星', '任天堂']),
  ],
  'wenda-business-06': [
    section('品牌的本质', 1, ['品牌的本质', '品牌']),
    section('品牌与产品', 2, ['产品', '品质', '印象']),
    section('品牌没有溢价', 3, ['溢价', '定价', '贵']),
    section('品牌建设与命名', 4, ['商标', '名字', '命名', '推广']),
  ],
  'wenda-business-07': [
    section('营销的边界', 1, ['营销', '市场推广']),
    section('广告只表达产品', 2, ['广告', '夸大其词']),
    section('渠道、零售与出海', 3, ['渠道', '经销商', '零售', '直营', '出海', '国际化', '海外']),
  ],
  'wenda-business-08': [
    section('企业文化的定义', 1, ['什么是企业文化', '企业文化就是', '企业文化讲的', '好的企业文化']),
    section('企业文化的建立与传承', 2, ['建立', '形成', '改变', '维护', '传承', '创始人']),
    section('如何判断企业文化', 3, ['判断', '观察', '听其言', '观其行', '量化', '看企业']),
    section('企业文化与长期经营', 4, ['基业长青', '长久', '活得长', '信誉', '护城河']),
    section('文化案例', 5, ['苹果', '步步高', 'oppo', '格力', '万科', 'ge']),
  ],
  'wenda-business-09': [
    section('本分', 1, ['本分']),
    section('核心价值观', 2, ['核心价值观', '是非', '正直', '诚信']),
    section('利润之上的追求', 3, ['利润之上', '利润导向']),
    section('平常心与长期结果', 4, ['平常心', '长期', '结果导向']),
  ],
  'wenda-business-10': [
    section('创始人与造钟人', 1, ['创始人', '造钟人', '报时人']),
    section('CEO与管理层', 2, ['ceo', '管理层', '库克', '乔布斯']),
    section('董事会与治理', 3, ['董事会', '治理', '授权']),
    section('选人与团队', 4, ['选人', '团队', '合适性', '合格性', '裁员', '员工']),
    section('激励、公平与规则', 5, ['激励', '奖金', '工资', '公平', '规则']),
  ],
  'wenda-business-11': [
    section('Stop Doing List', 1, ['stop doing', '不为清单', '不做的事情']),
    section('聚焦与取舍', 2, ['聚焦', '取舍', '做得越多']),
    section('更健康更长久', 3, ['更健康更长久', '健康', '长久']),
    section('不做什么的案例', 4, ['不做oem', '不贷款', '不赊账', '不收购', '不上市']),
  ],
  'wenda-business-12': [
    section('收购的成功条件', 1, ['收购', '并购', 'm&a']),
    section('多元化、聚焦与能力圈', 2, ['多元化', '跨行业', '聚焦', '能力圈']),
    section('收购与多元化案例', 3, ['ge', '谷歌', '苹果', '联想', '吉利']),
  ],
  'wenda-company-apple-01': [
    section('产品与用户体验', 1, ['产品', '用户体验', '消费者导向', 'iphone', 'ipad']),
    section('商业模式、生态与聚焦', 2, ['商业模式', '生意模式', '生态', '系统', '黏性', '聚焦', '单一产品', '产品线']),
    section('竞争与长期优势', 3, ['安卓', 'android', '三星', '竞争', '差异化']),
  ],
  'wenda-company-apple-02': [
    section('乔布斯与造钟', 1, ['乔布斯', 'jobs', '造钟人']),
    section('库克与管理层', 2, ['库克', 'cook', 'ceo', '管理层']),
    section('苹果企业文化', 3, ['企业文化', '利润之上', '做对的事情']),
    section('传承、治理与接班', 4, ['接班', '传承', '董事会', '治理']),
  ],
  'wenda-company-apple-03': [
    section('看懂苹果、估值与长期风险', 1, ['看懂', '估值', '市值', '便宜', '贵', '十年', '长期', '风险', '关税']),
    section('买入、持有与卖出', 2, ['买入', '持有', '卖出', '成本']),
    section('分红、回购与现金', 3, ['分红', '回购', '现金中性', '现金']),
  ],
  'wenda-company-maotai-01': [
    section('产品与品质', 1, ['产品', '品质', '好酒', '口感', '年份酒']),
    section('品牌与消费者心智', 2, ['品牌', '心智', '国酒', '少喝酒']),
    section('商业模式、供需与长期优势', 3, ['商业模式', '生意模式', '需求', '供不应求', '提价', '多元化', '系列酒', '葡萄酒', '差异化']),
  ],
  'wenda-company-maotai-02': [
    section('管理层与公司治理', 1, ['管理层', '换帅', '季克良', '治理', '董事会']),
    section('渠道、直销与价格体系', 2, ['渠道', '直销', '经销商', '搭售']),
    section('i茅台与数字化销售', 3, ['i茅台', '发货', '物流', '线上']),
    section('打假与经营问题', 4, ['打假', '假酒', '经营问题', '芯片']),
  ],
  'wenda-company-maotai-03': [
    section('长期价值与十年判断', 1, ['十年', '二十年', '长期', '通胀']),
    section('估值与价格', 2, ['估值', '便宜', '贵', '价格', '市值']),
    section('买入、增持与持有', 3, ['买入', '增持', '持有', '加仓']),
    section('分红与资本配置', 4, ['分红', '资本配置', '资金']),
    section('风险与后续更新', 5, ['风险', '下跌', '增长', '更新']),
  ],
  'wenda-company-bbk': [
    section('从小霸王到步步高', 1, ['小霸王', '创立步步高', '历史']),
    section('企业文化与本分', 2, ['企业文化', '本分', '核心竞争力']),
    section('产品、品牌、渠道与公司案例', 3, ['产品', '品牌', '渠道', '经销商', 'oppo', 'vivo', '小天才']),
    section('步步高的不为清单', 4, ['不做', '不讨价还价', '不代工', '不贷款', '不赊账']),
  ],
  'wenda-company-netease': [
    section('发现与买入网易', 1, ['买入', '一块钱', '现金', '负债', '诉讼']),
    section('游戏是好生意', 2, ['游戏', '梦幻西游', '玩家']),
    section('丁磊与管理团队', 3, ['丁磊', '团队', '管理']),
    section('持有、加仓与卖出', 4, ['持有', '加仓', '卖出', '100倍', '百倍']),
  ],
  'wenda-life-01': [
    section('做对的事情', 1, ['做对的事情', '对的事情', '北斗星']),
    section('把事情做对', 2, ['把事情做对', '效率', '方法']),
    section('长期选择与机会成本', 3, ['长期', '机会成本', '选择']),
  ],
  'wenda-life-02': [
    section('正直与诚信', 1, ['正直', '诚信', '不作恶']),
    section('理性与原则', 2, ['理性', '原则', '圆滑']),
    section('长期视角与脚踏实地', 3, ['长期', '脚踏实地', '长远', '本质']),
  ],
  'wenda-life-03': [
    section('职业选择与创业', 1, ['职业', '工作', '选择', '创业', '生意']),
    section('做喜欢的事情', 2, ['喜欢做', '享受过程', '兴趣']),
    section('迷惘、成长与时间', 3, ['迷惘', '成长', '时光', '过程']),
  ],
  'wenda-life-04': [
    section('家庭与陪伴', 1, ['家庭', '家人', '陪伴', '妻子']),
    section('孩子与安全感', 2, ['孩子', '小孩', '安全感', '无条件的爱']),
    section('教育与成长', 3, ['教育', '学习成绩', '学校', '大学']),
    section('金钱、游戏与边界', 4, ['钱', '游戏', '支持', '躺在钱上']),
  ],
  'wenda-life-05': [
    section('开放心态与学习', 1, ['开放心态', '学习', '放下自我']),
    section('阅读与思考', 2, ['读书', '阅读', '思考']),
    section('公益与社会责任', 3, ['公益', '社会责任', '捐赠']),
    section('教育公益与长期环境', 4, ['教育', '环境', '后代']),
  ],
  'wenda-life-06': [
    section('睡眠', 1, ['睡眠', '睡觉']),
    section('减重与饮食', 2, ['减重', '体重', '饮食', '体脂']),
    section('Zone 2与日常运动', 3, ['zone2', 'zone 2', '运动', '训练']),
    section('心理健康与生活习惯', 4, ['心理健康', '健康', '习惯']),
  ],
}))

const companySubsection = (title, order, keywords) => ({ title, order, keywords })
const industrySection = (title, order, companies) => ({ title, order, companies })

const MERGED_COMPANY_SECTION_CATALOGS = new Map(Object.entries({
  'wenda-company-consumer-electronics': [
    industrySection('国产消费电子', 1, [
      companySubsection('OPPO', 1, ['oppo']),
      companySubsection('vivo', 2, ['vivo']),
    ]),
    industrySection('日本消费电子与游戏', 2, [
      companySubsection('任天堂', 1, ['任天堂', 'nintendo']),
      companySubsection('索尼', 2, ['索尼', 'sony']),
      companySubsection('松下', 3, ['松下', 'panasonic']),
    ]),
  ],
  'wenda-company-china-games': [
    industrySection('中国游戏公司案例', 1, [
      companySubsection('完美世界', 1, ['完美世界']),
      companySubsection('巨人网络', 2, ['巨人网络', '史玉柱']),
      companySubsection('金山', 3, ['金山']),
      companySubsection('畅游', 4, ['畅游']),
      companySubsection('第九城市', 5, ['第九城市', '九城']),
    ]),
  ],
  'wenda-company-tech-platforms': [
    industrySection('互联网平台', 1, [
      companySubsection('腾讯', 1, ['腾讯', '马化腾', '微信']),
      companySubsection('拼多多', 2, ['拼多多', '黄峥']),
      companySubsection('谷歌', 3, ['谷歌', 'google']),
    ]),
    industrySection('科技与新产业', 2, [
      companySubsection('英伟达', 1, ['英伟达', 'nvidia', '黄仁勋']),
      companySubsection('特斯拉', 2, ['特斯拉', 'tesla', '马斯克']),
    ]),
  ],
  'wenda-company-retail-services': [
    industrySection('零售与服务业', 1, [
      companySubsection('Costco', 1, ['costco']),
      companySubsection('新东方', 2, ['新东方', '俞敏洪']),
    ]),
  ],
  'wenda-company-energy-industrial': [
    industrySection('能源与工业企业', 1, [
      companySubsection('OXY（西方石油）', 1, ['oxy', '西方石油']),
      companySubsection('GE（通用电气）', 2, ['通用电气', 'ge', '韦尔奇']),
    ]),
  ],
}))

function cleanInheritedHeading(value) {
  return value
    .replace(/^第[零一二三四五六七八九十百千\d]+[章节]\s*/u, '')
    .replace(/^(?:[零一二三四五六七八九十百千\d]+)[、.．]\s*/u, '')
    .replace(/^：/, '')
    .trim()
}

export function sectionForBlock(topicSlug, block) {
  const context = `${(block.headingPath || []).join(' > ')}\n${block.markdown || ''}`
  const mergedCompanyCatalogue = MERGED_COMPANY_SECTION_CATALOGS.get(topicSlug)
  if (mergedCompanyCatalogue) {
    const lowerContext = context.toLowerCase()
    const lowerMarkdown = (block.markdown || '').toLowerCase()
    const matched = mergedCompanyCatalogue
      .flatMap((parent) => parent.companies.map((company) => {
        const contextHits = company.keywords.filter((keyword) => lowerContext.includes(keyword.toLowerCase()))
        const markdownOccurrences = company.keywords.reduce((count, keyword) => {
          const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return count + (lowerMarkdown.match(new RegExp(escaped, 'g')) || []).length
        }, 0)
        const longest = contextHits.reduce((length, keyword) => Math.max(length, Array.from(keyword).length), 0)
        return { parent, company, score: markdownOccurrences * 10000 + longest * 100 + contextHits.length }
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score
        || left.parent.order - right.parent.order
        || left.company.order - right.company.order)[0]
    if (matched) {
      return {
        title: matched.parent.title,
        order: matched.parent.order,
        subsectionTitle: matched.company.title,
        subsectionOrder: matched.company.order,
      }
    }
    return { title: '跨公司比较', order: mergedCompanyCatalogue.length + 1 }
  }
  const catalogue = SECTION_CATALOGS.get(topicSlug)
  if (catalogue) {
    const lower = context.toLowerCase()
    const matched = catalogue
      .map((item) => {
        const hits = item.keywords.filter((keyword) => lower.includes(keyword.toLowerCase()))
        const longest = hits.reduce((length, keyword) => Math.max(length, Array.from(keyword).length), 0)
        return { item, score: longest * 100 + hits.length }
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.item.order - right.item.order)[0]?.item
    if (matched) return { title: matched.title, order: matched.order }
    const fallback = catalogue.at(-1)
    return { title: fallback.title, order: fallback.order }
  }

  const topic = TOPIC_BY_SLUG.get(topicSlug)
  if (topic) return { title: topic.title, order: 1 }
  return { title: cleanInheritedHeading(block.headingPath?.at(-1) || '相关问答') || '相关问答', order: 1 }
}

function classifyAppleDetail(detail) {
  if (includesAny(detail, ['管理层', '企业文化', '乔布斯', '库克', 'ceo', '造钟人'])) return 'wenda-company-apple-02'
  if (includesAny(detail, ['估值', '价格', '便宜', '贵', '市值', '现金', '回购', '分红', '持有', '买入', '卖出', '资本配置'])) return 'wenda-company-apple-03'
  return 'wenda-company-apple-01'
}

function classifyMaotaiDetail(detail) {
  if (includesAny(detail, ['换帅', '管理层', '治理', '渠道', 'i茅台', '打假', '直销'])) return 'wenda-company-maotai-02'
  if (includesAny(detail, ['估值', '价格', '便宜', '贵', '市值', '增持', '买入', '卖出', '投资', '分红', '十年后', '现金流'])) return 'wenda-company-maotai-03'
  return 'wenda-company-maotai-01'
}

function classifyCompany(context) {
  if (includesAny(context, ['苹果', 'apple', 'iphone', 'ipad', '乔布斯', '库克'])) {
    return classifyAppleDetail(context)
  }
  if (context.includes('茅台')) {
    return classifyMaotaiDetail(context)
  }

  const entities = [
    [['小霸王', '步步高'], 'wenda-company-bbk'],
    [['oppo'], 'wenda-company-consumer-electronics'],
    [['vivo'], 'wenda-company-consumer-electronics'],
    [['网易', '丁磊'], 'wenda-company-netease'],
    [['腾讯', '马化腾', '微信'], 'wenda-company-tech-platforms'],
    [['阿里巴巴', '雅虎', '马云'], 'wenda-company-alibaba-yahoo'],
    [['拼多多', '黄峥'], 'wenda-company-tech-platforms'],
    [['costco'], 'wenda-company-retail-services'],
    [['泡泡玛特', '王宁'], 'wenda-company-pop-mart'],
    [['英伟达', 'nvidia', '黄仁勋'], 'wenda-company-tech-platforms'],
    [['谷歌', 'google'], 'wenda-company-tech-platforms'],
    [['特斯拉', 'tesla', '马斯克'], 'wenda-company-tech-platforms'],
    [['oxy', '西方石油'], 'wenda-company-energy-industrial'],
    [['任天堂', 'nintendo'], 'wenda-company-consumer-electronics'],
    [['索尼', 'sony'], 'wenda-company-consumer-electronics'],
    [['松下'], 'wenda-company-consumer-electronics'],
    [['通用电气', 'ge', '韦尔奇'], 'wenda-company-energy-industrial'],
    [['新东方', '俞敏洪'], 'wenda-company-retail-services'],
    [['完美世界'], 'wenda-company-china-games'],
    [['巨人网络', '史玉柱'], 'wenda-company-china-games'],
    [['金山'], 'wenda-company-china-games'],
    [['畅游'], 'wenda-company-china-games'],
    [['第九城市', '九城'], 'wenda-company-china-games'],
  ]
  for (const [aliases, slug] of entities) if (includesAny(context, aliases)) return slug
  return null
}

function classifyCompositeCompany(markdown, candidates) {
  let best = null
  let bestCount = 0
  const lower = markdown.toLowerCase()
  for (const [aliases, slug] of candidates) {
    let count = 0
    for (const alias of aliases) {
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      count += (lower.match(new RegExp(escaped, 'g')) || []).length
    }
    if (count > bestCount) {
      best = slug
      bestCount = count
    }
  }
  return best
}

function classifyInvestment(context) {
  if (includesAny(context, ['财报', '财务报表', 'roe', '净资产', '资产负债'])) return 'wenda-invest-09'
  if (includesAny(context, ['分红', '回购', '资本配置'])) return 'wenda-invest-10'
  if (includesAny(context, ['什么时候买卖', '买卖股票', '持有=买入', '持有就是买入', '卖出'])) return 'wenda-invest-08'
  if (includesAny(context, ['现金流', '折现', '估值', '市盈率', 'pe'])) return 'wenda-invest-07'
  if (includesAny(context, ['机会成本', '长期持有', '集中投资', '封仓', '十年'])) return 'wenda-invest-06'
  if (includesAny(context, ['宏观', '牛市', '熊市', '市场波动', '波动是朋友'])) return 'wenda-invest-05'
  if (includesAny(context, ['不做空', '借钱', 'margin', '杠杆', '风险第一'])) return 'wenda-invest-04'
  if (includesAny(context, ['能力圈', '看懂', '懂的才', '好生意'])) return 'wenda-invest-03'
  if (includesAny(context, ['套利', '衍生品', '期权', '量化', '投机'])) return 'wenda-invest-11'
  if (includesAny(context, ['golf', '高尔夫', '投资心态', '平常心', '书籍', '阅读'])) return 'wenda-invest-12'
  if (includesAny(context, ['简单但不容易', '适合做股票', '道需悟', '快即是慢'])) return 'wenda-invest-02'
  return 'wenda-invest-01'
}

function classifyBusiness(context) {
  if (includesAny(context, ['收购', '并购', '多元化', 'm&a'])) return 'wenda-business-12'
  if (includesAny(context, ['stop doing', '不为清单', '更健康更长久', '聚焦', '不做什么'])) return 'wenda-business-11'
  if (includesAny(context, ['创始人', 'ceo', '管理层', '团队', '激励', '公平心', '选人'])) return 'wenda-business-10'
  if (includesAny(context, ['核心价值观', '本分', '利润之上的追求'])) return 'wenda-business-09'
  if (includesAny(context, ['企业文化', '基业长青'])) return 'wenda-business-08'
  if (includesAny(context, ['营销', '广告', '渠道', '出海'])) return 'wenda-business-07'
  if (includesAny(context, ['品牌'])) return 'wenda-business-06'
  if (includesAny(context, ['创新', '敢为天下后'])) return 'wenda-business-05'
  if (includesAny(context, ['产品', '用户导向', '消费者导向', '用户需要'])) return 'wenda-business-04'
  if (includesAny(context, ['护城河', '差异化', '价格战'])) return 'wenda-business-03'
  if (includesAny(context, ['伟大企业', '伟大的企业', '长坡', '厚雪', '滚雪球', '造钟人'])) return 'wenda-business-01'
  return 'wenda-business-02'
}

function classifyLife(context) {
  if (includesAny(context, ['睡眠', '减重', 'zone2', 'zone 2', '冰水浴', '健康', '体脂'])) return 'wenda-life-06'
  if (includesAny(context, ['公益', '社会责任', '开放心态', '读书', '学习'])) return 'wenda-life-05'
  if (includesAny(context, ['家庭', '孩子', '小孩', '教育', '家人'])) return 'wenda-life-04'
  if (includesAny(context, ['职业', '创业', '享受过程', '喜欢做的事情', '工作'])) return 'wenda-life-03'
  if (includesAny(context, ['正直', '理性', '长期视角', '胸无大志', '脚踏实地'])) return 'wenda-life-02'
  return 'wenda-life-01'
}

export function classifyBlock(block) {
  const source = block.sourceSlug || ''
  const heading = (block.headingPath || []).join(' > ')
  const lastHeading = block.headingPath?.at(-1) || ''
  const context = `${heading}\n${block.markdown || ''}`

  const companySource = source.includes('disanzhanggongsidianping')
    || source.includes('di7zhang-anlifenxi')
    || (source.includes('diliuzhangduzhegengxin') && includesAny(heading, ['公司点评', '谈公司', '茅台', '泡泡玛特']))
  if (companySource) {
    if (includesAny(heading, ['苹果', 'apple'])) return classifyAppleDetail(`${lastHeading}\n${block.markdown || ''}`)
    if (heading.includes('茅台')) return classifyMaotaiDetail(`${lastHeading}\n${block.markdown || ''}`)
    if (includesAny(lastHeading, ['oppo、vivo', 'oppo、vivo、小天才'])) {
      return classifyCompositeCompany(block.markdown || '', [
        [['oppo'], 'wenda-company-consumer-electronics'],
        [['vivo'], 'wenda-company-consumer-electronics'],
        [['小天才', '步步高'], 'wenda-company-bbk'],
      ]) || 'wenda-company-bbk'
    }
    if (includesAny(lastHeading, ['costco、拼多多'])) {
      return classifyCompositeCompany(block.markdown || '', [
        [['costco'], 'wenda-company-retail-services'],
        [['拼多多', '黄峥'], 'wenda-company-tech-platforms'],
      ]) || 'wenda-company-tech-platforms'
    }
    if (includesAny(lastHeading, ['松下、索尼、任天堂'])) {
      return classifyCompositeCompany(block.markdown || '', [
        [['松下'], 'wenda-company-consumer-electronics'],
        [['索尼', 'sony'], 'wenda-company-consumer-electronics'],
        [['任天堂', 'nintendo'], 'wenda-company-consumer-electronics'],
      ]) || 'wenda-company-consumer-electronics'
    }
    return classifyCompany(lastHeading) || classifyCompany(heading) || classifyCompany(context) || 'wenda-business-02'
  }

  if (source.includes('shangyeluoji-qianyan')) return 'wenda-invest-01'
  if (source.includes('shangyeluoji')) return classifyBusiness(context)
  if (source.includes('touziluoji')) {
    if (includesAny(heading, ['做对的事情，把事情做对'])) return 'wenda-life-01'
    if (includesAny(heading, ['Stop doing list'])) return 'wenda-business-11'
    return classifyInvestment(context)
  }

  if (source.includes('diyizhangtouzidadao')) return classifyInvestment(context)
  if (source.includes('dierzhangshangyemoshiheqiyewenhua')) return classifyBusiness(context)
  if (source.includes('disizhangrenshengzhenyan')) return classifyLife(context)
  if (source.includes('diliuzhangduzhegengxin')) {
    const company = classifyCompany(heading) || classifyCompany(context)
    if (company && includesAny(heading, ['公司', '茅台', '泡泡玛特', 'vivo', 'oppo', '苹果', 'oxy', 'costco', '拼多多'])) return company
    if (includesAny(heading, ['人生', '健康'])) return classifyLife(context)
    if (includesAny(heading, ['商业模式', '企业文化', '产品', '利润之上'])) return classifyBusiness(context)
    return classifyInvestment(context)
  }
  return null
}
