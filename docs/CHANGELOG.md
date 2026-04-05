# 更新日志

---

## v0.21

**Features (v0.18-R1):**
- **v0.21-R1: 选题推荐与热词列表合并** - 新增 `TopicHotwordNode`（选题热词合并版），上半推荐选题（带评分），下半热词选择；推荐确认后自动填充已选热词；旧节点按钮从节点面板移除，所有工作流模板已迁移至合并版

**Bug Fixes:**
- **v0.18-B2: TopicRecommendNode 增加 source Handle** - 新增右侧输出把手，输出类型写入 `keywords` 字段，打通与下游节点的数据流
- **UI 修复：AI 设置面板遮挡问题** - 将 AI 设置浮层从顶部居中改为右上角展开，不再遮挡工作流模板展开按钮
- **B1: saveKeywordTrends 增加 success 校验** - `crawlerApi.ts` 添加 `data.success` 检查，异常时抛出明确错误，避免失败被当作成功
- **B2: getContentStats 增加 success 校验** - `crawlerApi.ts` 添加 `result.success` 检查，避免后端异常时返回空统计

---

## v0.20

**Features:**
- **v0.20-R1: 选题推荐标记「近期已写过」** - `TopicRecommendNode` 引入 `useDraftHistory`，近 7 天草稿关键词在推荐结果中标记「📝 已写过」
- **v0.20-R2: 草稿一键复制** - `ContentGenerateNode` 新增"🚀 一键复制全部"按钮，拼接标题+正文+标签直接复制到剪贴板
- **v0.20-R5: AI 周报文字总结** - `ContentRecordNode` 新增"🤖 AI 生成文字总结"按钮，调用 LLM 生成自然语言运营分析；后端新增 `/api/report/summary` 端点

---

## v0.17

**Bug Fixes (P2.4.5):**
- **P2.4.5a: 去重截断** - `seen` 字典存储完整词 `full_word`，去重 key 仍用前3字符，避免 "Mysterious" → "Mys" 输出
- **P2.4.5b: 英文 NLP 管道** - 新增 `_is_chinese()` 语言检测；中文用 jieba+YAKE(zh)，英文直接用 YAKE(en)，避免 jieba 切碎英文
- **P2.4.5d: 最短长度过滤** - 英文关键词 ≥4 字符，中文关键词 ≥2 字符

**Note:** P2.4.5c（英文关键词翻译为中文）需要额外 LLM 基础设施，暂未实现

---

## v0.16

**Features:**
- **P2.5.2: 草稿多版本对比** - 每次生成自动保存到 `draftVersions`（最多10个）；历史列表支持多选（2-4个）横向对比标题/正文/标签/热词；节点版本与后端草稿历史同步展示

---

## v0.15

**P2.5.1 runAll 进度可视化:**
- `useWorkflowStore` 新增 `runningNodeId` 状态追踪当前执行节点
- `runAll` 执行过程中实时标记当前节点 ID
- 节点面板按钮显示当前正在执行的节点名称（热点抓取 → 关键词提取 → AI内容生成...）

---

## v0.14

**Bug Fixes (B5-B7):**
- **B5: YAKE 预处理正则修复** - `preprocess_for_yake` 的标点正则字符类闭合错误 + `\$` 改为 `$`，中文标点正确替换为句子边界
- **B6: runAll 内容生成读不到热词** - `runNode` 的 `contentGenerate` 分支改为从上游边读取 `selectedKeywords`
- **B7: is_valid_keyphrase 正则修复** - `\$` 改为 `$`，纯数字和百分比正确过滤

**质量打磨:**
- **前端 API success 检查** - `runCrawler`、`parseHotNewsFile`、`extractKeywords`、`getKeywordTrends`、`getContentRecords` 添加 `data.success` 检查
- **微博 fallback 退避延迟** - 主方法失败后延迟 2 秒再调用 fallback，降低被封风险

---

