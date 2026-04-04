import { memo, useState, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import { useDraftHistory } from '../../hooks/useDraftHistory';
import type { NodeData, Keyword, NewsItem } from '../../types/workflow';
import { generateContent } from '../../services/crawlerApi';

interface ContentGenerateNodeProps {
  id: string;
  data: NodeData;
}

const CONTENT_STYLES = [
  { id: '科普向', label: '科普向', desc: '通俗易懂，适合新手' },
  { id: '观点向', label: '观点向', desc: '有态度，引发讨论' },
  { id: '教程向', label: '教程向', desc: '手把手教技能' },
  { id: '测评向', label: '测评向', desc: '对比评测，建议选购' },
];

function ContentGenerateNode({ id, data }: ContentGenerateNodeProps) {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const { drafts, addDraft, deleteDraft, exportDraft } = useDraftHistory();
  const [style, setStyle] = useState(data.style || '科普向');
  const [apiType, setApiType] = useState(data.apiType || 'minimax');
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [useServerKey, setUseServerKey] = useState(data.useServerKey || false);
  const [copied, setCopied] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);

  // 组件挂载时清除旧错误状态
  useEffect(() => {
    if (data.generateStatus === 'error') {
      updateNodeData(id, { generateStatus: 'idle', error: undefined });
    }
  }, []);

  // 从连线获取输入数据
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  const inputNews = useMemo(() => {
    const news = getInputData<NewsItem>(id, nodes, edges, 'news');
    return news || [];
  }, [id, nodes, edges]);

  // 用户选中的热词（优先从连线获取完整 Keyword 对象，其次从节点数据）
  const selectedKeywordsFromEdge = getInputData<Keyword>(id, nodes, edges, 'selectedKeywords');
  // data.selectedKeywords 是 string[]（只有词），edge 传来的是 Keyword[]（有 sourceNews）
  const selectedKeywords: Keyword[] = selectedKeywordsFromEdge?.length
    ? selectedKeywordsFromEdge
    : (data.selectedKeywords as string[] || []).map(w => ({ word: w, weight: 1.0 }));
  const hasInput = inputKeywords.length > 0 || selectedKeywords.length > 0;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedKeywords.length === 0) {
      updateNodeData(id, { generateStatus: 'error', error: '请先在热词列表选择热词' });
      return;
    }

    if (!useServerKey && !apiKey.trim()) {
      updateNodeData(id, { generateStatus: 'error', error: '请输入 API Key，或勾选"使用服务端 Key"' });
      return;
    }

    // Debug log
    const keyToLog = useServerKey ? '(server env)' : apiKey.substring(0, 10) + '...';
    console.log('Generating with:', { apiType, apiKey: keyToLog });

    updateNodeData(id, { generateStatus: 'running' });

    try {
      const result = await generateContent({
        keywords: selectedKeywords,
        newsTitles: inputNews.slice(0, 5).map(n => n.title),
        style,
        apiType,
        apiKey,
      });

      updateNodeData(id, {
        generateStatus: 'success',
        draft: result.draft,
        draftTitles: result.titles,
        draftBody: result.body,
        draftTags: result.tags,
        outputType: 'draft'
      });

      // 保存到草稿历史
      addDraft({
        keywords: selectedKeywords.map(k => k.word),
        titles: result.titles,
        body: result.body,
        tags: result.tags,
        style,
      });
    } catch (error) {
      updateNodeData(id, {
        generateStatus: 'error',
        error: error instanceof Error ? error.message : '生成失败',
      });
    }
  };

  const copyToClipboard = async (text: string, part: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(part);
    setTimeout(() => setCopied(''), 2000);
  };

  // 解析草稿
  const parseDraft = (draft: string) => {
    if (!draft) return { titles: [], body: '', tags: [] };

    const titles: string[] = [];
    const titleMatch = draft.match(/## 标题（.*?）\n([\s\S]*?)(?=## 正文|$)/);
    if (titleMatch) {
      const titleSection = titleMatch[1];
      const matches = titleSection.match(/\[\s*(.*?)\s*\]/g);
      if (matches) {
        matches.forEach(m => titles.push(m.replace(/[\[\]]/g, '').trim()));
      }
      // 也匹配普通文本行
      titleSection.split('\n').forEach(line => {
        const trimmed = line.replace(/^[-\d.。]*\s*/, '').trim();
        if (trimmed && !trimmed.startsWith('[') && trimmed.length > 5 && trimmed.length < 50) {
          titles.push(trimmed);
        }
      });
    }

    let body = '';
    const bodyMatch = draft.match(/## 正文\n([\s\S]*?)(?=## 推荐标签|$)/);
    if (bodyMatch) {
      body = bodyMatch[1].trim();
    }

    const tags: string[] = [];
    const tagMatch = draft.match(/## 推荐标签（.*?）\n([\s\S]*?)$/);
    if (tagMatch) {
      const tagSection = tagMatch[1];
      const matches = tagSection.match(/[#\[]*([^\]#\n]+)[#\]]*/g);
      if (matches) {
        matches.forEach(m => {
          const cleaned = m.replace(/^[#\[]/, '').replace(/[#\]]$/, '').trim();
          if (cleaned && cleaned.length > 1 && cleaned.length < 20) {
            tags.push(cleaned);
          }
        });
      }
    }

    return { titles: titles.slice(0, 3), body, tags: tags.slice(0, 8) };
  };

  const draft = data.draft as string | undefined;
  // 优先使用后端返回的结构化数据，降级到正则解析
  const parsed = draft ? {
    titles: (data.draftTitles as string[] | undefined)?.length ? data.draftTitles as string[] : parseDraft(draft).titles,
    body: (data.draftBody as string | undefined) || parseDraft(draft).body,
    tags: (data.draftTags as string[] | undefined)?.length ? data.draftTags as string[] : parseDraft(draft).tags,
  } : null;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[480px]">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✍️</span>
            <span className="font-medium">AI 内容生成</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-2 py-0.5 rounded ${showHistory ? 'bg-white text-indigo-600' : 'bg-indigo-400 hover:bg-indigo-300'}`}
          >
            {showHistory ? '返回' : `历史 ${drafts.length > 0 ? `(${drafts.length})` : ''}`}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {showHistory ? (
          /* 历史视图 */
          drafts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <div className="text-sm">暂无草稿历史</div>
              <div className="text-xs mt-1">生成草稿后会自动保存</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>共 {drafts.length} 条草稿</span>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {drafts.map((d) => (
                  <div key={d.id} className="border-b border-gray-100 last:border-b-0">
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedDraft(selectedDraft === d.id ? null : d.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {d.titles[0] || '无标题'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {d.createdAt} · {d.style}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); exportDraft(d, 'markdown'); }}
                            className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                            title="导出 MD"
                          >
                            MD
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); exportDraft(d, 'json'); }}
                            className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                            title="导出 JSON"
                          >
                            JSON
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDraft(d.id); }}
                            className="text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100"
                            title="删除"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {/* 展开预览 */}
                      {selectedDraft === d.id && (
                        <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 space-y-1">
                          <div className="font-medium text-indigo-600">标题备选：</div>
                          {d.titles.map((t, i) => <div key={i} className="ml-2">· {t}</div>)}
                          <div className="font-medium text-indigo-600 mt-2">正文：</div>
                          <div className="ml-2 whitespace-pre-wrap">{d.body.slice(0, 200)}{d.body.length > 200 ? '...' : ''}</div>
                          <div className="font-medium text-indigo-600 mt-2">标签：</div>
                          <div className="ml-2">{d.tags.map(t => `#${t}`).join(' ')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <>
        {/* 输入信息 */}
        <div className="text-sm text-gray-600">
          <div>热词: <span className="font-medium">{selectedKeywords.length || inputKeywords.length}</span> 个</div>
          {!hasInput && <div className="text-orange-500 mt-1">← 请连接热词列表节点</div>}
        </div>

        {/* 配置 */}
        <div className="grid grid-cols-2 gap-3">
          {/* API 类型 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">AI 提供商</label>
            <select
              value={apiType}
              onChange={(e) => {
                setApiType(e.target.value);
                updateNodeData(id, { apiType: e.target.value });
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="minimax">MiniMax</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>

          {/* 风格 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">内容风格</label>
            <select
              value={style}
              onChange={(e) => {
                setStyle(e.target.value);
                updateNodeData(id, { style: e.target.value });
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {CONTENT_STYLES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* API Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">API Key</label>
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={useServerKey}
                onChange={(e) => {
                  setUseServerKey(e.target.checked);
                  updateNodeData(id, { useServerKey: e.target.checked });
                }}
                onClick={(e) => e.stopPropagation()}
                className="accent-indigo-500"
              />
              使用服务端 Key
            </label>
          </div>
          {useServerKey ? (
            <div className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded border border-gray-200">
              将使用服务端环境变量配置的 API Key
            </div>
          ) : (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                updateNodeData(id, { apiKey: e.target.value });
              }}
              placeholder="输入 API Key"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* 生成按钮 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={data.generateStatus === 'running' || !hasInput || selectedKeywords.length === 0}
          className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
            ${!hasInput || selectedKeywords.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {data.generateStatus === 'running' ? '🤖 生成中...' : '✨ 生成草稿'}
        </button>

        {/* 错误提示 */}
        {data.generateStatus === 'error' && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {data.error}
          </div>
        )}

        {/* 草稿预览 */}
        {parsed && parsed.body && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="text-xs font-medium text-gray-500">📝 草稿预览</div>

            {/* 标题 */}
            {parsed.titles.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">标题备选</div>
                <div className="space-y-1">
                  {parsed.titles.map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">{i + 1}</span>
                      <span className="text-sm text-gray-700 flex-1">{t}</span>
                      <button
                        onClick={() => copyToClipboard(t, `title-${i}`)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {copied === `title-${i}` ? '✓' : '📋'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 正文 */}
            {parsed.body && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">正文</span>
                  <button
                    onClick={() => copyToClipboard(parsed.body, 'body')}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {copied === 'body' ? '✓ 已复制' : '📋 复制'}
                  </button>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-48 overflow-y-auto">
                  {parsed.body}
                </div>
              </div>
            )}

            {/* 标签 */}
            {parsed.tags.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">推荐标签</span>
                  <button
                    onClick={() => copyToClipboard(parsed.tags.join(' '), 'tags')}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {copied === 'tags' ? '✓ 已复制' : '📋 复制'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {parsed.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-pink-100 text-pink-600 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 警告 */}
            <div className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded">
              ⚠️ 草稿仅供参考，请修改后手动发布
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(ContentGenerateNode);
