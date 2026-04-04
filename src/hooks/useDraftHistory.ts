import { useState, useCallback } from 'react';

export interface DraftItem {
  id: string;
  createdAt: string;
  keywords: string[];
  titles: string[];
  body: string;
  tags: string[];
  style: string;
}

const STORAGE_KEY = 'draft-history';
const MAX_DRAFTS = 50;

function loadDrafts(): DraftItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('加载草稿历史失败:', e);
  }
  return [];
}

function saveDrafts(drafts: DraftItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn('保存草稿历史失败:', e);
  }
}

export function useDraftHistory() {
  const [drafts, setDrafts] = useState<DraftItem[]>(() => loadDrafts());

  const addDraft = useCallback((draft: Omit<DraftItem, 'id' | 'createdAt'>) => {
    const newDraft: DraftItem = {
      ...draft,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toLocaleString('zh-CN'),
    };

    setDrafts(prev => {
      const updated = [newDraft, ...prev].slice(0, MAX_DRAFTS);
      saveDrafts(updated);
      return updated;
    });

    return newDraft.id;
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setDrafts(prev => {
      const updated = prev.filter(d => d.id !== id);
      saveDrafts(updated);
      return updated;
    });
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDrafts([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

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
    addDraft,
    deleteDraft,
    clearAllDrafts,
    exportDraft,
  };
}
