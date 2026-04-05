import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import { useDraftHistory } from '../../hooks/useDraftHistory';
import type { NodeData, Keyword } from '../../types/workflow';

interface TopicHotwordNodeProps {
  id: string;
  data: NodeData;
}

// AI相关关键词（用于判断选题相关性）
const AI_KEYWORDS = [
  'AI', '人工智能', '大模型', 'LLM', 'ChatGPT', 'GPT', 'Gemini', 'Claude',
  '机器学习', '深度学习', '神经网络', '算法', '算力', '芯片', 'GPU', 'NPU',
  '自动驾驶', '智能驾驶', '新能源', '电动车', '智能汽车',
  '智能音箱', '智能家居', '物联网', 'IoT',
  '区块链', 'Web3', '元宇宙', 'AR', 'VR', '虚拟现实', '增强现实',
  '机器人', '人形机器人', '具身智能',
  'OpenAI', 'Google', '微软', 'Meta', '百度', '阿里', '腾讯', '华为',
  '创业', '融资', '独角兽', '上市',
  '产品发布', '发布会', '评测', '测评', '对比',
  '教程', '入门', '指南', '学习', '手把手',
  '科技数码', '手机', '电脑', '笔记本', '平板',
  '编程', '代码', '开源', 'GitHub', '开发者',
  '论文', '研究', '学术', '顶会', 'NIPS', 'ICML',
  '副业', '变现', '赚钱', '掘金',
];

// 话题类型标签
const TOPIC_TYPES = {
  科普向: ['科普', '入门', '是什么', '原理', '揭秘', '解析'],
  观点向: ['观点', '看法', '思考', '分析', '预测', '趋势'],
  教程向: ['教程', '手把手', '入门', '指南', '学习', '如何', '怎么'],
  测评向: ['测评', '评测', '对比', '横评', '体验', '试用'],
};

