import { useEffect, useRef, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore } from '../../hooks/useWorkflowStore';
import type { NodeData, Keyword, NewsItem } from '../../types/workflow';

interface ForceGraphNodeProps {
  id: string;
  data: NodeData;
}

interface ForceNode {
  id: string;
  label: string;
  radius: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
}

function ForceGraphNode({ id }: ForceGraphNodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { updateNodeData, news, keywords } = useWorkflowStore();
  const [renderKey, setRenderKey] = useState(0);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // 生成力导向图数据
  const forceData = useMemo(() => {
    if (keywords && keywords.length > 0) {
      // 从关键词生成力导向图
      const nodes: ForceNode[] = [];
      const links: ForceLink[] = [];

      const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
        '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
      ];

      // 中心节点
      nodes.push({
        id: 'center',
        label: '热点',
        radius: 25,
        color: '#6366f1',
      });

      // 关键词节点
      keywords.slice(0, 15).forEach((kw: Keyword, i: number) => {
        const angle = (i / 15) * Math.PI * 2;
        const dist = 80 + Math.random() * 40;

        nodes.push({
          id: `kw-${i}`,
          label: kw.word,
          radius: 6 + kw.weight * 25,
          color: colors[i % colors.length],
          x: 200 + Math.cos(angle) * dist,
          y: 150 + Math.sin(angle) * dist,
        });

        // 连接中心
        links.push({
          source: 'center',
          target: `kw-${i}`,
        });
      });

      return { nodes, links };
    }

    if (!news || news.length === 0) {
      return { nodes: [], links: [] };
    }

    // 从新闻生成力导向图
    const nodes: ForceNode[] = [];
    const links: ForceLink[] = [];

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

    // 按分类聚合
    const categoryGroups: Record<string, NewsItem[]> = {};
    news.forEach((item: NewsItem) => {
      const cat = item.category || '其他';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(item);
    });

    const categories = Object.keys(categoryGroups);

    // 中心节点
    nodes.push({
      id: 'center',
      label: '热点',
      radius: 30,
      color: '#6366f1',
    });

    // 分类节点
    categories.forEach((cat: string, catIdx: number) => {
      const angle = (catIdx / categories.length) * Math.PI * 2;
      const dist = 70;

      nodes.push({
        id: `cat-${cat}`,
        label: cat,
        radius: 10 + Math.min(categoryGroups[cat].length * 2, 15),
        color: categoryColors[cat] || '#9ca3af',
        x: 200 + Math.cos(angle) * dist,
        y: 150 + Math.sin(angle) * dist,
      });

      links.push({
        source: 'center',
        target: `cat-${cat}`,
      });

      // 分类下的新闻节点
      categoryGroups[cat].slice(0, 4).forEach((item: NewsItem, itemIdx: number) => {
        const itemAngle = angle + (itemIdx - 1) * 0.4;
        const itemDist = 40;

        nodes.push({
          id: `news-${cat}-${itemIdx}`,
          label: item.title.slice(0, 12),
          radius: 5,
          color: categoryColors[cat] || '#9ca3af',
          x: 200 + Math.cos(itemAngle) * itemDist,
          y: 150 + Math.sin(itemAngle) * itemDist,
        });

        links.push({
          source: `cat-${cat}`,
          target: `news-${cat}-${itemIdx}`,
        });
      });
    });

    return { nodes, links };
  }, [keywords, news]);

  // 简单的力导向模拟
  useEffect(() => {
    if (forceData.nodes.length === 0) return;

    const nodes = forceData.nodes as ForceNode[];
    const links = forceData.links as ForceLink[];

    // 初始化位置
    const centerX = 200;
    const centerY = 150;

    // 力模拟参数
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      // 中心引力
      nodes.forEach((node) => {
        if (node.id === 'center') return;

        const dx = centerX - (node.x || 0);
        const dy = centerY - (node.y || 0);

        // 引力
        const force = 0.01;
        node.x = (node.x || 0) + dx * force;
        node.y = (node.y || 0) + dy * force;
      });

      // 链接斥力
      links.forEach((link) => {
        const source = link.source as ForceNode;
        const target = link.target as ForceNode;

        if (!source.x || !source.y || !target.x || !target.y) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const idealDist = 60;
        const force = (dist - idealDist) * 0.05;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (source.id !== 'center') {
          source.x = (source.x || 0) - fx;
          source.y = (source.y || 0) - fy;
        }
        if (target.id !== 'center') {
          target.x = (target.x || 0) + fx;
          target.y = (target.y || 0) + fy;
        }
      });

      // 节点互斥
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];

          const dx = (b.x || 0) - (a.x || 0);
          const dy = (b.y || 0) - (a.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const minDist = (a.radius || 10) + (b.radius || 10) + 5;
          if (dist < minDist) {
            const force = (minDist - dist) * 0.1;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (a.id !== 'center') {
              a.x = (a.x || 0) - fx;
              a.y = (a.y || 0) - fy;
            }
            if (b.id !== 'center') {
              b.x = (b.x || 0) + fx;
              b.y = (b.y || 0) + fy;
            }
          }
        }
      }

      // 边界约束
      nodes.forEach((node) => {
        if (node.id === 'center') return;
        node.x = Math.max(30, Math.min(370, node.x || 200));
        node.y = Math.max(30, Math.min(270, node.y || 150));
      });
    }

    // 触发重新渲染
    setRenderKey((k) => k + 1);
  }, [forceData]);

  // 处理拖拽
  const handleDragStart = (nodeId: string) => {
    setDraggedNode(nodeId);
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!draggedNode || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 300;

    const node = forceData.nodes.find((n) => n.id === draggedNode) as ForceNode | undefined;
    if (node) {
      node.fx = x;
      node.fy = y;
      node.x = x;
      node.y = y;
      setRenderKey((k) => k + 1);
    }
  };

  const handleDragEnd = () => {
    if (draggedNode) {
      const node = forceData.nodes.find((n) => n.id === draggedNode) as ForceNode | undefined;
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    setDraggedNode(null);
  };

  // 更新状态
  useEffect(() => {
    if (forceData.nodes.length > 0) {
      updateNodeData(id, { forceGraphStatus: 'success' });
    }
  }, [forceData, id, updateNodeData]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-[420px]">
      <Handle type="target" position={Position.Left} />

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌀</span>
          <span className="font-medium">力导向图</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* SVG 力导向图 */}
        <div
          className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 cursor-move"
          onMouseMove={handleDrag}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {forceData.nodes.length > 0 ? (
            <svg
              ref={svgRef}
              viewBox="0 0 400 300"
              className="w-full h-[300px]"
              key={renderKey}
            >
              {/* 链接 */}
              <g>
                {forceData.links.map((link, i) => {
                  const source = link.source as ForceNode;
                  const target = link.target as ForceNode;

                  return (
                    <line
                      key={i}
                      x1={source.x || 0}
                      y1={source.y || 0}
                      x2={target.x || 0}
                      y2={target.y || 0}
                      stroke="#cbd5e1"
                      strokeWidth={1.5}
                      strokeOpacity={0.6}
                    />
                  );
                })}
              </g>

              {/* 节点 */}
              <g>
                {forceData.nodes.map((node) => {
                  const n = node as ForceNode;

                  return (
                    <g
                      key={node.id}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleDragStart(node.id);
                      }}
                      style={{ cursor: draggedNode === node.id ? 'grabbing' : 'grab' }}
                    >
                      <circle
                        cx={n.x || 0}
                        cy={n.y || 0}
                        r={n.radius || 10}
                        fill={n.color}
                        opacity={draggedNode && draggedNode !== node.id ? 0.4 : 0.9}
                        stroke={draggedNode === node.id ? '#1e293b' : 'transparent'}
                        strokeWidth={2}
                      />
                      <title>{n.label}</title>
                      {n.radius && n.radius > 10 && (
                        <text
                          x={n.x || 0}
                          y={(n.y || 0) + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="white"
                          fontWeight="bold"
                        >
                          {n.label.length > 6 ? n.label.slice(0, 6) + '..' : n.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : (
            <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">🌀</div>
                <div className="text-sm">暂无数据</div>
                <div className="text-xs mt-1">连接节点获取数据</div>
              </div>
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="mt-2 text-xs text-gray-500">
          💡 拖拽节点可调整位置 | 节点大小表示权重
        </div>

        {/* 统计 */}
        <div className="mt-1 text-xs text-gray-500">
          节点: {forceData.nodes.length} | 链接: {forceData.links.length}
        </div>
      </div>
    </div>
  );
}

export default ForceGraphNode;
