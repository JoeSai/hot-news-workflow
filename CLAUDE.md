# Hot News Workflow

热点新闻工作流系统，支持多平台新闻抓取、关键词提取、选题推荐、AI内容生成，目标是多平台社媒自动运营。

---

## 架构

### 数据流（重要）

节点通过 React Flow 连线传递数据，**不使用全局 store 共享数据**。

```
热点抓取 → 关键词提取 → 选题推荐 → AI内容生成
                ↓              ↓
            词云视图        热词列表
                              ↓
                          热点详情
```

### 当前节点

| 节点 | 类型名 | 功能 |
|------|--------|------|
| 热点抓取 | `hotspotCapture` | 多平台新闻抓取 |
| 关键词提取 | `keywordExtract` | YAKE 关键短语提取 |
| 选题推荐 | `topicRecommend` | AI相关性评分，推荐选题 |
| 热词列表 | `hotwordList` | 可选择热词，支持复制 |
| 词云视图 | `wordCloud` | Canvas 词云渲染 |
| 热点详情 | `newsDetail` | 分页浏览新闻 |
| AI内容生成 | `contentGenerate` | 调用AI生成小红书草稿 |

### 爬虫平台

- **新闻媒体**: 网易、澎湃、腾讯、搜狐、新浪、中国日报
- **科技资讯**: IT之家、今日头条
- **热搜榜单**: 微博、知乎
- **AI垂直**: 36氪、量子位、机器之心、HackerNews

---

## 技术决策

### 关键词提取

使用 **YAKE 关键短语提取**（默认模式 `phrase`），能提取「AI创业」「芯片短缺」等短语。

### 选题推荐

基于 AI 相关性关键词库评分，推荐适合写的选题并标注类型（科普/观点/教程/测评）。

### AI 内容生成

支持 DeepSeek / OpenAI API，生成小红书风格草稿（标题备选、正文、标签）。

### 爬虫防封

- 7 个 User-Agent 轮换
- 2-5 秒随机延迟
- 429 限流退避

### 工作流存储

localStorage 自动保存，刷新不丢失。

---

## 数据模型

```typescript
interface NewsItem {
  title: string;
  url: string;
  img_url?: string;
  pub_time: string;
  source: string;
  category: string;
  channel: string;
}

interface Keyword {
  word: string;
  weight: number;
  type?: 'word' | 'phrase';
}
```

---

## API 端点

```
POST /api/crawl       # 抓取新闻
POST /api/keywords    # 提取关键词
POST /api/generate     # AI生成内容
GET  /api/status      # 服务状态
```

---

## 开发

```bash
pnpm dev                  # 前端 (localhost:5173)
python3 -m server.main   # 后端 (localhost:8000)
pip3 install -r server/requirements.txt
```

---

## 设计原则

- **只生成草稿** — 不做自动发布，用户手动审核
- **效果可验证** — 支持数据回填和对比
- **赛道可迁移** — 架构支持扩展到其他垂类
