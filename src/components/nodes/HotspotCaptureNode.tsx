import { memo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData } from '../../types/workflow';
import { runCrawler, parseHotNewsFile } from '../../services/crawlerApi';

const PLATFORMS = [
  { id: 'wangyi', label: '网易新闻', color: '#e54343' },
  { id: 'pengpai', label: '澎湃新闻', color: '#1e8c2f' },
  { id: 'tencent', label: '腾讯新闻', color: '#2a7fff' },
];

interface HotspotCaptureNodeProps {
  id: string;
  data: NodeData;
}

function HotspotCaptureNode({ id, data }: HotspotCaptureNodeProps) {
  const { updateNodeData, setNews } = useWorkflowStore();
  const selectedPlatforms = data.platforms || ['wangyi', 'pengpai', 'tencent'];

  // 自动加载现有数据
  useEffect(() => {
    if (data.status === 'idle' && !data.news) {
      loadExisting();
    }
  }, []);

  const loadExisting = async () => {
    updateNodeData(id, { status: 'running' });
    try {
      const news = await parseHotNewsFile();
      updateNodeData(id, { status: 'success', news });
      setNews(news);
    } catch (error) {
      updateNodeData(id, {
        status: 'error',
        error: '加载现有数据失败',
      });
    }
  };

  const handleToggle = (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((p) => p !== platformId)
      : [...selectedPlatforms, platformId];
    updateNodeData(id, { platforms: newPlatforms });
  };

  const handleCrawl = async () => {
    if (selectedPlatforms.length === 0) {
      updateNodeData(id, { status: 'error', error: '请至少选择一个平台' });
      return;
    }

    updateNodeData(id, { status: 'running' });

    try {
      const news = await runCrawler(selectedPlatforms);
      updateNodeData(id, { status: 'success', news });
      setNews(news);
    } catch (error) {
      updateNodeData(id, {
        status: 'error',
        error: error instanceof Error ? error.message : '抓取失败',
      });
    }
  };

  const getStatusText = () => {
    switch (data.status) {
      case 'running':
        return '加载中...';
      case 'success':
        return `已加载: ${data.news?.length || 0} 条`;
      case 'error':
        return `错误: ${data.error}`;
      default:
        return '待运行';
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-72">
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗞</span>
          <span className="font-medium">热点抓取</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* 平台选择 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            选择来源
          </label>
          <div className="space-y-2">
            {PLATFORMS.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(p.id)}
                  onChange={() => handleToggle(p.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm text-gray-600">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 按钮组 */}
        <div className="space-y-2">
          <button
            onClick={loadExisting}
            disabled={data.status === 'running'}
            className="w-full py-2 px-4 rounded-md font-medium text-white bg-gray-500 hover:bg-gray-600 transition-colors"
          >
            📁 加载现有数据
          </button>
          <button
            onClick={handleCrawl}
            disabled={data.status === 'running'}
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
              ${data.status === 'running' ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}
            `}
          >
            🔄 重新抓取
          </button>
        </div>

        {/* 状态 */}
        <div className={`text-sm ${getStatusColor()}`}>{getStatusText()}</div>
      </div>
    </div>
  );
}

export default memo(HotspotCaptureNode);
