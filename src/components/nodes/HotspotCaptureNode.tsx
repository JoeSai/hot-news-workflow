import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData } from '../../types/workflow';
import { runCrawler, parseHotNewsFile } from '../../services/crawlerApi';

const PLATFORMS = [
  // 新闻平台
  { id: 'wangyi', label: '网易新闻', color: '#e54343', category: 'news' },
  { id: 'pengpai', label: '澎湃新闻', color: '#1e8c2f', category: 'news' },
  { id: 'tencent', label: '腾讯新闻', color: '#2a7fff', category: 'news' },
  { id: 'souhu', label: '搜狐新闻', color: '#ff7f50', category: 'news' },
  { id: 'xinlang', label: '新浪国际', color: '#ff0000', category: 'news' },
  { id: 'zhongguoribao', label: '中国日报', color: '#c41e3a', category: 'news' },
  // 科技/垂直
  { id: 'ithome', label: 'IT之家', color: '#4fc3f7', category: 'tech' },
  { id: 'toutiao', label: '今日头条', color: '#000000', category: 'tech' },
  // 热搜榜单
  { id: 'weibo', label: '微博热搜', color: '#ffa500', category: 'hot' },
  { id: 'zhihu', label: '知乎热榜', color: '#0084ff', category: 'hot' },
];

const CATEGORY_LABELS: Record<string, string> = {
  news: '新闻媒体',
  tech: '科技资讯',
  hot: '热搜榜单',
};

interface HotspotCaptureNodeProps {
  id: string;
  data: NodeData;
}

function HotspotCaptureNode({ id, data }: HotspotCaptureNodeProps) {
  const { updateNodeData, setNews } = useWorkflowStore();
  const selectedPlatforms = data.platforms || ['wangyi', 'pengpai', 'tencent'];
  const limit = data.limit || 30;

  const handleToggle = (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((p) => p !== platformId)
      : [...selectedPlatforms, platformId];
    updateNodeData(id, { platforms: newPlatforms });
  };

  const handleLimitChange = (newLimit: number) => {
    updateNodeData(id, { limit: newLimit });
  };

  const loadExisting = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateNodeData(id, { status: 'running' });
    try {
      const news = await parseHotNewsFile();
      updateNodeData(id, { status: 'success', news });
      setNews(news);
    } catch {
      updateNodeData(id, { status: 'error', error: '加载现有数据失败' });
    }
  };

  const handleCrawl = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedPlatforms.length === 0) {
      updateNodeData(id, { status: 'error', error: '请至少选择一个平台' });
      return;
    }

    updateNodeData(id, { status: 'running' });

    try {
      const news = await runCrawler(selectedPlatforms, limit);
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
        return '抓取中...';
      case 'success':
        return `已获取: ${data.news?.length || 0} 条`;
      case 'error':
        return `错误: ${data.error}`;
      default:
        return `待抓取 (选择 ${selectedPlatforms.length} 个平台)`;
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

  // 按分类分组平台
  const groupedPlatforms = PLATFORMS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof PLATFORMS>);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
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
        {/* 数量选择 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            每平台数量
          </label>
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={10}>10 条/平台</option>
            <option value={20}>20 条/平台</option>
            <option value={30}>30 条/平台</option>
            <option value={50}>50 条/平台</option>
          </select>
          <div className="text-xs text-gray-400 mt-1">
            预计获取: {selectedPlatforms.length * limit} 条
          </div>
        </div>

        {/* 平台选择 */}
        {Object.entries(groupedPlatforms).map(([category, platforms]) => (
          <div key={category}>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              {CATEGORY_LABELS[category] || category}
            </label>
            <div className="space-y-1">
              {platforms.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p.id)}
                    onChange={() => handleToggle(p.id)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* 按钮组 */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={loadExisting}
            disabled={data.status === 'running'}
            className="w-full py-2 px-4 rounded-md font-medium text-white bg-gray-500 hover:bg-gray-600 transition-colors"
          >
            📁 加载现有数据
          </button>
          <button
            type="button"
            onClick={handleCrawl}
            disabled={data.status === 'running' || selectedPlatforms.length === 0}
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
              ${data.status === 'running' || selectedPlatforms.length === 0 ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}
            `}
          >
            🔄 抓取热点
          </button>
        </div>

        {/* 状态 */}
        <div className={`text-sm ${getStatusColor()}`}>{getStatusText()}</div>
      </div>
    </div>
  );
}

export default HotspotCaptureNode;
