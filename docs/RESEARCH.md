# 爬虫技术调研

> 调研时间：2026-04-05
> 目标：v0.22 爬虫专项优化提供技术依据

---

## 1. 量子位 / 机器之心 抓取失败分析

**现象**：两个平台长期抓取失败，返回空数据。

**根因**：网站已重构，XPath 选择器失效。

- **量子位** (`qbitai.com`)：网站已迁移至 Next.js 架构，HTML 结构完全改变。原来使用的 XPath 选择器（如 `//div[@class='news-list']//a/@href`）已不匹配当前 DOM。
- **机器之心** (`jiqizhixin.com`)：同样经历了前端架构升级，静态 HTML 改为客户端渲染，SPA 加载后数据才注入。

**现状**：`server/spider.py` 中的 `LiangziSpider` 和 `JiQiXinSpider` 各有两套实现：
1. `server/crawlers/*.py`（旧独立爬虫）
2. `server/spider.py` 内嵌版本（使用 API + XPath fallback）

两个版本的选择器均已过时。

**修复方向**：
- 优先使用官方 API（`https://www.qbitai.com/api/search?q=AI&limit=20` / `https://www.jiqizhixin.com/api/articles?tag=AI&limit=20`）
- API 失败时改用 RSS 订阅源（两个平台均提供 RSS）
- XPath 修复作为最后 fallback，需重新抓取页面定位选择器

---

## 2. GitHub Trending 采集

**目标**：为 AI 赛道补充 GitHub 热场选题来源。

### 方案对比

| 方案 | 难度 | 稳定性 | 说明 |
|------|------|--------|------|
| 爬取 `github.com/trending` | 低 | 高 | 页面结构简单，有 `/trending` 和 `/trending/AI` 子路径 |
| GitHub REST API | 高 | 高 | 需要 token，有速率限制（60 req/h 匿名） |
| 第三方聚合 API | 中 | 中 | 各平台可靠性不一 |

**推荐方案**：直接爬取 GitHub Trending 页面。

**技术细节**：
- 页面结构稳定：`article` 元素内含 `h2 a`（仓库名）、`p`（描述）、`span`（语言/星标）
- 示例 URL：`https://github.com/trending?since=daily`（日榜）
- 无需登录即可访问，User-Agent 正常即可
- 建议路径：`/github-trending` 节点，采集仓库名、描述、语言、Star 数、今日新增

**注意事项**：
- GitHub 有反爬机制，需控制请求频率（已有随机延迟和 UA 轮换，应可正常工作）
- 不采集具体项目页，避免触发更深层爬虫

---

## 3. X (Twitter) 热门话题采集

**背景**：snscrape 已停止维护，官方 API 需要付费。调研替代方案。

### 方案对比

| 方案 | 成本 | 难度 | 可靠性 |
|------|------|------|--------|
| **twikit** (第三方库) | 免费 | 中 | 需账号 cookie，稳定性中等 |
| snscrape | 免费 | 低 | ⚠️ 已停止维护，不推荐新引入 |
| nitter (第三方开源) | 免费 | 高 | 实例不稳定，大多数已关闭 |
| 第三方付费 API | $5-$50/mo | 低 | RapidAPI 等平台有多个 Twitter API |
| 官方 Twitter API v2 | $100+/mo | 低 | 成本过高，不适合个人用户 |

**推荐方案**：`twikit` + 公共列表组合。

`twikit` 使用实例：
```python
from twikit import Client

async def get_trending():
    client = Client('en')
    await client.login(auth_info_1='email', auth_info_2='password')
    trends = await client.get_topic_trends()
```

**限制**：
- twikit 需要用户名密码登录，cookie 过期需重新认证
- 不适合服务器端长期运行（cookie 会话管理复杂）

**替代思路**：X 热门话题本质是趋势词聚合。考虑改用**微博热搜**（已有）或**知乎热榜**（已有）作为同类型替代，X 不作为核心来源。

