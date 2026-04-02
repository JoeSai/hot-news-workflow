// 热点新闻项
export interface NewsItem {
  title: string;
  url: string;
  img_url?: string;
  pub_time: string;
  source: string;
  category: string;
  channel: string;
  // 扩展字段
  hot_value?: number | string;
  answer_count?: number;
  follower_count?: number;
  article_info?: string;
  img_list?: string[];
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

// 时间线数据
export interface TimelineItem {
  date: string;
  count: number;
  title?: string;
  source?: string;
}

// 词云数据项
export interface WordCloudItem {
  text: string;
  value: number;
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

  // 词云节点
  wordCloudData?: WordCloudItem[];
  wordCloudStatus?: 'idle' | 'running' | 'success' | 'error';
  wordCloudTopK?: number;

  // 关系图谱节点
  graphData?: GraphData;
  graphStatus?: 'idle' | 'running' | 'success' | 'error';

  // 时间线节点
  timelineData?: TimelineItem[];
  timelineStatus?: 'idle' | 'running' | 'success' | 'error';

  // 力导向图节点
  forceGraphData?: GraphData;
  forceGraphStatus?: 'idle' | 'running' | 'success' | 'error';
}
