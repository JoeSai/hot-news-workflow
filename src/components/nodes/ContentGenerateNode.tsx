import { memo, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
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
  const [style, setStyle] = useState(data.style || '科普向');
  const [apiType, setApiType] = useState(data.apiType || 'minimax');
  const [apiKey, setApiKey] = useState(data.apiKey || '');
  const [copied, setCopied] = useState('');

  // 从连线获取输入数据
  const inputKeywords = useMemo(() => {
    const keywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return keywords || [];
  }, [id, nodes, edges]);

  const inputNews = useMemo(() => {
    const news = getInputData<NewsItem>(id, nodes, edges, 'news');
    return news || [];
  }, [id, nodes, edges]);

  // 用户选中的热词（优先从节点数据读取，其次从连线获取）
  const selectedKeywords = data.selectedKeywords ||
    (getInputData<Keyword>(id, nodes, edges, 'selectedKeywords')?.map(k => k.word) || []);
  const hasInput = inputKeywords.length > 0 || selectedKeywords.length > 0;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedKeywords.length === 0) {
      updateNodeData(id, { generateStatus: 'error', error: '请先在热词列表选择热词' });
      return;
    }

    if (!apiKey.trim()) {
      updateNodeData(id, { generateStatus: 'error', error: '请输入 API Key' });
      return;
    }

    // Debug log
    console.log('Generating with:', { apiType, apiKey: apiKey.substring(0, 10) + '...' });

    updateNodeData(id, { generateStatus: 'running' });

    try {
      const draft = await generateContent({
        keywords: selectedKeywords,
        newsTitles: inputNews.slice(0, 5).map(n => n.title),
        style,
        apiType,
        apiKey,
      });

      updateNodeData(id, {
        generateStatus: 'success',
        draft,
        outputType: 'draft'
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
  const parsed = draft ? parseDraft(draft) : null;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[480px]">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">✍️</span>
          <span className="font-medium">AI 内容生成</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
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
          <label className="text-xs font-medium text-gray-600 mb-1 block">API Key</label>
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
      </div>
    </div>
  );
}

export default memo(ContentGenerateNode);
