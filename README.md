# Hot News Workflow

ComfyUI 风格的热点头条工作流系统，支持多平台新闻抓取、关键词提取和可视化图表生成。

## 功能特性

- **多平台抓取** - 支持 10 个新闻平台（网易、澎湃、腾讯、搜狐、新浪、微博、知乎、今日头条、IT之家、中国日报）
- **关键词提取** - 使用 jieba TF-IDF/TextRank 算法提取热词
- **可视化图表** - 词云、关系图谱、时间线、力导向图
- **节点工作流** - ComfyUI 风格的可视化节点编辑器

## 技术栈

- **前端**: React 19 + TypeScript + Vite + TailwindCSS
- **可视化**: React Flow (@xyflow/react) - ComfyUI 风格工作流编辑器
- **状态管理**: Zustand
- **后端**: Python FastAPI + jieba (关键词提取)
- **爬虫**: requests + lxml (多平台新闻抓取)

## 快速启动

### 1. 安装依赖

```bash
# 前端依赖
pnpm install

# 后端依赖
cd server && pip install -r requirements.txt && cd ..
```

### 2. 启动服务

需要启动两个服务：

**终端 1 - 后端服务（端口 8000）：**
```bash
cd server
pip install -r requirements.txt  # 如果还没安装
python3 -m server.main
```

**终端 2 - 前端服务（端口 5173）：**
```bash
pnpm dev
```

### 3. 访问应用

打开浏览器访问：http://localhost:5173

## 使用流程

1. 添加「热点抓取」节点 → 选择平台 → 点击「抓取热点」
2. 添加「关键词提取」节点
3. 用鼠标连接两个节点（从抓取节点右侧拖到提取节点左侧）
4. 在提取节点中设置参数，点击「提取热词」
5. 添加可视化节点（词云/关系图谱/时间线/力导向图/热点详情）

## 支持的平台

| 平台 | ID | 分类 |
|------|-----|------|
| 网易新闻 | `wangyi` |新闻媒体|
| 澎湃新闻 | `pengpai` |新闻媒体|
| 腾讯新闻 | `tencent` |新闻媒体|
| 搜狐新闻 | `souhu` |新闻媒体|
| 新浪国际 | `xinlang` |新闻媒体|
| 中国日报 | `zhongguoribao` |新闻媒体|
| IT之家 | `ithome` |科技资讯|
| 今日头条 | `toutiao` |科技资讯|
| 微博热搜 | `weibo` |热搜榜单|
| 知乎热榜 | `zhihu` |热搜榜单|

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 检查服务状态 |
| `/api/parse` | GET | 解析已有新闻文件 |
| `/api/crawl` | POST | 重新抓取新闻 |
| `/api/keywords` | POST | 提取关键词 |

### 抓取示例

```bash
curl -X POST http://localhost:8000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"platforms": ["wangyi", "weibo", "toutiao"], "limit": 10}'
```

## 项目结构

```
hot-news-workflow/
├── src/
│   ├── components/
│   │   ├── WorkflowCanvas.tsx      # 主画布 (React Flow)
│   │   └── nodes/
│   │       ├── HotspotCaptureNode.tsx   # 热点抓取节点
│   │       ├── KeywordExtractNode.tsx   # 关键词提取节点
│   │       ├── WordCloudNode.tsx        # 词云可视化
│   │       ├── GraphNode.tsx            # 关系图谱
│   │       ├── TimelineNode.tsx         # 时间线
│   │       ├── ForceGraphNode.tsx       # 力导向图
│   │       └── NewsDetailNode.tsx       # 热点详情
│   ├── hooks/
│   │   └── useWorkflowStore.ts          # Zustand 状态管理
│   ├── services/
│   │   └── crawlerApi.ts                 # API 调用
│   └── types/
│       └── workflow.ts                   # 类型定义
├── server/
│   ├── spider.py                        # 爬虫核心 (10个平台)
│   ├── main.py                          # FastAPI 服务
│   ├── requirements.txt                  # Python 依赖
│   └── crawlers/                        # 独立爬虫模块
└── package.json
```

## 注意事项

- 后端启动需要在项目根目录使用 `python3 -m server.main`
- 首次使用建议先测试爬虫是否正常工作
- 部分平台可能需要网络代理才能访问
