// 热点新闻项
export interface NewsItem {
  title: string;
  url: string;
  img_url?: string;
  pub_time: string;
  source: string;
  category: string;
  channel: string;
}

// 关键词
export interface Keyword {
  word: string;
  weight: number;
}

// 类别节点（用于图谱）
export interface CategoryNode {
  id: string;
  label: string;
  count: number;
  color?: string;
}

// 类别关联边
export interface CategoryEdge {
  source: string;
  target: string;
  weight: number;
}

// 图数据
export interface GraphData {
  nodes: CategoryNode[];
  edges: CategoryEdge[];
}

// 节点运行时数据
export interface NodeData extends Record<string, unknown> {
  // 热点抓取节点
  platforms?: string[];
  limit?: number;
  news?: NewsItem[];
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;

  // 关键词提取节点
  keywords?: Keyword[];
  keywordStatus?: 'idle' | 'running' | 'success' | 'error';
  topK?: number;
  method?: 'tfidf' | 'textrank';
}
