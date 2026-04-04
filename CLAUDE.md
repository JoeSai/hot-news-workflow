# Hot News Workflow

热点新闻工作流系统，支持多平台新闻抓取、关键词提取、可视化，目标是多平台社媒自动运营。

---

## 架构

### 数据流（重要）

节点通过 React Flow 连线传递数据，**不使用全局 store 共享数据**。

```
热点抓取 → (news[]) → 关键词提取 → (keywords[]) → 词云
                                    ↓
                              热点详情
```

**节点获取上游数据的标准方式** (`src/hooks/useWorkflowStore.ts`):
```typescript
const news = getInputData<NewsItem>(id, nodes, edges, 'news');
```

### 节点开发

添加新节点需要：
1. 在 `src/components/nodes/` 创建组件
2. 使用 `<Handle>` 声明输入输出
3. 用 `getInputData()` 读取连线数据
4. 用 `updateNodeData()` 存储输出
5. 在 `WorkflowCanvas.tsx` 注册

### 当前节点

| 节点 | 类型名 | 功能 |
|------|--------|------|
| 热点抓取 | `hotspotCapture` | 多平台新闻抓取 |
| 关键词提取 | `keywordExtract` | YAKE 关键短语提取 |
| 词云视图 | `wordCloud` | Canvas 词云渲染 |
| 热点详情 | `newsDetail` | 分页浏览新闻 |

---

## 技术决策

### 关键词提取

使用 **YAKE 关键短语提取**（默认模式 `phrase`），能提取「AI创业」「芯片短缺」等短语，而非单独高频词。

过滤通用词：特朗普、伊朗、报道据悉、去年今年...

### 爬虫防封

- 7 个 User-Agent 轮换
- 2-5 秒随机延迟
- 429 限流 10/20/30 秒退避
- 指数退避 2/4/8 秒

### 工作流存储

节点和连线自动保存到 localStorage（key: `hot-news-workflow`），刷新页面自动恢复。

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
  score?: number;
}
```

---

## 开发

```bash
pnpm dev                  # 前端 (localhost:5173)
python3 -m server.main  # 后端 (localhost:8000)
pip3 install -r server/requirements.txt
```

---

## 扩展方向

1. **内容生成节点** — 接入 AI，基于热词生成社媒内容
2. **多平台发布** — 小红书、微博、X 等
3. **定时发布** — Cron 调度
4. **审核流程** — 生成内容先审后发