function TopicHotwordNode({ id, data }: TopicHotwordNodeProps) {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const [aiRelevanceThreshold, setAiRelevanceThreshold] = useState(30);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const { drafts } = useDraftHistory();

  // selectedKeywords 存储完整 Keyword 对象
  const [selectedKeywords, setSelectedKeywords] = useState<Keyword[]>(() => {
    const initial = data.selectedKeywords as Keyword[] | undefined;
    if (initial?.length && typeof initial[0] === 'object' && 'word' in initial[0]) {
      return initial;
    }
    return [];
  });
  const [customKeywords, setCustomKeywords] = useState<Keyword[]>((data.customKeywords as Keyword[]) || []);
  const [newWord, setNewWord] = useState('');

  // P2.5.3 / v0.20-R1: 提取近 7 天草稿中已写过的关键词
  const recentWrittenWords = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const written = new Set<string>();
    for (const draft of drafts) {
      const draftTime = new Date(draft.createdAt).getTime();
      if (isNaN(draftTime)) continue;
      if (draftTime >= sevenDaysAgo) {
        for (const kw of draft.keywords) {
          written.add(kw);
        }
      }
    }
    return written;
  }, [drafts]);

  // 从连线获取输入数据
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  // 合并输入关键词和自定义关键词
  const allKeywords = useMemo(() => {
    const kwMap = new Map<string, Keyword>();
    inputKeywords.forEach(k => kwMap.set(k.word, k));
    customKeywords.forEach(k => kwMap.set(k.word, k));
    return Array.from(kwMap.values());
  }, [inputKeywords, customKeywords]);

  const hasInput = inputKeywords.length > 0 || customKeywords.length > 0;

  // v0.18-R2: 重写评分算法，区分度高
  const scoreKeyword = (kw: Keyword): { score: number; matchType: string } => {
    const word = kw.word.toLowerCase();
    let score = 0;
    let matchType = '科普向';

    // 1. 多源出现加分
    const sourceCount = kw.sourceNews?.length || 1;
    score += Math.min(sourceCount * 15, 45);

    // 2. AI 赛道相关
    let aiMatchCount = 0;
    for (const aiKw of AI_KEYWORDS) {
      if (word.includes(aiKw.toLowerCase())) aiMatchCount++;
    }
    score += Math.min(aiMatchCount * 8, 24);

    // 3. 短语质量
    if (kw.type === 'phrase' || word.length >= 3) {
      score += 10;
    } else {
      score += 2;
    }

    // 4. 话题类型标记
    for (const [type, markers] of Object.entries(TOPIC_TYPES)) {
      for (const marker of markers) {
        if (word.includes(marker)) {
          matchType = type;
          score += 8;
          break;
        }
      }
    }

    return { score: Math.min(100, score), matchType };
  };

  // 排序并推荐TOP选题
  const recommendations = useMemo(() => {
    if (!hasInput) return [];

    const scored = inputKeywords.map(kw => {
      const { score, matchType } = scoreKeyword(kw);
      return {
        ...kw,
        aiScore: score,
        topicType: matchType,
      };
    });

    return scored
      .filter(k => k.aiScore >= aiRelevanceThreshold)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 5);
  }, [inputKeywords, aiRelevanceThreshold, hasInput]);

  // v0.18-R1: 确认推荐 → 自动选中推荐词到下方列表
  const handleConfirmRecommendations = () => {
    if (!hasInput) return;
    const selected = recommendations.slice(0, 5).map(r => ({ word: r.word, weight: r.weight, type: r.type, sourceNews: r.sourceNews }));
    setSelectedKeywords(selected);
    updateNodeData(id, {
      recommendations,
      selectedKeywords: selected,
      outputType: 'keywords',
    });
    setShowRecommendations(false);
  };

  const toggleWord = (word: string) => {
    const newSelected = selectedKeywords.filter(k => k.word !== word);
    const exists = selectedKeywords.some(k => k.word === word);
    if (!exists) {
      const kw = allKeywords.find(k => k.word === word);
      if (kw) {
        newSelected.push(kw);
      }
    }
    setSelectedKeywords(newSelected);
    updateNodeData(id, { selectedKeywords: newSelected, outputType: 'keywords' });
  };

  const selectAll = () => {
    setSelectedKeywords(allKeywords);
    updateNodeData(id, { selectedKeywords: allKeywords, outputType: 'keywords' });
  };

  const clearSelection = () => {
    setSelectedKeywords([]);
    updateNodeData(id, { selectedKeywords: [], outputType: 'keywords' });
  };

  const addCustomKeyword = () => {
    const word = newWord.trim();
    if (!word || word.length < 2) return;
    const exists = allKeywords.some(k => k.word === word);
    if (exists) {
      setNewWord('');
      return;
    }
    const updated = [...customKeywords, { word, weight: 1.0, type: 'word' as const }];
    setCustomKeywords(updated);
    setNewWord('');
    updateNodeData(id, { customKeywords: updated, selectedKeywords, outputType: 'keywords' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case '科普向': return '📚';
      case '观点向': return '💡';
      case '教程向': return '👨‍🏫';
      case '测评向': return '⚖️';
      default: return '📌';
    }
  };

  const maxWeight = useMemo(() => {
    if (allKeywords.length === 0) return 1;
    return Math.max(...allKeywords.map(k => k.weight));
  }, [allKeywords]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-96">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="font-medium">选题热词</span>
          {selectedKeywords.length > 0 && (
            <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded">
              已选 {selectedKeywords.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 阈值 + 生成推荐 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">
              AI 相关性阈值: {aiRelevanceThreshold}%
            </label>
            <button
              type="button"
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="text-xs text-pink-600 hover:text-pink-700"
            >
              {showRecommendations ? '收起推荐' : '查看评分'}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={aiRelevanceThreshold}
            onChange={(e) => setAiRelevanceThreshold(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 推荐选题面板 v0.18-R1 */}
        {showRecommendations && recommendations.length > 0 && (
          <div className="border border-pink-200 rounded-lg p-3 bg-pink-50/50 space-y-2">
            <div className="text-xs font-medium text-pink-600">
              🎯 推荐选题 (TOP {recommendations.length})
            </div>
            {recommendations.map((rec, i) => (
              <div key={i} className="border border-pink-100 rounded p-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">
                        {getTypeIcon(rec.topicType)} {rec.topicType}
                      </span>
                      {recentWrittenWords.has(rec.word) && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          📝 已写过
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-gray-800 text-sm">{rec.word}</div>
                  </div>
                  <span className={`text-xs px-1.5 py-1 rounded ${getScoreColor(rec.aiScore)}`}>
                    {rec.aiScore}%
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {recentWrittenWords.has(rec.word) ? '⚠️ 近 7 天写过 · ' : ''}
                  {rec.aiScore >= 70 ? '🔥 强烈推荐' : rec.aiScore >= 50 ? '👍 推荐' : '👀 可考虑'}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleConfirmRecommendations}
              className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-medium"
            >
              ✓ 确认推荐选题（自动选中）
            </button>
          </div>
        )}
        {/* 空状态：已点开但无推荐 */}
        {showRecommendations && recommendations.length === 0 && hasInput && (
          <div className="border border-pink-200 rounded-lg p-3 bg-pink-50/50 text-center text-xs text-pink-500">
            调整阈值或上游关键词不足，暂无推荐
          </div>
        )}
        {showRecommendations && !hasInput && (
          <div className="border border-pink-200 rounded-lg p-3 bg-pink-50/50 text-center text-xs text-gray-400">
            ← 连接关键词提取节点后才可查看评分
          </div>
        )}

        {/* 热词列表 */}
        {hasInput ? (
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
            {allKeywords.map((kw, i) => {
              const isPhrase = kw.type === 'phrase' || kw.word.length >= 4;
              const isCustom = customKeywords.some(ck => ck.word === kw.word);
              const isSelected = selectedKeywords.some(k => k.word === kw.word);
              const isRecommended = recommendations.some(r => r.word === kw.word);
              const intensity = kw.weight / maxWeight;
              return (
                <div
                  key={i}
                  onClick={() => toggleWord(kw.word)}
                  className={`px-3 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors
                    ${isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="text-violet-500">✓</span>
                      )}
                      <span className={`
                        ${isPhrase ? 'font-medium' : ''}
                        ${isSelected ? 'text-violet-700' : 'text-gray-700'}
                        ${isRecommended && !isSelected ? 'text-orange-600' : ''}
                        text-sm
                      `}>
                        {kw.word}
                      </span>
                      {isPhrase && !isSelected && (
                        <span className="text-xs px-1 py-0 bg-purple-100 text-purple-600 rounded">短语</span>
                      )}
                      {isRecommended && !isSelected && (
                        <span className="text-xs px-1 py-0 bg-orange-100 text-orange-600 rounded">🔥推荐</span>
                      )}
                      {isCustom && (
                        <span className="text-xs px-1 py-0 bg-blue-100 text-blue-600 rounded">自定义</span>
                      )}
                      {recentWrittenWords.has(kw.word) && (
                        <span className="text-xs px-1 py-0 bg-gray-100 text-gray-500 rounded">📝已写</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCustom && (
                        <span className="text-xs text-gray-400">
                          {Math.round(intensity * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-400">
            <div className="text-3xl mb-1">📝</div>
            <div className="text-sm">暂无热词</div>
            <div className="text-xs">← 连接关键词提取节点</div>
          </div>
        )}

        {/* 操作区 */}
        {hasInput && (
          <>
            {/* 自定义词 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                placeholder="添加自定义热词"
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={addCustomKeyword}
                className="px-3 py-1.5 bg-violet-600 text-white rounded text-sm hover:bg-violet-700"
              >
                添加
              </button>
            </div>

            {/* 全选/清空/复制已选 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                全选
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                清空
              </button>
              {selectedKeywords.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const text = selectedKeywords.map(k => k.word).join('、');
                    navigator.clipboard.writeText(text);
                  }}
                  className="flex-1 py-1.5 text-xs bg-violet-100 hover:bg-violet-200 text-violet-700 rounded"
                >
                  复制 ({selectedKeywords.length})
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(TopicHotwordNode);