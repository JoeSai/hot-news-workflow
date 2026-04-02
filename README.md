# Hot News Workflow

ComfyUI 风格的热点头条工作流界面，支持热点抓取和关键词提取。

## 功能特性

- 🗞️ **热点抓取** - 支持网易新闻、澎湃新闻、腾讯新闻
- 🔥 **关键词提取** - 使用 jieba TF-IDF/TextRank 算法提取热词
- 🔗 **节点工作流** - ComfyUI 风格的可视化节点编辑器
- 🕸️ **关系图谱** - 热点关联可视化

## 技术栈

- **前端**: React 18 + TypeScript + React Flow + TailwindCSS
- **后端**: FastAPI + Python
- **算法**: jieba 中文分词

## 启动方式

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server
pip install -r requirements.txt
cd ..
```

### 2. 启动服务

需要启动两个服务：

**终端 1 - 后端服务（端口 8000）：**

```bash
cd server
python main.py
```

**终端 2 - 前端服务（端口 5173）：**

```bash
npm run dev
```

### 3. 访问应用

打开浏览器访问：http://localhost:5173

## 使用流程

1. 添加「热点抓取」节点 → 点击「加载现有数据」或「重新抓取」
2. 添加「关键词提取」节点
3. 用鼠标连接两个节点（从抓取节点右侧拖到提取节点左侧）
4. 在提取节点中设置参数，点击「提取热词」
5. 查看生成的热词预览

## 项目结构

```
hot-news-workflow/
├── src/
│   ├── components/
│   │   ├── nodes/
│   │   │   ├── HotspotCaptureNode.tsx   # 热点抓取节点
│   │   │   └── KeywordExtractNode.tsx    # 关键词提取节点
│   │   └── WorkflowCanvas.tsx            # 主画布
│   ├── hooks/
│   │   └── useWorkflowStore.ts          # Zustand 状态管理
│   ├── services/
│   │   └── crawlerApi.ts                # API 调用
│   └── types/
│       └── workflow.ts                  # 类型定义
├── server/
│   ├── main.py                          # FastAPI 服务
│   └── requirements.txt                 # Python 依赖
└── package.json
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 检查服务状态 |
| `/api/parse` | GET | 解析已有新闻文件 |
| `/api/crawl` | POST | 重新抓取新闻 |
| `/api/keywords` | POST | 提取关键词 |

## 注意事项

- 后端依赖现有的 `hot_news_spider` 项目进行新闻抓取
- 首次使用建议先运行 `python run.py` 确保爬虫正常工作
