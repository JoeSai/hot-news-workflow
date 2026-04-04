import { useState, useCallback, useEffect } from 'react';

export interface DraftItem {
  id: string;
  createdAt: string;
  keywords: string[];
  titles: string[];
  body: string;
  tags: string[];
  style: string;
}

const API_BASE = 'http://localhost:8000/api';

async function fetchDrafts(): Promise<DraftItem[]> {
  const response = await fetch(`${API_BASE}/drafts`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.drafts.map((d: Record<string, unknown>) => ({
    id: String(d.id),
    createdAt: d.created_at as string,
    keywords: JSON.parse(d.keywords as string) as string[],
    titles: JSON.parse(d.titles as string) as string[],
    body: d.body as string,
    tags: JSON.parse(d.tags as string) as string[],
    style: d.style as string,
  }));
}

async function createDraft(draft: Omit<DraftItem, 'id' | 'createdAt'>): Promise<string> {
  const response = await fetch(`${API_BASE}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords: draft.keywords,
      titles: draft.titles,
      body: draft.body,
      tags: draft.tags,
      style: draft.style,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return String(data.id);
}

async function removeDraft(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/drafts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
}

export function useDraftHistory() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化时从后端加载草稿
  useEffect(() => {
    fetchDrafts()
      .then(setDrafts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addDraft = useCallback(async (draft: Omit<DraftItem, 'id' | 'createdAt'>): Promise<string> => {
    const id = await createDraft(draft);
    const newDraft: DraftItem = {
      ...draft,
      id,
      createdAt: new Date().toLocaleString('zh-CN'),
    };
    setDrafts(prev => [newDraft, ...prev]);
    return id;
  }, []);

  const deleteDraft = useCallback(async (id: string) => {
    await removeDraft(id);
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

  const clearAllDrafts = useCallback(() => {
    // 批量删除
    Promise.all(drafts.map(d => removeDraft(d.id)))
      .catch(e => setError(e.message));
    setDrafts([]);
  }, [drafts]);

  const exportDraft = useCallback((draft: DraftItem, format: 'json' | 'markdown' | 'txt') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    const safeTitle = draft.titles[0] || '无标题';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      content = JSON.stringify(draft, null, 2);
      filename = `草稿_${safeTitle.slice(0, 20)}_${dateStr}.json`;
      mimeType = 'application/json';
    } else if (format === 'markdown') {
      const md = [
        `# ${safeTitle}`,
        '',
        `> 创建时间：${draft.createdAt}`,
        `> 风格：${draft.style}`,
        '',
        '## 标题备选',
        ...draft.titles.map((t, i) => `${i + 1}. ${t}`),
        '',
        '## 正文',
        draft.body,
        '',
        '## 推荐标签',
        draft.tags.map(t => `#${t}`).join(' '),
      ].join('\n');
      content = md;
      filename = `草稿_${safeTitle.slice(0, 20)}_${dateStr}.md`;
      mimeType = 'text/markdown';
    } else {
      const txt = [
        `标题：${safeTitle}`,
        `创建时间：${draft.createdAt}`,
        `风格：${draft.style}`,
        '',
        '---',
        '',
        '【标题备选】',
        draft.titles.join('\n'),
        '',
        '【正文】',
        draft.body,
        '',
        '【推荐标签】',
        draft.tags.join(' '),
      ].join('\n');
      content = txt;
      filename = `草稿_${safeTitle.slice(0, 20)}_${dateStr}.txt`;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    drafts,
    loading,
    error,
    addDraft,
    deleteDraft,
    clearAllDrafts,
    exportDraft,
  };
}
