import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword } from '../../types/workflow';

interface TopicRecommendNodeProps {
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
  '创业', '副业', '变现', '赚钱', '掘金',
];

// 话题类型标签
const TOPIC_TYPES = {
  科普向: ['科普', '入门', '是什么', '原理', '揭秘', '解析'],
  观点向: ['观点', '看法', '思考', '分析', '预测', '趋势'],
  教程向: ['教程', '手把手', '入门', '指南', '学习', '如何', '怎么'],
  测评向: ['测评', '评测', '对比', '横评', '体验', '试用'],
};

function TopicRecommendNode({ id, data }: TopicRecommendNodeProps) {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const [aiRelevanceThreshold, setAiRelevanceThreshold] = useState(30);

  // 从连线获取输入数据
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  const hasInput = inputKeywords.length > 0;

  // 计算AI相关性得分
  const scoreKeyword = (keyword: string): { score: number; matchType: string } => {
    const kw = keyword.toLowerCase();
    let score = 0;
    let matchType = '科普向';

    // 检查是否匹配AI关键词
    for (const aiKw of AI_KEYWORDS) {
      if (kw.includes(aiKw.toLowerCase())) {
        score += 30;
      }
    }

    // 检查话题类型
    for (const [type, markers] of Object.entries(TOPIC_TYPES)) {
      for (const marker of markers) {
        if (kw.includes(marker)) {
          matchType = type;
          score += 10;
          break;
        }
      }
    }

    // 短语比单词相关性更高
    if (keyword.length >= 4) {
      score += 10;
    }

    // 热度权重加成
    const keywordData = inputKeywords.find(k => k.word === keyword);
    if (keywordData) {
      score += keywordData.weight * 20;
    }

    return { score: Math.min(100, score), matchType };
  };

  // 排序并推荐TOP选题
  const recommendations = useMemo(() => {
    if (!hasInput) return [];

    const scored = inputKeywords.map(kw => {
      const { score, matchType } = scoreKeyword(kw.word);
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

  const handleRecommend = () => {
    if (!hasInput) return;
    updateNodeData(id, {
      recommendations,
      outputType: 'keywords',
    });
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

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="font-medium">选题推荐</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* 说明 */}
        <div className="text-sm text-gray-600">
          根据 AI 相关性对热词评分，推荐适合写的选题
        </div>

        {/* 阈值调节 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            AI 相关性阈值: {aiRelevanceThreshold}%
          </label>
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

        {/* 推荐按钮 */}
        <button
          type="button"
          onClick={handleRecommend}
          disabled={!hasInput}
          className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
            ${!hasInput ? 'bg-gray-400 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}
        >
          🎯 生成推荐
        </button>

        {/* 无输入提示 */}
        {!hasInput && (
          <div className="text-center text-gray-400 text-sm py-4">
            ← 请连接关键词提取节点
          </div>
        )}

        {/* 推荐结果 */}
        {recommendations.length > 0 && (
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="text-xs font-medium text-gray-500">
              📋 推荐选题 (TOP {recommendations.length})
            </div>

            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">
                        {getTypeIcon(rec.topicType)} {rec.topicType}
                      </span>
                    </div>
                    <div className="font-medium text-gray-800">{rec.word}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getScoreColor(rec.aiScore)}`}>
                    {rec.aiScore}%
                  </span>
                </div>

                {/* 推荐理由 */}
                <div className="text-xs text-gray-500 mt-1">
                  {rec.aiScore >= 70 ? '🔥 强烈推荐' : rec.aiScore >= 50 ? '👍 推荐' : '👀 可考虑'}
                  {rec.topicType === '教程向' && ' · 适合出教程内容'}
                  {rec.topicType === '测评向' && ' · 适合出对比测评'}
                  {rec.topicType === '观点向' && ' · 适合发表观点'}
                  {rec.topicType === '科普向' && ' · 适合新手入门'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 统计 */}
        {hasInput && (
          <div className="text-xs text-gray-400">
            共 {inputKeywords.length} 个热词，{recommendations.length} 个推荐选题
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TopicRecommendNode);
