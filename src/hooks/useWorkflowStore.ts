import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, NewsItem, GraphData } from '../types/workflow';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  news: NewsItem[];
  graphData: GraphData | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  setNews: (news: NewsItem[]) => void;
  setGraphData: (data: GraphData) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  edges: [],
  news: [],
  graphData: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  updateNodeData: (nodeId, data) => set((state) => ({
    nodes: state.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } }
        : node
    )
  })),

  setNews: (news) => set({ news }),
  setGraphData: (graphData) => set({ graphData }),

  onNodesChange: (changes) => set((state) => ({
    nodes: applyNodeChanges(changes, state.nodes)
  })),

  onEdgesChange: (changes) => set((state) => ({
    edges: applyEdgeChanges(changes, state.edges)
  })),

  onConnect: (connection) => set((state) => ({
    edges: addEdge(connection, state.edges)
  })),
}));
