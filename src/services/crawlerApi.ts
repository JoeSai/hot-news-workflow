import type { NewsItem } from '../types/workflow';

const API_BASE = 'http://localhost:8000/api';

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
  const response = await fetch(`${API_BASE}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platforms, limit }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    news: data.news as NewsItem[],
    platformResults: data.platformResults as PlatformResult[],
  };
}

export async function parseHotNewsFile(): Promise<NewsItem[]> {
  const response = await fetch(`${API_BASE}/parse`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
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
  const response = await fetch(`${API_BASE}/keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ news, top_k: topK, method }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
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
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

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
  const response = await fetch(`${API_BASE}/keywords/trend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, source }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function getKeywordTrends(keywords: string[], days: number = 7): Promise<Record<string, TrendDataPoint[]>> {
  const response = await fetch(`${API_BASE}/keywords/trend?keywords=${keywords.join(',')}&days=${days}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.trends as Record<string, TrendDataPoint[]>;
}
