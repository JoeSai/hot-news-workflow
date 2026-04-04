import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, NewsItem, Keyword, NodeDataType } from '../types/workflow';

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
  news: NewsItem[];
  keywords: Keyword[];

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  setNews: (news: NewsItem[]) => void;
  setKeywords: (keywords: Keyword[]) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  clearWorkflow: () => void;
  loadTemplate: (templateId: string) => void;
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
];

const savedWorkflow = loadWorkflow();

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: savedWorkflow.nodes,
  edges: savedWorkflow.edges,
  news: [],
  keywords: [],

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

  setNews: (news) => set({ news }),
  setKeywords: (keywords) => set({ keywords }),

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
}));
