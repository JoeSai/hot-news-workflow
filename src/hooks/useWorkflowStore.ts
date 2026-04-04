import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, NewsItem, Keyword, NodeDataType } from '../types/workflow';
import { runCrawler, extractKeywords, generateContent } from '../services/crawlerApi';

const STORAGE_KEY = 'hot-news-workflow';

// 默认工作流
const DEFAULT_WORKFLOW = {
  nodes: [
    {
      id: 'hotspot-1',
      type: 'hotspotCapture',
      position: { x: 50, y: 200 },
      data: {
        platforms: ['wangyi', 'ithome', 'toutiao', 'zhihu'],
        limit: 20,
        status: 'idle',
        outputType: 'news'
      }
    },
    {
      id: 'keyword-1',
      type: 'keywordExtract',
      position: { x: 400, y: 200 },
      data: {
        topK: 50,
        method: 'phrase',
        keywordStatus: 'idle',
        outputType: 'keywords'
      }
    },
    {
      id: 'topic-1',
      type: 'topicRecommend',
      position: { x: 750, y: 120 },
      data: {}
    },
    {
      id: 'hotword-1',
      type: 'hotwordList',
      position: { x: 750, y: 380 },
      data: {
        selectedKeywords: [],
        outputType: 'keywords'
      }
    },
    {
      id: 'content-1',
      type: 'contentGenerate',
      position: { x: 1100, y: 250 },
      data: {
        style: '科普向',
        apiType: 'deepseek',
        apiKey: '',
        generateStatus: 'idle'
      }
    }
  ],
  edges: [
    { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
    { id: 'e2-3', source: 'keyword-1', target: 'topic-1' },
    { id: 'e2-4', source: 'keyword-1', target: 'hotword-1' },
    { id: 'e4-5', source: 'hotword-1', target: 'content-1' }
  ]
};

// 从 localStorage 加载保存的工作流
function loadWorkflow(): { nodes: Node[]; edges: Edge[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && parsed.nodes.length > 0) {
        return { nodes: parsed.nodes, edges: parsed.edges };
      }
    }
  } catch (e) {
    console.warn('加载工作流失败:', e);
  }
  return DEFAULT_WORKFLOW;
}

// 保存工作流到 localStorage
function saveWorkflow(nodes: Node[], edges: Edge[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  } catch (e) {
    console.warn('保存工作流失败:', e);
  }
}

/**
 * 根据节点类型获取数据
 */
export function getNodeOutputData(node: Node): NodeDataType[] {
  const data = node.data as NodeData;

  if (data.outputType === 'news') return ['news'];
  if (data.outputType === 'keywords') return ['keywords'];
  if (data.outputType === 'wordcloud') return ['wordcloud'];

  // 兼容旧逻辑：根据 node type 判断
  if (node.type === 'hotspotCapture' && data.news?.length) return ['news'];
  if (node.type === 'keywordExtract' && data.keywords?.length) return ['keywords'];

  return [];
}

/**
 * 获取节点接收到的输入数据
 * @param nodeId 当前节点ID
 * @param nodes 所有节点
 * @param edges 所有边
 * @param inputType 需要的数据类型
 * @returns 输入数据或undefined
 */
export function getInputData<T extends NewsItem | Keyword>(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  inputType: NodeDataType
): T[] | undefined {
  // 找到所有连接到当前节点的边（当前节点是target）
  const incomingEdges = edges.filter(e => e.target === nodeId);

  if (incomingEdges.length === 0) return undefined;

  // 获取源节点
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;

    const sourceData = sourceNode.data as NodeData;

    // 根据需求的数据类型返回对应数据
    if (inputType === 'news' && sourceData.news?.length) {
      return sourceData.news as T[];
    }
    if (inputType === 'keywords' && sourceData.keywords?.length) {
      return sourceData.keywords as T[];
    }
    // 支持从热词列表节点读取选中的热词
    if (inputType === 'selectedKeywords' && sourceData.selectedKeywords?.length) {
      // 直接返回完整的 Keyword 对象（含 sourceNews）
      return sourceData.selectedKeywords as T[];
    }
  }

  return undefined;
}

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  clearWorkflow: () => void;
  loadTemplate: (templateId: string) => void;
  runNode: (nodeId: string) => Promise<void>;
  runAll: () => Promise<void>;
}

