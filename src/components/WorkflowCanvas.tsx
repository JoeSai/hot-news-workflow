import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getGlobalSettings, saveGlobalSettings, type GlobalSettings } from '../services/crawlerApi';

import { useWorkflowStore, WORKFLOW_TEMPLATES } from '../hooks/useWorkflowStore';
import HotspotCaptureNode from './nodes/HotspotCaptureNode';
import KeywordExtractNode from './nodes/KeywordExtractNode';
import WordCloudNode from './nodes/WordCloudNode';
import NewsDetailNode from './nodes/NewsDetailNode';
import HotwordListNode from './nodes/HotwordListNode';
import ContentGenerateNode from './nodes/ContentGenerateNode';
import TopicRecommendNode from './nodes/TopicRecommendNode';
import TopicHotwordNode from './nodes/TopicHotwordNode';
import TrendNode from './nodes/TrendNode';
import ContentRecordNode from './nodes/ContentRecordNode';
import CoverImageNode from './nodes/CoverImageNode';

const nodeTypes = {
  hotspotCapture: HotspotCaptureNode,
  keywordExtract: KeywordExtractNode,
  wordCloud: WordCloudNode,
  newsDetail: NewsDetailNode,
  hotwordList: HotwordListNode,
  contentGenerate: ContentGenerateNode,
  topicRecommend: TopicRecommendNode,
  topicHotword: TopicHotwordNode,
  trend: TrendNode,
  contentRecord: ContentRecordNode,
  coverImage: CoverImageNode,
};

function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, clearWorkflow, loadTemplate, runAll, runningNodeId } =
    useWorkflowStore();
  const [showTemplates, setShowTemplates] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // v0.17-R5: AI 全局设置
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<GlobalSettings>({ provider: 'deepseek', api_key: null, api_base: null, model: null });
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (showSettings) {
      getGlobalSettings().then(s => setSettingsForm(s)).catch(() => {});
    }
  }, [showSettings]);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await saveGlobalSettings(settingsForm);
      setShowSettings(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsSaving(false);
    }
  };

  // 获取当前运行的节点名称
  const getRunningNodeName = () => {
    if (!runningNodeId) return '';
    const node = nodes.find(n => n.id === runningNodeId);
    if (!node) return '';
    switch (node.type) {
      case 'hotspotCapture': return '热点抓取';
      case 'keywordExtract': return '关键词提取';
      case 'contentGenerate': return 'AI内容生成';
      default: return node.type;
    }
  };

  // 计算下一个可用的节点ID，基于已有节点的最大ID
  const getNextNodeId = useCallback((prefix: string) => {
    const currentNodes = useWorkflowStore.getState().nodes;
    const existingIds = currentNodes
      .filter(n => n.id.startsWith(prefix))
      .map(n => {
        const match = n.id.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return `${prefix}-${maxId + 1}`;
  }, []);

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

  const addTopicHotwordNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('topicHotword'),
      type: 'topicHotword',
      position: { x: 750, y: 300 },
      data: {},
    };
    addNode(newNode);
  }, [addNode]);

  const addTrendNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('trend'),
      type: 'trend',
      position: { x: 750, y: 500 },
      data: {},
    };
    addNode(newNode);
  }, [addNode]);

  const addContentRecordNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('record'),
      type: 'contentRecord',
      position: { x: 1100, y: 500 },
      data: {},
    };
    addNode(newNode);
  }, [addNode]);

  const addCoverImageNode = useCallback(() => {
    const newNode = {
      id: getNextNodeId('cover'),
      type: 'coverImage',
      position: { x: 1100, y: 100 },
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
              case 'trend':
                return '#7c3aed';
              case 'contentRecord':
                return '#059669';
              case 'coverImage':
                return '#db2777';
              default:
                return '#888';
            }
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Left Panel - Node Palette */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-2 w-48">
          {/* Run All Button */}
          {nodes.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                if (isRunning) return;
                setIsRunning(true);
                try {
                  await runAll();
                } finally {
                  setIsRunning(false);
                }
              }}
              disabled={isRunning}
              className={`w-full mb-2 px-3 py-2 rounded-md text-sm font-medium text-white transition-colors flex items-center justify-center gap-2
                ${isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isRunning ? `⏳ ${getRunningNodeName() || '执行中...'}...` : '▶ 一键执行'}
            </button>
          )}
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
              onClick={addTopicHotwordNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-gradient-to-r from-pink-50 to-violet-50 hover:from-pink-100 hover:to-violet-100 rounded-md transition-colors"
            >
              <span>🎯📝</span>
              <span>选题热词（合并版）</span>
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
            <button
              type="button"
              onClick={addTrendNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-violet-50 hover:bg-violet-100 rounded-md transition-colors"
            >
              <span>📈</span>
              <span>热度趋势</span>
            </button>

            <div className="text-xs text-gray-500 mt-3 mb-1">效果追踪</div>
            <button
              type="button"
              onClick={addContentRecordNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
            >
              <span>📊</span>
              <span>内容效果记录</span>
            </button>
            <button
              type="button"
              onClick={addCoverImageNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
            >
              <span>🖼️</span>
              <span>封面图辅助</span>
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

        {/* Top Right - Template Selector */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 text-sm w-56">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-gray-700">📋 工作流模板</div>
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              {showTemplates ? '收起' : '展开'}
            </button>
          </div>
          {showTemplates ? (
            <div className="space-y-2">
              {WORKFLOW_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (nodes.length > 0 && !confirm('加载模板将清除当前工作流，确定继续？')) {
                      return;
                    }
                    loadTemplate(t.id);
                    setShowTemplates(false);
                  }}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-indigo-50 rounded-md transition-colors group"
                >
                  <div className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              {nodes.length === 0 ? '点击"展开"选择模板快速开始' : `当前 ${nodes.length} 个节点，${edges.length} 条连线`}
            </div>
          )}
        </Panel>

        {/* AI 全局设置面板 */}
        {showSettings && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-700">⚙️ AI 全局设置</div>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">供应商</label>
                  <select
                    value={settingsForm.provider}
                    onChange={e => setSettingsForm(s => ({ ...s, provider: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="minimax">MiniMax</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                    <option value="zhipu">智谱 GLM</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={settingsForm.api_key || ''}
                    onChange={e => setSettingsForm(s => ({ ...s, api_key: e.target.value || null }))}
                    placeholder="留空则使用环境变量"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">API Base（可选）</label>
                  <input
                    type="text"
                    value={settingsForm.api_base || ''}
                    onChange={e => setSettingsForm(s => ({ ...s, api_base: e.target.value || null }))}
                    placeholder="如 https://api.minimaxi.com/v1"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {settingsSaving ? '保存中...' : '💾 保存设置'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 右上角设置入口 */}
        <Panel position="top-right" className="mt-2 mr-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="bg-white rounded-lg shadow px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200"
          >
            ⚙️ AI设置
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default WorkflowCanvas;
