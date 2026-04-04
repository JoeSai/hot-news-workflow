import type { NewsItem } from '../types/workflow';

const API_BASE = 'http://localhost:8000/api';

// 请求超时（毫秒）
const FETCH_TIMEOUT = 30000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`请求超时（${timeout / 1000}秒）`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface PlatformResult {
  platform: string;
  count: number;
  success: boolean;
}

export interface CrawlResult {
  news: NewsItem[];
  platformResults: PlatformResult[];
}

export async function runCrawler(platforms: string[], limit: number = 30): Promise<CrawlResult> {
  const response = await fetchWithTimeout(`${API_BASE}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platforms, limit }),
  }, 60000);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '抓取失败');
  }
  return {
    news: data.news as NewsItem[],
    platformResults: data.platformResults as PlatformResult[],
  };
}

export async function parseHotNewsFile(): Promise<NewsItem[]> {
  const response = await fetchWithTimeout(`${API_BASE}/parse`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '加载失败');
  }
  return data.news as NewsItem[];
}

export interface Keyword {
  word: string;
  weight: number;
}

export async function extractKeywords(
  news: NewsItem[],
  topK: number = 50,
  method: string = 'phrase'
): Promise<Keyword[]> {
  const response = await fetchWithTimeout(`${API_BASE}/keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ news, top_k: topK, method }),
  }, 30000);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '提取失败');
  }
  // 转换 snake_case -> camelCase
  return (data.keywords as Array<Record<string, unknown>>).map(k => ({
    word: k.word as string,
    weight: k.weight as number,
    type: k.type as 'word' | 'phrase' | undefined,
    sourceNews: k.source_news as string[] | undefined,
  }));
}

export interface GenerateContentParams {
  keywords: Array<{ word: string; weight: number; type?: string; sourceNews?: string[] }>;
  newsTitles?: string[];
  style?: string;
  apiType?: string;
  apiKey?: string;
}

export interface GenerateContentResult {
  draft: string;
  titles: string[];
  body: string;
  tags: string[];
}

export async function generateContent(params: GenerateContentParams): Promise<GenerateContentResult> {
  // 转换为后端 snake_case 字段名
  // api_key 只在用户提供了才传，空时让后端读环境变量
  const payload: Record<string, unknown> = {
    keywords: params.keywords,
    news_titles: params.newsTitles || [],
    style: params.style,
    api_type: params.apiType,
  };
  if (params.apiKey) {
    payload.api_key = params.apiKey;
  }
  const response = await fetchWithTimeout(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 90000);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '生成失败');
  }
  // 后端返回结构化数据，消除前端正则解析
  return {
    draft: data.draft as string,
    titles: (data.titles as string[]) || [],
    body: data.body as string || '',
    tags: (data.tags as string[]) || [],
  };
}

// ==================== 关键词趋势 API ====================

export interface TrendDataPoint {
  date: string;
  weight: number;
  count: number;
}

export interface KeywordTrend {
  word: string;
  data: TrendDataPoint[];
  status?: 'rising' | 'falling' | 'exploding' | 'stable';
}

export async function saveKeywordTrends(keywords: Keyword[], source: string = 'crawl'): Promise<{ success: boolean; saved: number }> {
  const response = await fetchWithTimeout(`${API_BASE}/keywords/trend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, source }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function getKeywordTrends(keywords: string[], days: number = 7): Promise<Record<string, TrendDataPoint[]>> {
  const response = await fetchWithTimeout(`${API_BASE}/keywords/trend?keywords=${keywords.join(',')}&days=${days}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '获取趋势失败');
  }
  return data.trends as Record<string, TrendDataPoint[]>;
}

// ==================== 内容效果记录 API ====================

export interface ContentRecord {
  id: number;
  draft_id: string | null;
  draft_title: string | null;
  keywords: string[];
  style: string;
  published_at: string;
  platform: string;
  likes: number;
  collects: number;
  comments: number;
  shares: number;
  notes: string;
  created_at: string;
}

export interface ContentStats {
  total: number;
  total_likes: number;
  total_collects: number;
  total_comments: number;
  total_shares: number;
  avg_likes: number;
  avg_collects: number;
  avg_comments: number;
  avg_shares: number;
  by_style: Array<{
    style: string;
    count: number;
    avg_likes: number;
    avg_collects: number;
    avg_comments: number;
    avg_shares: number;
  }>;
}

export async function saveContentRecord(data: Omit<ContentRecord, 'id' | 'created_at'>): Promise<number> {
  const response = await fetchWithTimeout(`${API_BASE}/content-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '保存失败');
  return result.id;
}

export async function getContentRecords(limit: number = 50): Promise<ContentRecord[]> {
  const response = await fetchWithTimeout(`${API_BASE}/content-records?limit=${limit}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '获取失败');
  return result.records as ContentRecord[];
}

export async function deleteContentRecord(id: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/content-records/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
}

// ==================== 封面图生成 API ====================

export async function generateCoverImage(prompt: string, aspectRatio: string = "3:4", apiKey?: string): Promise<string> {
  const payload: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio };
  if (apiKey) payload.api_key = apiKey;
  const response = await fetchWithTimeout(`${API_BASE}/cover/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 120000);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '生成失败');
  return data.image_base64 as string;
}

export async function getContentStats(): Promise<ContentStats> {
  const response = await fetchWithTimeout(`${API_BASE}/content-records/stats/summary`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const result = await response.json();
  return result.stats as ContentStats;
}

// ==================== AI 全局设置 API ====================

export interface GlobalSettings {
  provider: string;
  api_key: string | null;
  api_base: string | null;
  model: string | null;
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const response = await fetchWithTimeout(`${API_BASE}/settings`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '获取设置失败');
  return data.settings as GlobalSettings;
}

export async function saveGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '保存设置失败');
}