// 预设工作流模板
export const WORKFLOW_TEMPLATES = [
  {
    id: 'quick-start',
    name: '🚀 快速上手',
    desc: '热点抓取 → 关键词提取 → 热词列表 → AI内容生成',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['wangyi', 'ithome', 'toutiao', 'zhihu'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 50, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'topic-1', type: 'topicRecommend', position: { x: 750, y: 120 }, data: {} },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 380 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 250 }, data: { style: '科普向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'topic-1' },
      { id: 'e2-4', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e4-5', source: 'hotword-1', target: 'content-1' },
    ],
  },
  {
    id: 'ai-daily',
    name: '📰 AI 热点日报',
    desc: '多平台抓取 → 关键词提取 → 选题推荐 → 生成 3 篇短草稿',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['ithome', 'toutiao', 'zhihu', 'hackernews'], limit: 30, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 80, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'topic-1', type: 'topicRecommend', position: { x: 750, y: 120 }, data: {} },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 380 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 250 }, data: { style: '科普向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'topic-1' },
      { id: 'e2-4', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e4-5', source: 'hotword-1', target: 'content-1' },
    ],
  },
  {
    id: 'tech-deep',
    name: '🔬 技术深度分析',
    desc: 'HackerNews + 机器之心 → 深度关键词提取 → 观点向草稿',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['hackernews', 'ithome'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 30, method: 'textrank', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'topic-1', type: 'topicRecommend', position: { x: 750, y: 120 }, data: {} },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 380 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 250 }, data: { style: '观点向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'topic-1' },
      { id: 'e2-4', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e4-5', source: 'hotword-1', target: 'content-1' },
    ],
  },
  {
    id: 'tutorial',
    name: '📚 教程向',
    desc: '热点抓取 → 关键词提取 → 教程向生成',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['wangyi', 'ithome', 'toutiao'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 50, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 380 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 380 }, data: { style: '教程向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e3-4', source: 'hotword-1', target: 'content-1' },
    ],
  },
  {
    id: 'review',
    name: '⚖️ 测评向',
    desc: '产品热点抓取 → 关键词提取 → 测评向草稿',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['ithome', 'toutiao', 'zhihu'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 40, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 380 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 380 }, data: { style: '测评向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e3-4', source: 'hotword-1', target: 'content-1' },
    ],
  },
  {
    id: 'analytics',
    name: '📊 效果追踪',
    desc: '热点抓取 → 关键词提取 → 热度趋势 + 效果记录',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['wangyi', 'ithome', 'toutiao', 'zhihu'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 50, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'trend-1', type: 'trend', position: { x: 750, y: 200 }, data: {} },
      { id: 'record-1', type: 'contentRecord', position: { x: 1100, y: 200 }, data: {} },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'trend-1' },
    ],
  },
  {
    id: 'full-workflow',
    name: '✨ 全功能版',
    desc: '完整工作流：抓取 → 提取 → 词云/趋势/详情 → 生成 → 记录',
    nodes: [
      { id: 'hotspot-1', type: 'hotspotCapture', position: { x: 50, y: 200 }, data: { platforms: ['wangyi', 'ithome', 'toutiao', 'zhihu'], limit: 20, status: 'idle', outputType: 'news' } },
      { id: 'keyword-1', type: 'keywordExtract', position: { x: 400, y: 200 }, data: { topK: 50, method: 'phrase', keywordStatus: 'idle', outputType: 'keywords' } },
      { id: 'wordcloud-1', type: 'wordCloud', position: { x: 750, y: 50 }, data: { wordCloudTopK: 50, wordCloudStatus: 'idle' } },
      { id: 'trend-1', type: 'trend', position: { x: 750, y: 250 }, data: {} },
      { id: 'hotword-1', type: 'hotwordList', position: { x: 750, y: 450 }, data: { selectedKeywords: [], outputType: 'keywords' } },
      { id: 'newsdetail-1', type: 'newsDetail', position: { x: 750, y: 650 }, data: { newsDetailStatus: 'idle' } },
      { id: 'topic-1', type: 'topicRecommend', position: { x: 1100, y: 120 }, data: {} },
      { id: 'content-1', type: 'contentGenerate', position: { x: 1100, y: 350 }, data: { style: '科普向', apiType: 'deepseek', apiKey: '', generateStatus: 'idle' } },
      { id: 'record-1', type: 'contentRecord', position: { x: 1100, y: 550 }, data: {} },
    ],
    edges: [
      { id: 'e1-2', source: 'hotspot-1', target: 'keyword-1' },
      { id: 'e2-3', source: 'keyword-1', target: 'wordcloud-1' },
      { id: 'e2-4', source: 'keyword-1', target: 'trend-1' },
      { id: 'e2-5', source: 'keyword-1', target: 'hotword-1' },
      { id: 'e2-6', source: 'keyword-1', target: 'newsdetail-1' },
      { id: 'e2-7', source: 'keyword-1', target: 'topic-1' },
      { id: 'e5-8', source: 'hotword-1', target: 'content-1' },
      { id: 'e8-9', source: 'content-1', target: 'record-1' },
    ],
  },
];

