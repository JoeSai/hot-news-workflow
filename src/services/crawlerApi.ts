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
  return data.keywords as Keyword[];
}

export interface GenerateContentParams {
  keywords: string[];
  newsTitles?: string[];
  style?: string;
  apiType?: string;
  apiKey?: string;
}

export async function generateContent(params: GenerateContentParams): Promise<string> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '生成失败');
  }
  return data.draft as string;
}
