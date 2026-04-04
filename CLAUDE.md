# Hot News Workflow

热点新闻工作流系统 - 支持多平台新闻抓取、关键词提取、可视化图表生成。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + TailwindCSS
- **自动存储**: localStorage 自动保存工作流，刷新页面不丢失
- **可视化**: React Flow (@xyflow/react) - ComfyUI 风格工作流编辑器
- **状态管理**: Zustand
- **后端**: Python FastAPI + jieba (关键词提取)
- **爬虫**: requests + lxml (多平台新闻抓取)

## 项目结构

```
hot-news-workflow/
├── src/
│   ├── components/
│   │   ├── WorkflowCanvas.tsx      # 主画布 (React Flow)
│   │   ├── nodes/
│   │   │   ├── HotspotCaptureNode.tsx   # 热点抓取节点
│   │   │   ├── KeywordExtractNode.tsx   # 关键词提取节点
│   │   │   ├── WordCloudNode.tsx        # 词云可视化
│   │   │   ├── GraphNode.tsx            # 关系图谱
│   │   │   ├── TimelineNode.tsx         # 时间线
│   │   │   └── ForceGraphNode.tsx       # 力导向图
│   ├── hooks/
│   │   └── useWorkflowStore.ts    # Zustand 状态管理
│   ├── services/
│   │   └── crawlerApi.ts          # API 调用
│   └── types/
│       └── workflow.ts             # TypeScript 类型
├── server/
│   ├── spider.py                  # 爬虫核心 (多平台)
│   ├── main.py                    # FastAPI 服务
│   └── crawlers/                  # 独立爬虫模块
└── package.json
```

## 节点类型

| 节点 | 类型名 | 功能 |
|------|--------|------|
| 热点抓取 | `hotspotCapture` | 从多平台抓取新闻 |
| 关键词提取 | `keywordExtract` | TF-IDF/TextRank 提取热词 |
| 词云视图 | `wordCloud` | Canvas 词云可视化 |
| 关系图谱 | `graph` | SVG 节点-连线图 |
| 时间线 | `timeline` | 按时间排列的新闻 |
| 力导向图 | `forceGraph` | 可拖拽的力导向布局 |
| 热点详情 | `newsDetail` | 分页浏览新闻详情 |

## 爬虫平台

支持平台: `wangyi`, `pengpai`, `tencent`, `souhu`, `ithome`, `xinlang`, `weibo`, `zhihu`, `toutiao`, `zhongguoribao`

## API 端点

```
GET  /api/status      # 服务状态
GET  /api/parse       # 解析已有数据
POST /api/crawl       # 抓取新闻
POST /api/keywords     # 提取关键词
```

## 数据类型

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
  type?: 'word' | 'phrase';  // 词或短语
  score?: number;             // YAKE 得分（仅 phrase 模式）
}
```

## 工作流自动存储

工作流节点和连线自动保存到浏览器 localStorage，刷新页面后自动恢复。
如需清除，请点击左侧面板的「清除工作流」按钮。

## 开发命令

```bash
pnpm dev               # 启动前端 (localhost:5173)
python3 -m server.main # 启动后端 (localhost:8000) - 需要在项目根目录
pnpm build             # 构建生产版本
```

## 添加新节点

1. 在 `src/components/nodes/` 创建新节点组件
2. 组件需接收 `{ id, data }` props，返回包含 `<Handle>` 的 React 组件
3. 在 `WorkflowCanvas.tsx` 注册节点类型:
   ```typescript
   import NewNode from './nodes/NewNode';
   const nodeTypes = {
     ...existing,
     newNode: NewNode,
   };
   ```
4. 添加节点面板按钮

## 添加新爬虫

1. 在 `server/spider.py` 或 `server/crawlers/` 添加爬虫类
2. 实现 `get_news_list(limit)` 方法返回 `List[Dict]`
3. 可选实现 `get_news_info(item)` 方法获取详情
4. 在 `get_spider()` 函数中注册

## 工作流数据流

```
热点抓取节点 → (news[]) → 关键词提取节点 → (keywords[])
                ↓                          ↓
           热点详情                    ┌─────────┼─────────┐
                              词云视图   关系图谱   时间线/力导向图
```

## 扩展方向

- 添加内容生成节点（基于热词生成社媒内容）
- 添加数据持久化
- 添加定时抓取
- 添加更多可视化类型
- 添加导出功能（PDF、图片等）