## v0.13

**技术债务修复 & 平台恢复**

**Bug Fixes:**
- **F1: 新节点加入面板 + 模板更新** - 新增「📊 效果追踪」「✨ 全功能版」两个工作流模板；节点面板添加热度趋势、内容效果记录、封面图辅助按钮
- **F2: 输入验证** - 后端 API 添加 Pydantic Field 约束（ge=0, max_length 等），Query 参数添加约束（ge=1, le=500）
- **F3: fetchWithTimeout 补全** - `parseHotNewsFile`、`extractKeywords`、`saveKeywordTrends`、`getKeywordTrends` 添加超时支持
- **F4: 删除 500ms setTimeout** - `runAll` 函数移除无意义的 500ms 等待，修复慢速网络下数据不一致
- **F5: TrendNode useEffect 依赖** - 重组代码顺序，`loadTrends` 用 `useCallback` 定义后供 `useEffect` 调用
- **F6: CORS 收紧** - `allow_methods` 从 `["*"]` 改为 `["GET", "POST", "DELETE", "OPTIONS"]`，`allow_headers` 仅允许 `["Content-Type"]`

**P2.4 平台恢复:**
- 启用全部平台（澎湃、微博、36氪、量子位、机器之心）
- 爬虫重构：量子位/机器之心改用首页抓取 + RSS/API 备用
- 微博改用移动端 API + 网页抓取备用
- 36氪 RSS 解析修复

**F1 新模板:**
- 新增「📊 效果追踪」模板（热点 → 关键词 → 趋势 → 记录）
- 新增「✨ 全功能版」模板（完整工作流示例）

---

## v0.12

**封面图辅助 & P2.2 内容效果记录**

**P2.2 内容效果记录：**
- 新增「内容效果记录」节点
- 关联草稿 + 填写互动数据（点赞/收藏/评论/分享）
- 历史记录列表（最近30条）
- 统计概览：总笔记数、平均互动量
- 支持多平台：小红书/微信公众号/微博/抖音/知乎
- 后端新增 `content_records` 表和 5 个 API 端点

**P2.4 封面图辅助：**
- 新增「封面图辅助」节点
- 4 种模板：文字卡片、对比图、清单图、金句图
- 标题 + 副标题输入
- 5 种配色方案
- Canvas 导出 PNG (1080×1440)

---

## v0.11

- 新增「内容效果记录」节点
- 关联草稿 + 填写互动数据（点赞/收藏/评论/分享）
- 历史记录列表（最近30条）
- 统计概览：总笔记数、平均互动量
- 支持多平台：小红书/微信公众号/微博/抖音/知乎
- 后端新增 `content_records` 表和 5 个 API 端点

---

## v0.11

**技术债务修复**

- **T1: SQLite 并发安全** - 添加 `threading.Lock()` 写锁，修复 `check_same_thread=False` 风险；所有数据库操作用 `try/finally` 防止连接泄漏
- **T2: 草稿存储统一** - `useDraftHistory` 改走后端 API (SQLite)，删除 localStorage 双写
- **T3: Run All 自动选词** - 热词列表无预选时自动取 TOP 5 关键词填充
- **T4: Store 清理** - 删除无用的 `news`/`keywords` 全局字段
- **T5: 请求超时机制** - fetch 添加 `AbortController.timeout`，爬虫 60s、AI 生成 90s、其他 30s

**热度趋势图**

- 新增「热度趋势」节点，展示关键词 7/14/30 天趋势折线图
- SVG 折线图渲染，自动计算权重归一化
- 趋势状态标记：上升↑、下降↓、爆发🔥、平稳→
- 关键词选择器，点击切换追踪的关键词
- 后端新增 `keyword_trends` 表存储每日关键词快照
- API: `POST /api/keywords/trend` 保存趋势、`GET /api/keywords/trend` 查询趋势

---

## v0.10

**热度趋势图**

