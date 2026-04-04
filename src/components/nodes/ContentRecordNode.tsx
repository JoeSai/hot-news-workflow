import { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../types/workflow';
import { useDraftHistory } from '../../hooks/useDraftHistory';
import {
  getContentRecords,
  saveContentRecord,
  deleteContentRecord,
  getContentStats,
  type ContentRecord,
  type ContentStats,
} from '../../services/crawlerApi';

interface ContentRecordNodeProps {
  id: string;
  data: NodeData;
}

function ContentRecordNode(_props: ContentRecordNodeProps) {
  const { drafts } = useDraftHistory();
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单状态
  const [draftId, setDraftId] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [publishedAt, setPublishedAt] = useState<string>('');
  const [platform, setPlatform] = useState<string>('小红书');
  const [likes, setLikes] = useState<number>(0);
  const [collects, setCollects] = useState<number>(0);
  const [comments, setComments] = useState<number>(0);
  const [shares, setShares] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadRecords();
    loadStats();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await getContentRecords(30);
      setRecords(data);
    } catch (e) {
      console.error('加载记录失败', e);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getContentStats();
      setStats(data);
    } catch (e) {
      console.error('加载统计失败', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);

    try {
      const selectedDraft = drafts.find(d => d.id === draftId);
      await saveContentRecord({
        draft_id: draftId || null,
        draft_title: draftTitle || selectedDraft?.titles?.[0] || null,
        keywords: selectedDraft?.keywords || [],
        style: selectedDraft?.style || '',
        published_at: publishedAt,
        platform,
        likes,
        collects,
        comments,
        shares,
        notes,
      });
      await loadRecords();
      await loadStats();
      setShowForm(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDraftId('');
    setDraftTitle('');
    setPublishedAt('');
    setPlatform('小红书');
    setLikes(0);
    setCollects(0);
    setComments(0);
    setShares(0);
    setNotes('');
  };

  const handleDelete = async (recordId: number) => {
    try {
      await deleteContentRecord(recordId);
      await loadRecords();
      await loadStats();
    } catch (e) {
      console.error('删除失败', e);
    }
  };

  // v0.20-R3: 选题类型 × 互动数据交叉分析
  const CROSS_ANALYSIS = useMemo(() => {
    const styleMap: Record<string, { total: { likes: number; collects: number; comments: number; shares: number }; count: number }> = {};
    for (const r of records) {
      const s = r.style || '未知';
      if (!styleMap[s]) styleMap[s] = { total: { likes: 0, collects: 0, comments: 0, shares: 0 }, count: 0 };
      styleMap[s].total.likes += r.likes;
      styleMap[s].total.collects += r.collects;
      styleMap[s].total.comments += r.comments;
      styleMap[s].total.shares += r.shares;
      styleMap[s].count++;
    }
    return Object.entries(styleMap)
      .map(([style, data]) => ({
        style,
        count: data.count,
        avg_likes: Math.round(data.total.likes / data.count),
        avg_collects: Math.round(data.total.collects / data.count),
        avg_comments: Math.round(data.total.comments / data.count),
        avg_shares: Math.round(data.total.shares / data.count),
      }))
      .sort((a, b) => (b.avg_likes + b.avg_collects + b.avg_comments) - (a.avg_likes + a.avg_collects + a.avg_comments));
  }, [records]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-96">
      <Handle type="target" position={Position.Left} />

      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="font-medium">内容效果记录</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-2 py-0.5 bg-white text-emerald-600 rounded hover:bg-emerald-50"
          >
            {showForm ? '取消' : '+ 记录'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* 统计概览 */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold text-gray-800">{stats.total}</div>
              <div className="text-gray-500">总笔记</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold text-pink-600">{stats.avg_likes.toFixed(0)}</div>
              <div className="text-gray-500">平均点赞</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{stats.avg_collects.toFixed(0)}</div>
              <div className="text-gray-500">平均收藏</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold text-orange-600">{stats.avg_comments.toFixed(0)}</div>
              <div className="text-gray-500">平均评论</div>
            </div>
          </div>
        )}

        {/* 记录表单 */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 border border-emerald-200 rounded-lg p-3 bg-emerald-50">
            <div className="text-xs font-medium text-emerald-700 border-b border-emerald-200 pb-1">
              记录新笔记
            </div>

            {/* 关联草稿 */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">关联草稿</label>
              <select
                value={draftId}
                onChange={(e) => {
                  setDraftId(e.target.value);
                  const d = drafts.find(dr => dr.id === e.target.value);
                  if (d) setDraftTitle(d.titles?.[0] || '');
                }}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">不关联</option>
                {drafts.slice(0, 10).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.titles?.[0] || '无标题'} ({d.createdAt})
                  </option>
                ))}
              </select>
            </div>

            {/* 发布时间 */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">发布时间</label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* 平台 */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">平台</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="小红书">小红书</option>
                <option value="微信公众号">微信公众号</option>
                <option value="微博">微博</option>
                <option value="抖音">抖音</option>
                <option value="知乎">知乎</option>
              </select>
            </div>

            {/* 互动数据 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '点赞', value: likes, setter: setLikes },
                { label: '收藏', value: collects, setter: setCollects },
                { label: '评论', value: comments, setter: setComments },
                { label: '分享', value: shares, setter: setShares },
              ].map(item => (
                <div key={item.label}>
                  <label className="text-xs text-gray-600 mb-1 block">{item.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={item.value}
                    onChange={(e) => item.setter(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ))}
            </div>

            {/* 备注 */}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">备注</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="可选备注..."
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
                rows={2}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !publishedAt}
              className="w-full py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:bg-gray-400"
            >
              {loading ? '保存中...' : '💾 保存记录'}
            </button>
          </form>
        )}

        {/* v0.20-R3: 选题类型 × 互动数据交叉分析 */}
        {records.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <div className="text-xs font-medium text-gray-500 mb-2">📊 选题类型效果分析</div>
            <div className="space-y-1">
              {CROSS_ANALYSIS.map(row => (
                <div key={row.style} className="bg-gray-50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{row.style}</span>
                    <span className="text-gray-400">{row.count}篇</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: '👍', value: row.avg_likes, color: 'text-pink-600' },
                      { label: '⭐', value: row.avg_collects, color: 'text-blue-600' },
                      { label: '💬', value: row.avg_comments, color: 'text-orange-600' },
                      { label: '↗️', value: row.avg_shares, color: 'text-gray-600' },
                    ].map(m => (
                      <div key={m.label}>
                        <span className={`font-bold ${m.color}`}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 历史记录列表 */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500">
            历史记录 ({records.length})
          </div>
          {records.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              暂无记录，发布笔记后回填数据
            </div>
          ) : (
            records.map(r => (
              <div key={r.id} className="border border-gray-100 rounded-lg p-2 text-xs">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700 truncate">
                      {r.draft_title || r.platform}
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {r.published_at ? new Date(r.published_at).toLocaleDateString('zh-CN') : '未知时间'}
                    </div>
                    <div className="flex gap-3 mt-1 text-gray-500">
                      <span>👍 {r.likes}</span>
                      <span>⭐ {r.collects}</span>
                      <span>💬 {r.comments}</span>
                      <span>↗️ {r.shares}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-gray-400 hover:text-red-500 ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ContentRecordNode);
