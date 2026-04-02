import { useEffect, useRef, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword, NewsItem } from '../../types/workflow';

interface WordCloudNodeProps {
  id: string;
  data: NodeData;
}

// 简单的词云渲染（基于 Canvas）
function renderWordCloud(
  canvas: HTMLCanvasElement,
  keywords: Keyword[],
  topK: number = 50
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 取前 N 个词
  const words = keywords.slice(0, topK);
  if (words.length === 0) return;

  // 计算权重范围
  const maxWeight = Math.max(...words.map((w) => w.weight));
  const minWeight = Math.min(...words.map((w) => w.weight));

  // 颜色方案
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
  ];

  // 螺旋布局
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  words.forEach((word, index) => {
    // 归一化权重
    const normalizedWeight =
      maxWeight === minWeight
        ? 0.5
        : (word.weight - minWeight) / (maxWeight - minWeight);

    // 字体大小 12-48
    const fontSize = 12 + normalizedWeight * 36;

    // 旋转角度
    const angle = goldenAngle * index;
    const distance = Math.sqrt(index) * 15;

    const centerX = width / 2;
    const centerY = height / 2;
    const x = centerX + distance * Math.cos(angle);
    const y = centerY + distance * Math.sin(angle);

    // 颜色
    const color = colors[index % colors.length];

    // 透明度
    const alpha = 0.6 + normalizedWeight * 0.4;

    ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word.word, x, y);
  });

  ctx.globalAlpha = 1;
}

function WordCloudNode({ id, data }: WordCloudNodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { updateNodeData, news, keywords } = useWorkflowStore();

  // 从关键词或新闻生成词云数据
  const wordCloudData = useMemo(() => {
    // 如果有 keywords，直接使用
    if (keywords && keywords.length > 0) {
      return keywords.map((k: Keyword) => ({
        text: k.word,
        value: k.weight,
      }));
    }

    // 否则从新闻标题生成
    if (!news || news.length === 0) return [];

    // 简单分词（按空格和标点分割）
    const wordCount: Record<string, number> = {};
    const stopWords = new Set([
      '的', '了', '是', '在', '和', '与', '或', '为', '对', '这', '那', '就', '都',
      '也', '要', '会', '能', '可以', '一个', '我们', '你们', '他们', '什么', '这个',
      '那个', '因为', '所以', '但是', '如果', '虽然', '已经', '正在', '可能',
    ]);

    news.forEach((item: NewsItem) => {
      const words = item.title.split(/[\s,\.，。、！？；：""''【】（）]/);
      words.forEach((word: string) => {
        word = word.trim();
        if (word.length >= 2 && !stopWords.has(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCount)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, (data.wordCloudTopK as number) || 50);
  }, [keywords, news, data.wordCloudTopK]);

  // 渲染词云
  useEffect(() => {
    if (!canvasRef.current || wordCloudData.length === 0) return;

    const canvas = canvasRef.current;
    canvas.width = 400;
    canvas.height = 300;

    // 转换为 Keyword 格式
    const keywordsForRender: Keyword[] = wordCloudData.map((item) => ({
      word: item.text,
      weight: item.value,
    }));

    renderWordCloud(canvas, keywordsForRender, (data.wordCloudTopK as number) || 50);
  }, [wordCloudData, data.wordCloudTopK]);

  const handleTopKChange = (newTopK: number) => {
    updateNodeData(id, { wordCloudTopK: newTopK });
  };

  const getStatusColor = () => {
    switch (data.wordCloudStatus) {
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
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-96">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">☁️</span>
          <span className="font-medium">词云视图</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* 配置 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">显示数量:</label>
          <select
            value={(data.wordCloudTopK as number) || 50}
            onChange={(e) => handleTopKChange(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={80}>80</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* 词云画布 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {wordCloudData.length > 0 ? (
            <canvas
              ref={canvasRef}
              className="w-full h-[300px]"
            />
          ) : (
            <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">☁️</div>
                <div className="text-sm">暂无数据</div>
                <div className="text-xs mt-1">请先连接热点抓取节点</div>
              </div>
            </div>
          )}
        </div>

        {/* 状态 */}
        <div className={`text-sm ${getStatusColor()}`}>
          {wordCloudData.length > 0
            ? `已渲染 ${wordCloudData.length} 个词`
            : '等待数据...'}
        </div>

        {/* 热词列表预览 */}
        {wordCloudData.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">热词预览:</div>
            <div className="flex flex-wrap gap-1">
              {wordCloudData.slice(0, 15).map((item: { text: string; value: number }, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                >
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WordCloudNode;
