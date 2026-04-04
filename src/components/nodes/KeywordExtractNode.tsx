import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import type { NodeData, NewsItem } from '../../types/workflow';
import { extractKeywords } from '../../services/crawlerApi';

interface KeywordExtractNodeProps {
  id: string;
  data: NodeData;
}

function KeywordExtractNode({ id, data }: KeywordExtractNodeProps) {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const [topK, setTopK] = useState(data.topK || 50);
  const [method, setMethod] = useState<'tfidf' | 'textrank' | 'phrase'>(data.method || 'phrase');

  // 从连线获取输入数据（而不是从全局 store）
  const inputNews = useMemo(() => {
    const news = getInputData<NewsItem>(id, nodes, edges, 'news');
    return news || [];
  }, [id, nodes, edges]);

  const handleExtract = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inputNews.length === 0) {
      updateNodeData(id, { keywordStatus: 'error' });
      return;
    }

    updateNodeData(id, { keywordStatus: 'running' });

    try {
      const keywords = await extractKeywords(inputNews, topK, method);
      // 将结果存入自身节点数据，并声明输出类型
      updateNodeData(id, {
        keywords,
        keywordStatus: 'success',
        topK,
        method,
        outputType: 'keywords'
      });
    } catch (error) {
      updateNodeData(id, {
        keywordStatus: 'error',
        error: error instanceof Error ? error.message : '提取失败',
      });
    }
  };

  const getStatusText = () => {
    switch (data.keywordStatus) {
      case 'running':
        return '提取中...';
      case 'success':
        return `完成: ${data.keywords?.length || 0} 个热词`;
      case 'error':
        return '错误: 无输入数据';
      default:
        return inputNews.length > 0 ? `待提取 (${inputNews.length}条)` : '请先连接热点节点';
    }
  };

  const hasInput = inputNews.length > 0;
  const hasOutput = data.keywords && data.keywords.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-72">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="font-medium">关键词提取</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* 输入统计 */}
        <div className="text-sm text-gray-600">
          输入: <span className="font-medium">{inputNews.length}</span> 条新闻
          {!hasInput && <span className="text-orange-500 ml-1">← 请连接热点抓取</span>}
        </div>

        {/* 提取数量 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            提取数量
          </label>
          <input
            type="number"
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value) || 50)}
            min={10}
            max={200}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {/* 算法选择 */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            算法
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'tfidf' | 'textrank' | 'phrase')}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="phrase">关键短语（推荐）</option>
            <option value="tfidf">TF-IDF（高频热词）</option>
            <option value="textrank">TextRank（核心关键词）</option>
          </select>
        </div>

        {/* 提取按钮 */}
        <button
          type="button"
          onClick={handleExtract}
          disabled={data.keywordStatus === 'running' || !hasInput}
          className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
            ${!hasInput ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}
          `}
        >
          {data.keywordStatus === 'running' ? '提取中...' : '▶ 提取热词'}
        </button>

        {/* 状态 */}
        <div className={`text-sm ${data.keywordStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
          {getStatusText()}
        </div>

        {/* 关键词预览 */}
        {hasOutput && data.keywords && (
          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs text-gray-500 mb-2">热词预览（TOP 10）</div>
            <div className="flex flex-wrap gap-1">
              {data.keywords.slice(0, 10).map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs"
                  style={{ opacity: 0.5 + (kw.weight / (data.keywords?.[0]?.weight || 1)) * 0.5 }}
                >
                  {kw.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(KeywordExtractNode);
