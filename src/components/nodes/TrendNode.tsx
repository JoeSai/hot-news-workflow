import { memo, useState, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword } from '../../types/workflow';
import { getKeywordTrends, type TrendDataPoint } from '../../services/crawlerApi';

interface TrendNodeProps {
  id: string;
  data: NodeData;
}

interface TrendItem {
  word: string;
  points: TrendDataPoint[];
  status: 'rising' | 'falling' | 'exploding' | 'stable';
  latest: number;
}

function TrendNode({ id }: TrendNodeProps) {
  const { nodes, edges } = useWorkflowStore();
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 从连线获取输入关键词
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  // 可追踪的关键词（权重最高的10个）
  const trackableKeywords = useMemo(() => {
    return inputKeywords.slice(0, 10);
  }, [inputKeywords]);

  // 追踪的关键词变化时自动加载趋势
  useEffect(() => {
    if (selectedWords.length > 0) {
      loadTrends();
    }
  }, [selectedWords, days]);

  // 自动选中前5个关键词
  useEffect(() => {
    if (trackableKeywords.length > 0 && selectedWords.length === 0) {
      setSelectedWords(trackableKeywords.slice(0, 5).map(k => k.word));
    }
  }, [trackableKeywords]);

  const loadTrends = async () => {
    if (selectedWords.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const trendData = await getKeywordTrends(selectedWords, days);
      const items: TrendItem[] = [];
      for (const [word, points] of Object.entries(trendData)) {
        const latest = points.length > 0 ? points[points.length - 1].weight : 0;
        const prev = points.length > 1 ? points[points.length - 2].weight : latest;
        let status: TrendItem['status'] = 'stable';
        if (points.length >= 2 && latest > prev * 1.2) {
          status = 'rising';
        } else if (points.length >= 2 && latest < prev * 0.8) {
          status = 'falling';
        } else if (latest > 0.8) {
          status = 'exploding';
        }
        items.push({ word, points, status, latest });
      }
      // 按latest权重排序
      items.sort((a, b) => b.latest - a.latest);
      setTrends(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载趋势失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleWord = (word: string) => {
    setSelectedWords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]
    );
  };

  const renderChart = (points: TrendDataPoint[]) => {
    if (points.length === 0) {
      return <div className="text-xs text-gray-400 text-center py-4">暂无数据</div>;
    }

    const maxW = Math.max(...points.map(p => p.weight), 0.01);
    const width = 280;
    const height = 60;
    const pad = 4;

    const step = (width - pad * 2) / Math.max(points.length - 1, 1);
    const pts = points.map((p, i) => ({
      x: pad + i * step,
      y: height - pad - (p.weight / maxW) * (height - pad * 2),
    }));

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg width={width} height={height} className="block mx-auto">
        {/* 网格线 */}
        {[0.25, 0.5, 0.75, 1].map(r => (
          <line
            key={r}
            x1={pad} y1={height - pad - r * (height - pad * 2)}
            x2={width - pad} y2={height - pad - r * (height - pad * 2)}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="2,2"
          />
        ))}
        {/* 折线 */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
        {/* 数据点 */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
        ))}
      </svg>
    );
  };

  const statusColor = (status: TrendItem['status']) => {
    switch (status) {
      case 'rising': return 'text-green-600 bg-green-50';
      case 'falling': return 'text-red-600 bg-red-50';
      case 'exploding': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const statusLabel = (status: TrendItem['status']) => {
    switch (status) {
      case 'rising': return '↑ 上升';
      case 'falling': return '↓ 下降';
      case 'exploding': return '🔥 爆发';
      default: return '→ 平稳';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <Handle type="target" position={Position.Left} />

      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="font-medium">热度趋势</span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* 天数选择 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">时间范围:</span>
          <div className="flex gap-1">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-2 py-0.5 rounded ${days === d ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500 hover:bg-violet-50'}`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {/* 关键词选择 */}
        {trackableKeywords.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">追踪关键词 (点击切换):</div>
            <div className="flex flex-wrap gap-1">
              {trackableKeywords.map(k => (
                <button
                  key={k.word}
                  onClick={() => toggleWord(k.word)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    selectedWords.includes(k.word)
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-violet-50'
                  }`}
                >
                  {k.word}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 刷新按钮 */}
        <button
          onClick={loadTrends}
          disabled={loading || selectedWords.length === 0}
          className="w-full text-xs py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400"
        >
          {loading ? '加载中...' : '🔄 刷新趋势'}
        </button>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>
        )}

        {/* 趋势列表 */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {trends.length === 0 && !loading && (
            <div className="text-center py-6 text-gray-400 text-sm">
              选择关键词后点击「刷新趋势」查看图表
            </div>
          )}
          {trends.map(item => (
            <div key={item.word} className="border border-gray-100 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]">{item.word}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-1">
                当前权重: {item.latest.toFixed(3)}
              </div>
              {renderChart(item.points)}
            </div>
          ))}
        </div>

        {inputKeywords.length === 0 && (
          <div className="text-xs text-orange-500 text-center">
            ← 请连接关键词提取节点
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TrendNode);
