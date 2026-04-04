import { useCallback, useState } from 'react';
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
import NewsDetailNode from './nodes/NewsDetailNode';
import HotwordListNode from './nodes/HotwordListNode';
import ContentGenerateNode from './nodes/ContentGenerateNode';
import TopicRecommendNode from './nodes/TopicRecommendNode';

const nodeTypes = {
  hotspotCapture: HotspotCaptureNode,
  keywordExtract: KeywordExtractNode,
  wordCloud: WordCloudNode,
  newsDetail: NewsDetailNode,
  hotwordList: HotwordListNode,
  contentGenerate: ContentGenerateNode,
  topicRecommend: TopicRecommendNode,
};

function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, clearWorkflow } =
    useWorkflowStore();

  // 计算下一个可用的节点ID，基于已有节点的最大ID
  const getNextNodeId = (prefix: string) => {
    const existingIds = nodes
      .filter(n => n.id.startsWith(prefix))
      .map(n => {
        const match = n.id.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return `${prefix}-${maxId + 1}`;
  };

  const addHotspotCaptureNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('hotspot'),
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
      id: getNextNodeId('keyword'),
      type: 'keywordExtract',
      position: { x: 400, y: 150 },
      data: {
        topK: 50,
        method: 'phrase',
        keywordStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addWordCloudNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('wordcloud'),
      type: 'wordCloud',
      position: { x: 750, y: 50 },
      data: {
        wordCloudTopK: 50,
        wordCloudStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addNewsDetailNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('newsdetail'),
      type: 'newsDetail',
      position: { x: 750, y: 850 },
      data: {
        newsDetailStatus: 'idle',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const addHotwordListNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('hotword'),
      type: 'hotwordList',
      position: { x: 750, y: 400 },
      data: {},
    };
    addNode(newNode);
  }, [addNode]);

  const addContentGenerateNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('content'),
      type: 'contentGenerate',
      position: { x: 1100, y: 300 },
      data: {},
    };
    addNode(newNode);
  }, [addNode]);

  const addTopicRecommendNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('topic'),
      type: 'topicRecommend',
      position: { x: 750, y: 300 },
      data: {},
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
              case 'newsDetail':
                return '#f43f5e';
              case 'hotwordList':
                return '#8b5cf6';
              case 'contentGenerate':
                return '#6366f1';
              case 'topicRecommend':
                return '#ec4899';
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

            <div className="text-xs text-gray-500 mt-3 mb-1">内容处理</div>
            <button
              type="button"
              onClick={addHotwordListNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-violet-50 hover:bg-violet-100 rounded-md transition-colors"
            >
              <span>📝</span>
              <span>热词列表</span>
            </button>
            <button
              type="button"
              onClick={addTopicRecommendNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-pink-50 hover:bg-pink-100 rounded-md transition-colors"
            >
              <span>🎯</span>
              <span>选题推荐</span>
            </button>
            <button
              type="button"
              onClick={addContentGenerateNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
            >
              <span>✍️</span>
              <span>AI 内容生成</span>
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
              onClick={addNewsDetailNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
            >
              <span>📰</span>
              <span>热点详情</span>
            </button>
          </div>

          {/* 分隔线和清除按钮 */}
          {nodes.length > 0 && (
            <>
              <div className="border-t border-gray-200 my-2" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('确定要清除所有节点吗？此操作不可撤销。')) {
                    clearWorkflow();
                  }
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <span>🗑️</span>
                <span>清除工作流</span>
              </button>
            </>
          )}
        </Panel>

        {/* Top Right - Instructions */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-medium text-gray-700 mb-1">📖 使用说明</div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>1. 添加「热点抓取」抓取新闻</li>
            <li>2. 连接节点拖拽数据</li>
            <li>3. 添加「关键词提取」生成热词</li>
            <li>4. 连接热词到「词云」可视化</li>
          </ul>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
