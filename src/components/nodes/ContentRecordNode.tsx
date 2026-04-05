import { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../types/workflow';
import { useDraftHistory } from '../../hooks/useDraftHistory';
import {
  getContentRecords,
  saveContentRecord,
  deleteContentRecord,
  getContentStats,
  generateReportSummary,
  getGlobalSettings,
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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

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

  // v0.20-R5: 周报/月报生成
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month'>('week');

  const REPORT = useMemo(() => {
    const now = Date.now();
    const cutoff = now - (reportPeriod === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000;
    const period = reportPeriod === 'week' ? '本周' : '本月';
    const periodRecords = records.filter(r => {
      if (!r.published_at) return false;
      return new Date(r.published_at).getTime() >= cutoff;
    });
    if (periodRecords.length === 0) return null;
    const totalLikes = periodRecords.reduce((s, r) => s + r.likes, 0);
    const totalCollects = periodRecords.reduce((s, r) => s + r.collects, 0);
    const totalComments = periodRecords.reduce((s, r) => s + r.comments, 0);
    const totalShares = periodRecords.reduce((s, r) => s + r.shares, 0);
    const totalEngagement = totalLikes + totalCollects + totalComments + totalShares;
    const topPost = [...periodRecords].sort((a, b) => (b.likes + b.collects + b.comments + b.shares) - (a.likes + a.collects + a.comments + a.shares))[0];
    const styleCount: Record<string, number> = {};
    for (const r of periodRecords) {
      styleCount[r.style || '未知'] = (styleCount[r.style || '未知'] || 0) + 1;
    }
    const topStyle = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';
    return {
      period,
      count: periodRecords.length,
      totalLikes,
      totalCollects,
      totalComments,
      totalShares,
      totalEngagement,
      topPost,
      topStyle,
      styleCount,
    };
  }, [records, reportPeriod]);
  const TIME_ANALYSIS = useMemo(() => {
    const periods = [
      { key: '🌙 凌晨 0-6点', min: 0, max: 6, total: { likes: 0, collects: 0, comments: 0, shares: 0 }, count: 0 },
      { key: '🌅 早上 6-12点', min: 6, max: 12, total: { likes: 0, collects: 0, comments: 0, shares: 0 }, count: 0 },
      { key: '☀️ 下午 12-18点', min: 12, max: 18, total: { likes: 0, collects: 0, comments: 0, shares: 0 }, count: 0 },
      { key: '🌆 晚上 18-24点', min: 18, max: 24, total: { likes: 0, collects: 0, comments: 0, shares: 0 }, count: 0 },
    ];
    for (const r of records) {
      if (!r.published_at) continue;
      const hour = new Date(r.published_at).getHours();
      const period = periods.find(p => hour >= p.min && hour < p.max);
      if (!period) continue;
      period.total.likes += r.likes;
      period.total.collects += r.collects;
      period.total.comments += r.comments;
      period.total.shares += r.shares;
      period.count++;
    }
    return periods.map(p => ({
      label: p.key,
      count: p.count,
      avg_likes: p.count > 0 ? Math.round(p.total.likes / p.count) : 0,
      avg_collects: p.count > 0 ? Math.round(p.total.collects / p.count) : 0,
      avg_comments: p.count > 0 ? Math.round(p.total.comments / p.count) : 0,
      avg_shares: p.count > 0 ? Math.round(p.total.shares / p.count) : 0,
      total_engagement: p.count > 0
        ? Math.round((p.total.likes + p.total.collects + p.total.comments + p.total.shares) / p.count)
        : 0,
    }));
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

        {/* v0.20-R5: 周报/月报自动生成 */}
        {REPORT && (
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-500">📋 {REPORT.period}运营报告</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setReportPeriod('week')}
                  className={`text-xs px-2 py-0.5 rounded ${reportPeriod === 'week' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  周报
                </button>
                <button
                  onClick={() => setReportPeriod('month')}
                  className={`text-xs px-2 py-0.5 rounded ${reportPeriod === 'month' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  月报
                </button>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-xs space-y-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><div className="text-lg font-bold text-indigo-700">{REPORT.count}</div><div className="text-gray-500">发布笔记</div></div>
                <div><div className="text-lg font-bold text-pink-600">{REPORT.totalLikes}</div><div className="text-gray-500">总点赞</div></div>
                <div><div className="text-lg font-bold text-blue-600">{REPORT.totalCollects}</div><div className="text-gray-500">总收藏</div></div>
                <div><div className="text-lg font-bold text-indigo-700">{REPORT.totalEngagement}</div><div className="text-gray-500">总互动</div></div>
              </div>
              <div className="border-t border-indigo-100 pt-2 space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">最佳表现</span><span className="text-gray-700 font-medium truncate ml-2">{REPORT.topPost?.draft_title || REPORT.topPost?.platform}</span><span className="text-pink-600 font-bold ml-2">{(REPORT.topPost?.likes || 0) + (REPORT.topPost?.collects || 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">热门类型</span><span className="text-gray-700 font-medium">{REPORT.topStyle}</span><span className="text-gray-400 ml-2">({(REPORT.styleCount || {})[REPORT.topStyle] || 0}篇)</span></div>
              </div>
              {/* v0.20-R5: AI 文字总结 */}
              <div className="border-t border-indigo-100 pt-2">
                {aiSummary ? (
                  <div className="bg-white rounded p-2 text-xs text-gray-700 italic">💬 {aiSummary}</div>
                ) : (
                  <button
                    onClick={async () => {
                      setGeneratingSummary(true);
                      try {
                        const settings = await getGlobalSettings();
                        const summary = await generateReportSummary(
                          REPORT,
                          REPORT.period || '本周',
                          settings.api_key ?? undefined,
                          settings.provider || 'deepseek',
                        );
                        setAiSummary(summary);
                      } catch (e) {
                        console.error('AI总结生成失败', e);
                      } finally {
                        setGeneratingSummary(false);
                      }
                    }}
                    disabled={generatingSummary}
                    className="w-full py-1 bg-indigo-100 text-indigo-600 rounded text-xs hover:bg-indigo-200 disabled:opacity-50"
                  >
                    {generatingSummary ? '🤖 AI 生成中...' : '🤖 AI 生成文字总结'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* v0.20-R4: 发布时间段效果统计 */}
        {records.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <div className="text-xs font-medium text-gray-500 mb-2">⏰ 发布时间段分析</div>
            <div className="space-y-1">
              {TIME_ANALYSIS.filter(t => t.count > 0).map(row => (
                <div key={row.label} className="bg-gray-50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{row.label}</span>
                    <span className="text-gray-400">{row.count}篇</span>
                  </div>
                  {/* 横向柱状图 */}
                  <div className="space-y-1">
                    {[
                      { label: '总互动', value: row.total_engagement, max: Math.max(...TIME_ANALYSIS.filter(t => t.count > 0).map(t => t.total_engagement), 1), color: 'bg-indigo-400' },
                    ].map(m => (
                      <div key={m.label} className="flex items-center gap-1">
                        <span className="w-12 text-right text-gray-400 text-xs">{m.label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`${m.color} h-2 rounded-full`}
                            style={{ width: `${Math.round((m.value / m.max) * 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-600 font-medium text-xs w-8">{m.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center mt-1">
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
