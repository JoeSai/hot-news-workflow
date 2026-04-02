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

const nodeTypes = {
  hotspotCapture: HotspotCaptureNode,
  keywordExtract: KeywordExtractNode,
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
              default:
                return '#888';
            }
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Left Panel - Node Palette */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-2">
          <div className="text-sm font-medium text-gray-700 mb-2">添加节点</div>
          <div className="space-y-2">
            <button
              onClick={addHotspotCaptureNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
            >
              <span>🗞</span>
              <span>热点抓取</span>
            </button>
            <button
              onClick={addKeywordExtractNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
            >
              <span>🔥</span>
              <span>关键词提取</span>
            </button>
          </div>
        </Panel>

        {/* Top Right - Instructions */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-medium text-gray-700 mb-1">使用说明</div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>1. 添加「热点抓取」节点，点击抓取新闻</li>
            <li>2. 添加「关键词提取」节点</li>
            <li>3. 连接两个节点，用连线工具</li>
            <li>4. 点击「提取热词」生成关键词</li>
          </ul>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
