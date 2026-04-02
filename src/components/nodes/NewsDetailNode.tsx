import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData } from '../../types/workflow';

interface NewsDetailNodeProps {
  id: string;
  data: NodeData;
}

function NewsDetailNode({ data }: NewsDetailNodeProps) {
  const { news } = useWorkflowStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  const newsList = data.news || news || [];

  const currentNews = newsList[currentIndex];

  const goNext = () => {
    if (currentIndex < newsList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  // 平台颜色
  const platformColors: Record<string, string> = {
    '网易': '#e54343',
    '澎湃': '#1e8c2f',
    '腾讯': '#2a7fff',
    '搜狐': '#ff7f50',
    '新浪': '#ff0000',
    '中国日报': '#c41e3a',
    'IT之家': '#4fc3f7',
    '微博': '#ffa500',
    '知乎': '#0084ff',
    '今日头条': '#000000',
  };

  if (newsList.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[400px]">
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />

        <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-2 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">📰</span>
            <span className="font-medium">热点详情</span>
          </div>
        </div>

        <div className="p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">📰</div>
          <div className="text-sm">暂无新闻数据</div>
          <div className="text-xs mt-1">连接热点抓取节点获取数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[450px]">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📰</span>
            <span className="font-medium">热点详情</span>
          </div>
          <div className="text-sm opacity-80">
            {currentIndex + 1} / {newsList.length}
          </div>
        </div>
      </div>

      {/* 导航控制 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          ← 上一篇
        </button>

        <div className="flex items-center gap-1">
          {newsList.slice(0, 10).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-rose-500' : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
          {newsList.length > 10 && (
            <span className="text-xs text-gray-400 ml-1">...</span>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex === newsList.length - 1}
          className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          下一篇 →
        </button>
      </div>

      {/* 内容区域 */}
      {currentNews && (
        <div className="p-4">
          {/* 来源和时间 */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 text-xs text-white rounded"
              style={{
                backgroundColor: platformColors[currentNews.source] || '#6b7280',
              }}
            >
              {currentNews.source}
            </span>
            <span className="text-xs text-gray-500">{currentNews.channel}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{currentNews.category}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{currentNews.pub_time}</span>
          </div>

          {/* 标题 */}
          <h3 className="text-lg font-medium text-gray-900 mb-3 leading-tight">
            {currentNews.title}
          </h3>

          {/* 封面图 */}
          {currentNews.img_url && (
            <div className="mb-3">
              <img
                src={currentNews.img_url}
                alt={currentNews.title}
                className="w-full h-40 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* 链接 */}
          <div className="text-sm">
            <a
              href={currentNews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              🔗 查看原文
            </a>
          </div>
        </div>
      )}

      {/* 底部导航 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <span>
          共 {newsList.length} 条
        </span>
        <span>
          {Math.round(((currentIndex + 1) / newsList.length) * 100)}%
        </span>
      </div>
    </div>
  );
}

export default NewsDetailNode;