---

## 4. 爬虫稳定性提升

**现有措施（已实现）**：
- 7 个 User-Agent 轮换
- 2-5 秒随机请求延迟
- 指数退避重试：2s → 4s → 8s（普通失败）；10s → 20s → 30s（429 限流）
- 多 spider 独立超时（60s 爬虫，90s AI 生成）

**可增强方向**：

### 4.1 并发分层超时预算
**当前问题**：多平台串行抓取，慢平台拖垮整体。

**优化方案**：
- 按历史响应速度将平台分三层：
  - **快速层**（<3s）：微博、知乎、IT之家、36氪
  - **中速层**（3-10s）：网易、腾讯、搜狐、HackerNews
  - **慢速层**（>10s）：澎湃、量子位、机器之心
- 快速层并发请求（Promise.allSettled）
- 每层设置超时，超时后返回已抓到的数据，不等待

**收益**：首屏时间从 max(所有平台) → max(快速层) + 慢层后台继续

### 4.2 部分成功先返回
**当前问题**：任一平台失败可能影响整体。

**优化方案**：
- `runAll` 使用 `Promise.allSettled` 代替 `Promise.all`
- 每个平台独立 success/fail 状态
- 失败平台记录到 `crawlHistory.failures[]`，不影响已成功的平台数据
- 页面展示"部分成功"状态，用户可见哪些平台失败

### 4.3 平台健康度自适应
- 连续 3 次抓取失败的平台自动降低请求频率（从每次都抓到每 3 次跳过一次）
- 恢复机制：手动触发或 24 小时后重试
- 记录到 crawlHistory 供后续分析

### 4.4 失败平台自动跳过（已有雏形）
`BaseSpider.request()` 已实现指数退避，但遇到持续 429 时会卡住较久。建议增加最大重试次数（当前 3 次），超过后标记失败并继续。

---

## 5. AI 赛道相关性重排

**问题**：抓到的热点与 AI 相关性弱，用户需要大量人工筛选。

**优化方案**：

### 5.1 AI 词库过滤
构建 AI 相关关键词白名单/黑名单：
- **白名单**（强 AI 相关）：大模型、LLM、GPT、ChatGPT、AI、神经网络、机器学习、深度学习、AIGC、Stable Diffusion、Midjourney、Claude、 Gemini、文心、通义、盘古、芯片、GPU、算力、OpenAI...
- **黑名单**（弱 AI 相关）：明星、娱乐圈、体育赛事、纯娱乐...

抓取后先过词库，命中白名单优先展示，命中黑名单降权。

### 5.2 来源权重
不同平台在 AI 选题上的命中率不同：
- **高权重**：机器之心、量子位、36氪、HackerNews（已有）
- **中权重**：微博（AI 圈讨论）、知乎（AI 话题）
- **低权重**：通用新闻（网易、澎湃等）

可在 `newsDetail` 或 `topicRecommend` 节点加权重排。

### 5.3 标题语义打分
用本地关键词共现模型打分（无需调用 LLM）：
- 标题中同时出现 "AI" + "创业" → 高分
- 标题中同时出现 "AI" + "发布" → 高分
- 纯娱乐标题（"明星离婚"）即使有 AI 关键词也降权

---

## 6. v0.22 开发优先级建议

| 优先级 | 任务 | 工作量 | 风险 |
|--------|------|--------|------|
| P0 | 量子位/机器之心 API 修复 | 低 | 低 |
| P1 | GitHub Trending 节点 | 中 | 低 |
| P1 | 并发分层超时预算 | 中 | 中 |
| P2 | 部分成功先返回 | 低 | 低 |
| P2 | X/Twitter 采集（twikit） | 中 | 高（cookie 管理复杂） |
| P3 | AI 赛道词库过滤 | 中 | 低 |
| P3 | 平台健康度自适应 | 低 | 低 |

**建议执行顺序**：P0 → P1(并发) → P1(GitHub) → P2 → P3
