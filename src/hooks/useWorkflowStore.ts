import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, NewsItem, Keyword, NodeDataType } from '../types/workflow';

const STORAGE_KEY = 'hot-news-workflow';

// 从 localStorage 加载保存的工作流
function loadWorkflow(): { nodes: Node[]; edges: Edge[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 确保返回有效的结构
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return { nodes: parsed.nodes, edges: parsed.edges };
      }
    }
  } catch (e) {
    console.warn('加载工作流失败:', e);
  }
  return { nodes: [], edges: [] };
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
}

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
}));
