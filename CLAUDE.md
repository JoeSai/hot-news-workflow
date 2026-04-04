# Hot News Workflow

热点新闻工作流系统，支持多平台新闻抓取、关键词提取、选题推荐、AI内容生成，目标是多平台社媒自动运营。

---

## 架构

### 数据流（重要）

节点通过 React Flow 连线传递数据，**不使用全局 store 共享数据**。

```
热点抓取 → 关键词提取 → 选题推荐 → AI内容生成 → 效果记录
                ↓              ↓           ↓
            词云视图        热词列表     封面图片
                ↓              ↓
            热度趋势        热点详情
```

### 当前节点（10 个）

| 节点 | 类型名 | 功能 |
|------|--------|------|
| 热点抓取 | `hotspotCapture` | 多平台新闻抓取 |
| 关键词提取 | `keywordExtract` | YAKE 关键短语提取 |
| 选题推荐 | `topicRecommend` | AI相关性评分，推荐选题 |
| 热词列表 | `hotwordList` | 可选择热词，支持复制 |
| 词云视图 | `wordCloud` | Canvas 词云渲染 |
| 热点详情 | `newsDetail` | 分页浏览新闻 |
| AI内容生成 | `contentGenerate` | 调用AI生成小红书草稿 |
| 热度趋势 | `trend` | SVG 折线图，7/14/30 天趋势 |
| 效果记录 | `contentRecord` | 手动回填互动数据，统计概览 |
| 封面图片 | `coverImage` | 4 模板，Canvas 导出 PNG |

### 爬虫平台（15 个）

- **新闻媒体**: 网易、澎湃、腾讯、腾讯体育、搜狐、新浪、中国日报
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

---

## 开发工作流（重要）

### 文档协议

本项目通过文档驱动开发。你（Claude Code）是**开发者**，产品经理通过文档下发任务：

| 文档 | 你的操作 |
|------|----------|
| `docs/TECH-REVIEW.md` | **读取** → 修复所有 🔴 和 🟠 标记的 bug |
| `docs/PRODUCT-REQUIREMENTS.md` | **读取** → 实现状态为「待开发」的需求 |
| `docs/CHANGELOG.md` | **写入** → 每次修复/开发后更新 |

### 任务优先级

**Bug 优先于需求。** 只有 TECH-REVIEW 中没有 🔴/🟠 标记的 bug 时，才去做 PRODUCT-REQUIREMENTS 中的需求。

需求和 bug 按版本号组织，编号格式：`v0.17-R1`（需求）、`v0.17-B1`（bug）。按版本顺序做，每次只做一个版本。

### 接到任务时的标准流程

1. **先读文档**：打开 `docs/TECH-REVIEW.md`，找到「待修 Bug」章节中所有 🔴 和 🟠 标记的 bug
2. **按优先级修**：🔴 先修，🟠 后修，🟡 可选
3. **逐个修复**：每个 bug 都有精确的文件路径、行号、当前代码和修复代码
4. **没有 bug 时**：打开 `docs/PRODUCT-REQUIREMENTS.md`，找到下一个待开发版本的需求，实现它
5. **构建验证（必须）**：每完成一轮修复后运行 `pnpm build`，确保零编译错误。如果有报错，立即修复后再继续
6. **更新 CHANGELOG**：在 `docs/CHANGELOG.md` 顶部添加新版本记录
7. **完工标记**：所有修复完成且 build 通过后，在终端输出 `✅ 本轮修复完成，build 通过`

### CHANGELOG 格式

```markdown
## v{版本号}

**Bug Fixes:**
- **v{X}-B{N}: {标题}** - {一句话描述}

**Features:**
- **v{X}-R{N}: {标题}** - {一句话描述}
```

### 注意事项

- 不要修改 TECH-REVIEW.md 和 PRODUCT-REQUIREMENTS.md — 那是产品经理的文档
- Bug 描述中的「修复代码」是建议，如果你有更好的方案可以用自己的
- 修复 `runAll` 相关 bug 时，注意 Zustand 的 `get()` vs 闭包快照区别
- 正则表达式修改时，本地用 Python/JS REPL 验证一下
