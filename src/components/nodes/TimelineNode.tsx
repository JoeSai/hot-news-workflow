import { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData, NewsItem } from '../../types/workflow';

interface TimelineNodeProps {
  id: string;
  data: NodeData;
}

interface TimelinePoint {
  date: string;
  time: string;
  hour: number;
  news: NewsItem[];
}

function TimelineNode({ id }: TimelineNodeProps) {
  const { updateNodeData, news } = useWorkflowStore();

  // 生成时间线数据
  const timelineData = useMemo(() => {
    if (!news || news.length === 0) return [];

    // 按小时分组
    const hourGroups: Record<string, NewsItem[]> = {};

    news.forEach((item) => {
      // 解析时间
      const dateStr = item.pub_time || '';
      let hour = 0;

      // 尝试多种时间格式
      const hourMatch = dateStr.match(/(\d{2}):(\d{2}):?/);
      if (hourMatch) {
        hour = parseInt(hourMatch[1], 10);
      }

      const dateKey = dateStr.split(' ')[0] || new Date().toISOString().split('T')[0];
      const key = `${dateKey} ${hour.toString().padStart(2, '0')}:00`;

      if (!hourGroups[key]) {
        hourGroups[key] = [];
      }
      hourGroups[key].push(item);
    });

    // 转换为数组并排序
    const points: TimelinePoint[] = Object.entries(hourGroups)
      .map(([key, items]) => {
        const [date, time] = key.split(' ');
        return {
          date,
          time,
          hour: parseInt(time.split(':')[0], 10),
          news: items,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return b.hour - a.hour;
      })
      .slice(0, 12); // 最多显示12个时间点

    return points;
  }, [news]);

  // 按平台分组统计
  const platformStats = useMemo(() => {
    if (!news || news.length === 0) return [];

    const counts: Record<string, number> = {};
    news.forEach((item) => {
      const source = item.source || '未知';
      counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }, [news]);

  // 更新状态
  if (timelineData.length > 0) {
    updateNodeData(id, { timelineStatus: 'success' });
  }

  // 颜色映射
  const platformColors: Record<string, string> = {
    '网易': '#e54343',
    '澎湃': '#1e8c2f',
    '腾讯': '#2a7fff',
    '搜狐': '#ff7f50',
    '新浪': '#ff0000',
    '中国日报': '#c41e3a',
    'IT之家': '#4fc3f7',
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[420px]">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="font-medium">时间线视图</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {timelineData.length > 0 ? (
          <div className="relative">
            {/* 时间轴线 */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-teal-500 to-gray-300" />

            {/* 时间点 */}
            <div className="space-y-4">
              {timelineData.map((point, index) => (
                <div key={index} className="relative pl-10">
                  {/* 时间点圆圈 */}
                  <div
                    className="absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: '#10b981' }}
                  />

                  {/* 时间标签 */}
                  <div className="text-xs text-gray-500 mb-1">
                    {point.date} {point.time}
                    <span className="ml-2 text-emerald-600 font-medium">
                      {point.news.length} 条
                    </span>
                  </div>

                  {/* 新闻列表 */}
                  <div className="space-y-1">
                    {point.news.slice(0, 3).map((item, i) => (
                      <div
                        key={i}
                        className="text-xs p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                        title={item.title}
                      >
                        <div
                          className="w-2 h-2 rounded-full inline-block mr-2"
                          style={{
                            backgroundColor:
                              platformColors[item.source] || '#9ca3af',
                          }}
                        />
                        <span className="text-gray-700 truncate">
                          {item.title.slice(0, 40)}
                          {item.title.length > 40 ? '...' : ''}
                        </span>
                      </div>
                    ))}
                    {point.news.length > 3 && (
                      <div className="text-xs text-gray-400 pl-2">
                        +{point.news.length - 3} 条更多
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📅</div>
              <div className="text-sm">暂无数据</div>
              <div className="text-xs mt-1">连接热点抓取节点</div>
            </div>
          </div>
        )}

        {/* 平台分布 */}
        {platformStats.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">平台分布:</div>
            <div className="flex flex-wrap gap-2">
              {platformStats.slice(0, 6).map((stat) => (
                <div
                  key={stat.source}
                  className="flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      (platformColors[stat.source] || '#9ca3af') + '20',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: platformColors[stat.source] || '#9ca3af',
                    }}
                  />
                  <span className="text-xs">
                    {stat.source} ({stat.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 统计 */}
        <div className="mt-3 text-xs text-gray-500">
          共 {news?.length || 0} 条新闻 | {timelineData.length} 个时间点
        </div>
      </div>
    </div>
  );
}

export default TimelineNode;
