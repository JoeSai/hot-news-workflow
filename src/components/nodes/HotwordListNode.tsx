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
  // selectedKeywords 存储完整 Keyword 对象（含 sourceNews）
  const [selectedKeywords, setSelectedKeywords] = useState<Keyword[]>(() => {
    const initial = data.selectedKeywords as Keyword[] | undefined;
    if (initial?.length && typeof initial[0] === 'object' && 'word' in initial[0]) {
      return initial;
    }
    return [];
  });
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [customKeywords, setCustomKeywords] = useState<Keyword[]>(data.customKeywords || []);
  const [newWord, setNewWord] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // 从连线获取输入数据（从关键词提取节点传来）
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
    // 同步到节点数据，供下游节点使用
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

  const toggleSources = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedSources);
    if (newSet.has(word)) {
      newSet.delete(word);
    } else {
      newSet.add(word);
    }
    setExpandedSources(newSet);
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

  const removeCustomKeyword = (word: string) => {
    const updated = customKeywords.filter(k => k.word !== word);
    setCustomKeywords(updated);
    const newSelected = selectedKeywords.filter(k => k.word !== word);
    setSelectedKeywords(newSelected);
    updateNodeData(id, { customKeywords: updated, selectedKeywords: newSelected, outputType: 'keywords' });
  };

  const copySelected = async () => {
    if (selectedKeywords.length === 0) return;
    const text = selectedKeywords.map(k => k.word).join('、');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAll = async () => {
    if (allKeywords.length === 0) return;
    const text = allKeywords.map(k => k.word).join('、');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 计算权重最高的词
  const maxWeight = useMemo(() => {
    if (allKeywords.length === 0) return 1;
    return Math.max(...allKeywords.map(k => k.weight));
  }, [allKeywords]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="font-medium">热词列表</span>
          </div>
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`text-xs px-2 py-0.5 rounded ${editMode ? 'bg-white text-violet-600' : 'bg-violet-400 hover:bg-violet-300'}`}
          >
            {editMode ? '完成' : '编辑'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* 统计 */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>共 {allKeywords.length} 个热词</span>
          {selectedKeywords.length > 0 && (
            <span className="text-violet-600">已选 {selectedKeywords.length} 个</span>
          )}
        </div>

        {/* 自定义关键词输入 */}
        {editMode && (
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
        )}

        {/* 热词列表 */}
        {hasInput ? (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {allKeywords.map((kw, i) => {
              const isPhrase = kw.type === 'phrase' || kw.word.length >= 4;
              const isCustom = customKeywords.some(ck => ck.word === kw.word);
              const intensity = kw.weight / maxWeight;
              return (
                <div
                  key={i}
                  onClick={() => toggleWord(kw.word)}
                  className={`px-3 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors
                    ${selectedKeywords.some(k => k.word === kw.word) ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedKeywords.some(k => k.word === kw.word) && (
                        <span className="text-violet-500">✓</span>
                      )}
                      <span className={`
                        ${isPhrase ? 'font-medium' : ''}
                        ${selectedKeywords.some(k => k.word === kw.word) ? 'text-violet-700' : 'text-gray-700'}
                      `}>
                        {kw.word}
                      </span>
                      {kw.type === 'phrase' && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                          短语
                        </span>
                      )}
                      {isCustom && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                          自定义
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCustom && (
                        <span className="text-xs text-gray-400">
                          {Math.round(intensity * 100)}%
                        </span>
                      )}
                      {kw.sourceNews && kw.sourceNews.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => toggleSources(kw.word, e)}
                          className="text-xs text-orange-500 hover:text-orange-700"
                        >
                          {expandedSources.has(kw.word) ? '▲ 收起' : '▼ 来源'}
                        </button>
                      )}
                      {editMode && isCustom && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeCustomKeyword(kw.word); }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 来源新闻 */}
                  {expandedSources.has(kw.word) && kw.sourceNews && kw.sourceNews.length > 0 && (
                    <div className="mt-1 pl-6 text-xs text-gray-500 bg-gray-50 rounded p-2">
                      <div className="text-xs font-medium text-orange-500 mb-1">🔥 来源热点：</div>
                      {kw.sourceNews.slice(0, 3).map((sn, idx) => (
                        <div key={idx} className="truncate mb-0.5">• {sn}</div>
                      ))}
                    </div>
                  )}
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

            {selectedKeywords.length > 0 && (
              <button
                type="button"
                onClick={copySelected}
                className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
                  ${copied ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                {copied ? '✓ 已复制到剪贴板' : `📋 复制已选热词 (${selectedKeywords.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(HotwordListNode);
