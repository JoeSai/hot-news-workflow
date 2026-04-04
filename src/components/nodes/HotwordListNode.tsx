import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword } from '../../types/workflow';

interface HotwordListNodeProps {
  id: string;
  data: NodeData;
}

function HotwordListNode({ id, data }: HotwordListNodeProps) {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set(data.selectedKeywords || []));
  const [copied, setCopied] = useState(false);

  // 从连线获取输入数据（从关键词提取节点传来）
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  const hasInput = inputKeywords.length > 0;

  const toggleWord = (word: string) => {
    const newSet = new Set(selectedWords);
    if (newSet.has(word)) {
      newSet.delete(word);
    } else {
      newSet.add(word);
    }
    setSelectedWords(newSet);
    // 同步到节点数据，供下游节点使用
    updateNodeData(id, { selectedKeywords: Array.from(newSet), outputType: 'keywords' });
  };

  const selectAll = () => {
    const allWords = new Set(inputKeywords.map(k => k.word));
    setSelectedWords(allWords);
    updateNodeData(id, { selectedKeywords: Array.from(allWords), outputType: 'keywords' });
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
    updateNodeData(id, { selectedKeywords: [], outputType: 'keywords' });
  };

  const copySelected = async () => {
    if (selectedWords.size === 0) return;
    const text = Array.from(selectedWords).join('、');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAll = async () => {
    if (inputKeywords.length === 0) return;
    const text = inputKeywords.map(k => k.word).join('、');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 计算权重最高的词
  const maxWeight = useMemo(() => {
    if (inputKeywords.length === 0) return 1;
    return Math.max(...inputKeywords.map(k => k.weight));
  }, [inputKeywords]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="font-medium">热词列表</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* 统计 */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>共 {inputKeywords.length} 个热词</span>
          {selectedWords.size > 0 && (
            <span className="text-violet-600">已选 {selectedWords.size} 个</span>
          )}
        </div>

        {/* 热词列表 */}
        {hasInput ? (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {inputKeywords.map((kw, i) => {
              const isPhrase = kw.type === 'phrase' || kw.word.length >= 4;
              const intensity = kw.weight / maxWeight;
              return (
                <div
                  key={i}
                  onClick={() => toggleWord(kw.word)}
                  className={`px-3 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors
                    ${selectedWords.has(kw.word) ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedWords.has(kw.word) && (
                        <span className="text-violet-500">✓</span>
                      )}
                      <span className={`
                        ${isPhrase ? 'font-medium' : ''}
                        ${selectedWords.has(kw.word) ? 'text-violet-700' : 'text-gray-700'}
                      `}>
                        {kw.word}
                      </span>
                      {kw.type === 'phrase' && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                          短语
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {Math.round(intensity * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm">暂无热词数据</div>
            <div className="text-xs mt-1">← 请连接关键词提取节点</div>
          </div>
        )}

        {/* 操作按钮 */}
        {hasInput && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                全选
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                清空
              </button>
              <button
                type="button"
                onClick={copyAll}
                className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                复制全部
              </button>
            </div>

            {selectedWords.size > 0 && (
              <button
                type="button"
                onClick={copySelected}
                className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
                  ${copied ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                {copied ? '✓ 已复制到剪贴板' : `📋 复制已选热词 (${selectedWords.size})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(HotwordListNode);