- 新增「热度趋势」节点，展示关键词 7/14/30 天趋势折线图
- SVG 折线图渲染，自动计算权重归一化
- 趋势状态标记：上升↑、下降↓、爆发🔥、平稳→
- 关键词选择器，点击切换追踪的关键词
- 后端新增 `keyword_trends` 表存储每日关键词快照
- API: `POST /api/keywords/trend` 保存趋势、`GET /api/keywords/trend` 查询趋势

---

## v0.10

**小红书笔记预览**

- 内容生成节点新增「🌸 小红书预览」模式
- 模拟小红书卡片排版：封面占位、标题、正文、标签
- 一键复制标题/正文/标签按钮
- 点击切换编辑视图和预览视图

---

## v0.9

**后端 SQLite 持久化**

- 新增 `server/db.py` 数据库模块
- 表结构：drafts（草稿）、crawl_history（抓取历史）、workflow_configs（工作流配置）
- API 端点：
  - `POST /api/drafts` - 保存草稿
  - `GET /api/drafts` - 获取草稿列表
  - `GET /api/drafts/{id}` - 获取单个草稿
  - `DELETE /api/drafts/{id}` - 删除草稿
  - `GET /api/crawl/history` - 获取抓取历史
  - `POST /api/crawl/history` - 保存抓取历史
- 草稿数据存储到 SQLite，刷新不丢失

---

## v0.8

**一键执行 Run All**

- 新增 `runNode` action 支持单独执行任意节点
- 新增 `runAll` action 自动拓扑排序并依次执行
- 画布左上角「▶ 一键执行」按钮
- 执行状态实时显示（执行中...）
- 支持节点：热点抓取 → 关键词提取 → AI内容生成

---

## v0.7

**爬虫模块化重构**

- 所有爬虫移至 `server/crawlers/` 目录独立文件
- 支持平台：微博、知乎、今日头条、36氪、量子位、机器之心、HackerNews
- 每个爬虫可独立导入和测试
- `from crawlers import WeiboSpider` 即可使用

---

## v0.6

**工作流模板**

- 新增 5 个预设工作流模板：快速上手、AI热点日报、技术深度分析、教程向、测评向
- 画布右上角「工作流模板」面板一键切换
- 加载模板前确认提示，避免误操作
- 每个模板预设不同平台组合和 AI 风格

---

## v0.5

**草稿历史 + 导出功能**

- 新增草稿历史管理（本地存储，最多保存 50 条）
- 支持导出为 Markdown / JSON / TXT 格式
- 内容生成节点右上角「历史」按钮一键切换
- 点击草稿可展开预览标题、正文、标签
- 草稿自动保存到 localStorage，刷新不丢失

---

## v0.4

**关键词提取质量修复**

- jieba 预分词处理，中文分词更准确
- 新增低质量短语过滤规则
- 支持勾选「使用服务端 Key」，API Key 可配置在后端环境变量中，无需每次输入

**平台爬虫修复**

- 修复 IT之家、腾讯新闻、中国日报、36氪 四个平台失效问题

**关键词-热点关联修复**

- 关键词携带来源新闻（source_news），生成时精准关联热点事件
- 热词列表支持手动编辑（添加/删除自定义热词）
- 后端返回结构化草稿，消除前端正则解析
- 澎湃新闻、微博热搜、量子位、机器之心 标记为「维护中」（暂时不可选）

---

## v0.3

- 修复 AI 内容生成接口字段名错误
- 支持 MiniMax / 通义千问 / 智谱等多 API 配置

---

## v0.2

**核心功能闭环完成：抓 → 选 → 生成**

- 新增 AI 内容生成节点（草稿模式）
- 新增选题推荐节点
- 新增热词列表、词云视图、热点详情节点
- 新增 36氪、量子位、机器之心、Hacker News 等 AI 垂直源

---

## v0.1

- 热点抓取节点
- 关键词提取节点
- 基础工作流画布
