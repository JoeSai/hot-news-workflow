import { useEffect, useRef, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword, NewsItem } from '../../types/workflow';

interface GraphNodeProps {
  id: string;
  data: NodeData;
}

interface GraphNodeItem {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

function GraphNode({ id }: GraphNodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { updateNodeData, news, keywords } = useWorkflowStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 生成图数据
  const graphData = useMemo(() => {
    if (keywords && keywords.length > 0) {
      // 从关键词生成图
      const nodes: GraphNodeItem[] = [];
      const edges: GraphEdge[] = [];

      const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
      ];

      // 中心节点（第一个关键词）
      const centerX = 180;
      const centerY = 150;
      const radius = 100;

      keywords.slice(0, 12).forEach((keyword: Keyword, index: number) => {
        const angle = (index / 12) * Math.PI * 2;
        const r = radius * (0.5 + Math.random() * 0.5);

        nodes.push({
          id: `kw-${index}`,
          label: keyword.word,
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r,
          size: 5 + keyword.weight * 30,
          color: colors[index % colors.length],
        });

        // 连接中心
        edges.push({
          source: 'center',
          target: `kw-${index}`,
        });
      });

      // 中心节点
      nodes.unshift({
        id: 'center',
        label: '热点',
        x: centerX,
        y: centerY,
        size: 20,
        color: '#6366f1',
      });

      return { nodes, edges };
    }

    if (!news || news.length === 0) {
      return { nodes: [], edges: [] };
    }

    // 从新闻生成图（按分类聚类）
    const categoryGroups: Record<string, NewsItem[]> = {};
    news.forEach((item: NewsItem) => {
      const cat = item.category || '其他';
      if (!categoryGroups[cat]) {
        categoryGroups[cat] = [];
      }
      categoryGroups[cat].push(item);
    });

    const nodes: GraphNodeItem[] = [];
    const edges: GraphEdge[] = [];

    const categoryColors: Record<string, string> = {
      '时事热点': '#ef4444',
      '科技': '#3b82f6',
      '社会': '#22c55e',
      '财经': '#f59e0b',
      '国际': '#8b5cf6',
      '娱乐': '#ec4899',
      '体育': '#14b8a6',
      '教育': '#f97316',
      '军事': '#6b7280',
      '热榜': '#eab308',
      '其他': '#9ca3af',
    };

    const categories = Object.keys(categoryGroups);
    const centerX = 180;
    const centerY = 150;
    const categoryRadius = 80;

    categories.forEach((cat: string, catIndex: number) => {
      const catAngle = (catIndex / categories.length) * Math.PI * 2;
      const catX = centerX + Math.cos(catAngle) * categoryRadius;
      const catY = centerY + Math.sin(catAngle) * categoryRadius;

      // 分类节点
      nodes.push({
        id: `cat-${cat}`,
        label: cat,
        x: catX,
        y: catY,
        size: 12 + Math.min(categoryGroups[cat].length, 10),
        color: categoryColors[cat] || '#9ca3af',
      });

      // 连接到中心
      edges.push({
        source: 'center',
        target: `cat-${cat}`,
      });

      // 该分类下的新闻节点
      const items = categoryGroups[cat].slice(0, 5);
      items.forEach((item: NewsItem, itemIndex: number) => {
        const itemAngle = catAngle + (itemIndex - items.length / 2) * 0.3;
        const itemRadius = 50;
        const itemX = catX + Math.cos(itemAngle) * itemRadius;
        const itemY = catY + Math.sin(itemAngle) * itemRadius;

        nodes.push({
          id: `news-${cat}-${itemIndex}`,
          label: item.title.slice(0, 15) + (item.title.length > 15 ? '...' : ''),
          x: itemX,
          y: itemY,
          size: 6,
          color: categoryColors[cat] || '#9ca3af',
        });

        edges.push({
          source: `cat-${cat}`,
          target: `news-${cat}-${itemIndex}`,
        });
      });
    });

    // 中心节点
    nodes.unshift({
      id: 'center',
      label: '热点',
      x: centerX,
      y: centerY,
      size: 25,
      color: '#6366f1',
    });

    return { nodes, edges };
  }, [keywords, news]);

  // 更新状态
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      updateNodeData(id, { graphStatus: 'success' });
    }
  }, [graphData, id, updateNodeData]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[400px]">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <span className="font-medium">关系图谱</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* SVG 图谱 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {graphData.nodes.length > 0 ? (
            <svg
              ref={svgRef}
              viewBox="0 0 360 300"
              className="w-full h-[300px]"
            >
              {/* 边 */}
              <g>
                {graphData.edges.map((edge, i) => {
                  const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
                  const targetNode = graphData.nodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  return (
                    <line
                      key={i}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={hoveredNode === edge.source || hoveredNode === edge.target ? '#6366f1' : '#cbd5e1'}
                      strokeWidth={hoveredNode ? 2 : 1}
                      strokeOpacity={0.6}
                    />
                  );
                })}
              </g>

              {/* 节点 */}
              <g>
                {graphData.nodes.map((node) => (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size}
                      fill={node.color}
                      opacity={hoveredNode && hoveredNode !== node.id ? 0.4 : 0.9}
                    />
                    <title>{node.label}</title>
                    <text
                      x={node.x}
                      y={node.y + node.size + 12}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#4b5563"
                      opacity={hoveredNode && hoveredNode !== node.id ? 0.3 : 1}
                    >
                      {node.label.slice(0, 10)}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          ) : (
            <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">🔗</div>
                <div className="text-sm">暂无数据</div>
                <div className="text-xs mt-1">连接热点抓取或关键词节点</div>
              </div>
            </div>
          )}
        </div>

        {/* 图例 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries({
            时事热点: '#ef4444',
            科技: '#3b82f6',
            社会: '#22c55e',
            财经: '#f59e0b',
            国际: '#8b5cf6',
            娱乐: '#ec4899',
          })
            .slice(0, 6)
            .map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600">{cat}</span>
              </div>
            ))}
        </div>

        {/* 统计 */}
        <div className="mt-2 text-xs text-gray-500">
          节点: {graphData.nodes.length} | 关系: {graphData.edges.length}
        </div>
      </div>
    </div>
  );
}

export default GraphNode;