const savedWorkflow = loadWorkflow();

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: savedWorkflow.nodes,
  edges: savedWorkflow.edges,

  setNodes: (nodes) => {
    set({ nodes });
    saveWorkflow(nodes, get().edges);
  },
  setEdges: (edges) => {
    set({ edges });
    saveWorkflow(get().nodes, edges);
  },

  addNode: (node) => set((state) => {
    const newNodes = [...state.nodes, node];
    saveWorkflow(newNodes, state.edges);
    return { nodes: newNodes };
  }),

  updateNodeData: (nodeId, data) => set((state) => {
    const newNodes = state.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } }
        : node
    );
    saveWorkflow(newNodes, state.edges);
    return { nodes: newNodes };
  }),

  onNodesChange: (changes) => set((state) => {
    const newNodes = applyNodeChanges(changes, state.nodes);
    saveWorkflow(newNodes, state.edges);
    return { nodes: newNodes };
  }),

  onEdgesChange: (changes) => set((state) => {
    const newEdges = applyEdgeChanges(changes, state.edges);
    saveWorkflow(state.nodes, newEdges);
    return { edges: newEdges };
  }),

  onConnect: (connection) => set((state) => {
    const newEdges = addEdge(connection, state.edges);
    saveWorkflow(state.nodes, newEdges);
    return { edges: newEdges };
  }),

  clearWorkflow: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ nodes: [], edges: [] });
  },

  loadTemplate: (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      saveWorkflow(template.nodes, template.edges);
      set({ nodes: template.nodes, edges: template.edges });
    }
  },

  runNode: async (nodeId: string) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeData = node.data as NodeData;

    // 获取输入数据
    const incomingEdges = state.edges.filter(e => e.target === nodeId);
    let inputNews: NewsItem[] = [];

    for (const edge of incomingEdges) {
      const sourceNode = state.nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      const sourceData = sourceNode.data as NodeData;
      if (sourceData.news?.length) inputNews = sourceData.news;
    }

    const update = (data: Partial<NodeData>) => {
      set(s => ({
        nodes: s.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
      }));
    };

    switch (node.type) {
      case 'hotspotCapture': {
        const platforms = nodeData.platforms || [];
        const limit = nodeData.limit || 20;
        if (platforms.length === 0) {
          update({ status: 'error', error: '请至少选择一个平台' });
          return;
        }
        update({ status: 'running' });
        try {
          const result = await runCrawler(platforms, limit);
          update({ status: 'success', news: result.news, outputType: 'news' });
        } catch (e) {
          update({ status: 'error', error: e instanceof Error ? e.message : '抓取失败' });
        }
        break;
      }
      case 'keywordExtract': {
        if (inputNews.length === 0) {
          update({ keywordStatus: 'error', error: '请先抓取热点' });
          return;
        }
        const topK = nodeData.topK || 50;
        const method = nodeData.method || 'phrase';
        update({ keywordStatus: 'running' });
        try {
          const keywords = await extractKeywords(inputNews, topK, method);
          update({ keywords, keywordStatus: 'success', outputType: 'keywords' });
        } catch (e) {
          update({ keywordStatus: 'error', error: e instanceof Error ? e.message : '提取失败' });
        }
        break;
      }
      case 'contentGenerate': {
        const selectedKws = nodeData.selectedKeywords as Keyword[] || [];
        if (selectedKws.length === 0) {
          update({ generateStatus: 'error', error: '请先选择热词' });
          return;
        }
        const style = nodeData.style || '科普向';
        const apiType = nodeData.apiType || 'deepseek';
        const apiKey = nodeData.apiKey || '';
        update({ generateStatus: 'running' });
        try {
          const result = await generateContent({
            keywords: selectedKws,
            newsTitles: inputNews.slice(0, 5).map(n => n.title),
            style,
            apiType,
            apiKey,
          });
          update({
            generateStatus: 'success',
            draft: result.draft,
            draftTitles: result.titles,
            draftBody: result.body,
            draftTags: result.tags
          });
        } catch (e) {
          update({ generateStatus: 'error', error: e instanceof Error ? e.message : '生成失败' });
        }
        break;
      }
    }
  },

  runAll: async () => {
    const state = get();
    // 拓扑排序：从源节点开始
    const nodeMap = new Map(state.nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // 初始化
    for (const node of state.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // 构建图
    for (const edge of state.edges) {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // 找所有源节点（入度为0）
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    // 按顺序执行
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      // 只执行有执行逻辑的节点类型
      if (node.type === 'hotspotCapture' || node.type === 'keywordExtract' || node.type === 'contentGenerate') {
        await get().runNode(nodeId);
      }

      // hotwordList 需要用户交互，runAll 时自动选择 TOP 5 关键词
      if (node.type === 'hotwordList') {
        const nodeData = node.data as NodeData;
        const selectedKws = nodeData.selectedKeywords as Keyword[] || [];
        if (selectedKws.length === 0) {
          // 从输入边获取关键词（上游是 keywordExtract）
          const incomingEdges = state.edges.filter(e => e.target === nodeId);
          for (const edge of incomingEdges) {
            const sourceNode = state.nodes.find(n => n.id === edge.source);
            if (sourceNode) {
              const sourceData = sourceNode.data as NodeData;
              const keywords = sourceData.keywords as Keyword[] || [];
              if (keywords.length > 0) {
                const top5 = keywords.slice(0, 5);
                get().updateNodeData(nodeId, { selectedKeywords: top5, outputType: 'keywords' });
                break;
              }
            }
          }
        }
      }

      // 将后继节点入度-1
      for (const nextId of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(nextId) || 1) - 1;
        inDegree.set(nextId, newDegree);
        if (newDegree === 0) queue.push(nextId);
      }
    }
  },
}));
