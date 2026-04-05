import { memo, useState, useMemo, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useWorkflowStore, getInputData } from '../../hooks/useWorkflowStore';
import { generateCoverImage, getGlobalSettings } from '../../services/crawlerApi';
import type { NodeData, Keyword } from '../../types/workflow';

interface CoverImageNodeProps {
  id: string;
  data: NodeData;
}

const TEMPLATES = [
  { id: 'text-card', label: '文字卡片', bg: 'from-violet-500 to-purple-600' },
  { id: 'contrast', label: '对比图', bg: 'from-orange-500 to-red-600' },
  { id: 'list', label: '清单图', bg: 'from-blue-500 to-cyan-600' },
  { id: 'quote', label: '金句图', bg: 'from-emerald-500 to-teal-600' },
];

function CoverImageNode({ id, data }: CoverImageNodeProps) {
  const { nodes, edges } = useWorkflowStore();
  const [title, setTitle] = useState<string>((data.coverTitle as string) || '');
  const [subtitle, setSubtitle] = useState<string>((data.coverSubtitle as string) || '');
  const [templateId, setTemplateId] = useState<string>((data.templateId as string) || 'text-card');
  const [colorIndex, setColorIndex] = useState<number>(0);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // v0.19-R2: 追踪用户是否手动编辑过标题，避免覆盖
  const userEditedTitle = useRef(!!(data.coverTitle as string));

  // v0.19-R2: 从连线获取关键词（同时支持 keywords 和 selectedKeywords）
  const inputKeywords = useMemo(() => {
    // 优先读 selectedKeywords（topicRecommend/hotwordList），fallback 读 keywords
    const fromSelected = getInputData<Keyword>(id, nodes, edges, 'selectedKeywords');
    if (fromSelected?.length) return fromSelected;
    const fromKeywords = getInputData<Keyword>(id, nodes, edges, 'keywords');
    return fromKeywords || [];
  }, [id, nodes, edges]);

  // v0.19-R2: 上游关键词自动填充标题（仅首次自动填充，不覆盖用户已编辑内容）
  useEffect(() => {
    if (inputKeywords.length > 0 && !userEditedTitle.current && !title) {
      const topWord = inputKeywords[0]?.word || '';
      if (topWord) setTitle(topWord);
    }
  }, [inputKeywords]);

  const handleTitleChange = (val: string) => {
    userEditedTitle.current = true;
    setTitle(val);
  };

  // v0.19-R1: AI 生成封面
  const handleAiGenerate = async () => {
    if (!title) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const settings = await getGlobalSettings();
      const prompt = `AI科技感封面图，标题：${title}${subtitle ? '，副标题：' + subtitle : ''}，小红书风格，高清`;
      const apiKey = settings.api_key || undefined;
      const base64 = await generateCoverImage(prompt, "3:4", apiKey);
      setAiImage(`data:image/jpeg;base64,${base64}`);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setAiGenerating(false);
    }
  };

  const selectedTemplate = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const colors = [
    ['#6366f1', '#8b5cf6'], // violet
    ['#f97316', '#ef4444'], // orange-red
    ['#3b82f6', '#06b6d4'], // blue-cyan
    ['#10b981', '#14b8a6'], // emerald-teal
    ['#ec4899', '#f43f5e'], // pink-rose
  ];
  const currentColors = colors[colorIndex % colors.length];

  const exportAsImage = () => {
    const element = document.getElementById('cover-preview');
    if (!element) return;

    // 简单实现：创建 canvas 导出
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, currentColors[0]);
    gradient.addColorStop(1, currentColors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = wrapText(ctx, title || '输入标题文案', canvas.width - 120);
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 100 + i * 90);
    });

    // 绘制副标题
    if (subtitle) {
      ctx.font = '36px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 200);
    }

    // 触发下载
    const link = document.createElement('a');
    link.download = `封面_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 4); // 最多4行
  };

  const renderPreview = () => {
    switch (templateId) {
      case 'text-card':
        return (
          <div className={`bg-gradient-to-br ${selectedTemplate.bg} rounded-xl p-6 h-40 flex flex-col items-center justify-center text-white`}>
            <div className="text-xl font-bold text-center leading-tight px-4">
              {title || '标题文案'}
            </div>
            {subtitle && (
              <div className="text-sm mt-2 opacity-80">{subtitle}</div>
            )}
          </div>
        );
      case 'contrast':
        return (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 h-40 flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">VS</div>
              <div className="text-xs opacity-60">对比图模板</div>
            </div>
          </div>
        );
      case 'list':
        return (
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-4 h-40 text-white">
            <div className="text-sm font-bold mb-2">📋 清单</div>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2 text-xs opacity-80 mb-1">
                <span className="w-4 h-4 rounded bg-white/30"></span>
                <span>要点 {i}</span>
              </div>
            ))}
          </div>
        );
      case 'quote':
        return (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-6 h-40 flex flex-col items-center justify-center text-white">
            <div className="text-4xl font-serif mb-2">"</div>
            <div className="text-sm text-center italic opacity-90">
              {title || '金句文案'}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      <Handle type="target" position={Position.Left} />

      <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖼️</span>
          <span className="font-medium">封面图辅助</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 模板选择 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">模板</label>
          <div className="grid grid-cols-4 gap-1">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`text-xs py-1 rounded ${templateId === t.id ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500 hover:bg-pink-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 标题 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">标题文案</label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={inputKeywords.length > 0 ? "已有热词，自动填入" : "输入封面标题..."}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* 副标题 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">副标题（可选）</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="输入副标题..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* 颜色选择 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">配色</label>
          <div className="flex gap-2">
            {colors.map((c, i) => (
              <button
                key={i}
                onClick={() => setColorIndex(i)}
                className={`w-8 h-8 rounded-full border-2 ${colorIndex === i ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }}
              />
            ))}
          </div>
        </div>

        {/* 预览 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">预览</label>
          {aiImage ? (
            <div className="relative">
              <img src={aiImage} alt="AI封面" className="w-full rounded-lg" />
              <button
                onClick={() => setAiImage(null)}
                className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded"
              >
                ×
              </button>
            </div>
          ) : (
            renderPreview()
          )}
        </div>

        {/* AI 生成 */}
        <button
          onClick={handleAiGenerate}
          disabled={aiGenerating || !title}
          className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded font-medium text-sm hover:opacity-90 disabled:bg-gray-400"
        >
          {aiGenerating ? '🤖 AI 生成中...' : '🤖 AI 生成封面'}
        </button>

        {/* 导出 */}
        <button
          onClick={exportAsImage}
          disabled={!title}
          className="w-full py-2 bg-rose-500 text-white rounded font-medium text-sm hover:bg-rose-600 disabled:bg-gray-400"
        >
          📥 导出 PNG (1080×1440)
        </button>

        {aiError && (
          <div className="text-xs text-red-600 text-center bg-red-50 rounded p-2">
            生成失败：{aiError}
          </div>
        )}
        {inputKeywords.length === 0 && !title && (
          <div className="text-xs text-orange-500 text-center">
            ← 连接选题热词节点自动填入标题
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CoverImageNode);
