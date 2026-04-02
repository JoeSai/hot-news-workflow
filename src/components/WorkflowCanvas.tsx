import { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '../hooks/useWorkflowStore';
import HotspotCaptureNode from './nodes/HotspotCaptureNode';
import KeywordExtractNode from './nodes/KeywordExtractNode';
import WordCloudNode from './nodes/WordCloudNode';
import GraphNode from './nodes/GraphNode';
import TimelineNode from './nodes/TimelineNode';
import ForceGraphNode from './nodes/ForceGraphNode';
import NewsDetailNode from './nodes/NewsDetailNode';

const nodeTypes = {
  hotspotCapture: HotspotCaptureNode,
  keywordExtract: KeywordExtractNode,
  wordCloud: WordCloudNode,
  graph: GraphNode,
  timeline: TimelineNode,
  forceGraph: ForceGraphNode,
  newsDetail: NewsDetailNode,
};

let nodeIdCounter = 1;

function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } =
    useWorkflowStore();

  const addHotspotCaptureNode = useCallback(() => {
    const newNode = {
      id: `hotspot-${nodeIdCounter++}`,
      type: 'hotspotCapture',
      position: { x: 50, y: 150 },
      data: {
        platforms: ['wangyi', 'pengpai', 'tencent'],
        limit: 50,
        status: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addKeywordExtractNode = useCallback(() => {
    const newNode = {
      id: `keyword-${nodeIdCounter++}`,
      type: 'keywordExtract',
      position: { x: 400, y: 150 },
      data: {
        topK: 50,
        method: 'tfidf',
        keywordStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addWordCloudNode = useCallback(() => {
    const newNode = {
      id: `wordcloud-${nodeIdCounter++}`,
      type: 'wordCloud',
      position: { x: 750, y: 50 },
      data: {
        wordCloudTopK: 50,
        wordCloudStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addGraphNode = useCallback(() => {
    const newNode = {
      id: `graph-${nodeIdCounter++}`,
      type: 'graph',
      position: { x: 750, y: 250 },
      data: {
        graphStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addTimelineNode = useCallback(() => {
    const newNode = {
      id: `timeline-${nodeIdCounter++}`,
      type: 'timeline',
      position: { x: 750, y: 450 },
      data: {
        timelineStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addForceGraphNode = useCallback(() => {
    const newNode = {
      id: `forcegraph-${nodeIdCounter++}`,
      type: 'forceGraph',
      position: { x: 750, y: 650 },
      data: {
        forceGraphStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addNewsDetailNode = useCallback(() => {
    const newNode = {
      id: `newsdetail-${nodeIdCounter++}`,
      type: 'newsDetail',
      position: { x: 750, y: 850 },
      data: {
        newsDetailStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'hotspotCapture':
                return '#aa3bff';
              case 'keywordExtract':
                return '#f97316';
              case 'wordCloud':
                return '#0891b2';
              case 'graph':
                return '#6366f1';
              case 'timeline':
                return '#10b981';
              case 'forceGraph':
                return '#f59e0b';
              default:
                return '#888';
            }
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Left Panel - Node Palette */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-2 w-48">
          <div className="text-sm font-medium text-gray-700 mb-2">📦 添加节点</div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500 mb-1">数据源</div>
            <button
              type="button"
              onClick={addHotspotCaptureNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
            >
              <span>🗞</span>
              <span>热点抓取</span>
            </button>
            <button
              type="button"
              onClick={addKeywordExtractNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
            >
              <span>🔥</span>
              <span>关键词提取</span>
            </button>

            <div className="text-xs text-gray-500 mt-3 mb-1">可视化</div>
            <button
              type="button"
              onClick={addWordCloudNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-cyan-50 hover:bg-cyan-100 rounded-md transition-colors"
            >
              <span>☁️</span>
              <span>词云视图</span>
            </button>
            <button
              type="button"
              onClick={addGraphNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
            >
              <span>🔗</span>
              <span>关系图谱</span>
            </button>
            <button
              type="button"
              onClick={addTimelineNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
            >
              <span>📅</span>
              <span>时间线视图</span>
            </button>
            <button
              type="button"
              onClick={addForceGraphNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
            >
              <span>🌀</span>
              <span>力导向图</span>
            </button>
            <button
              type="button"
              onClick={addNewsDetailNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
            >
              <span>📰</span>
              <span>热点详情</span>
            </button>
          </div>
        </Panel>

        {/* Top Right - Instructions */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-medium text-gray-700 mb-1">📖 使用说明</div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>1. 添加「热点抓取」节点，抓取新闻</li>
            <li>2. 添加「关键词提取」节点，提取热词</li>
            <li>3. 添加可视化节点（词云/图谱等）</li>
            <li>4. 连接节点，数据自动流转</li>
          </ul>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
