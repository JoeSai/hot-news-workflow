"""
Hot News Workflow - FastAPI 后端服务
对接现有 hot_news_spider 爬虫
"""
import subprocess
import re
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from collections import Counter

import jieba
import jieba.analyse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Hot News Workflow API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据目录 - 支持 macOS/Linux
DATA_DIR = Path(__file__).parent.parent / "data"
SPIDER_DIR = Path(os.environ.get("HOT_NEWS_SPIDER_DIR", str(DATA_DIR)))

# 确保数据目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = DATA_DIR / "hot_news.txt"

# 热点新闻项
class NewsItem(BaseModel):
    title: str
    url: str
    img_url: Optional[str] = ""
    pub_time: str
    source: str
    category: str
    channel: str

class CrawlRequest(BaseModel):
    platforms: List[str] = ["wangyi", "pengpai", "tencent"]
    limit: int = 30

def parse_hot_news_file(filepath: str) -> List[NewsItem]:
    """解析 hot_news.txt 文件，提取新闻数据"""
    news_items = []
    current_news = {}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return []

    for line in lines:
        line = line.strip()

        # 跳过标题行和分隔线
        if not line or line.startswith("===") or line.startswith("---"):
            # 只有当所有必填字段都存在时才添加
            if current_news.get("title") and current_news.get("url") and current_news.get("pub_time"):
                news_items.append(NewsItem(**current_news))
            current_news = {}
            continue

        # 解析标题行 [序号] 来源 - 频道 - 分类
        title_match = re.match(r"\[(\d+)\]\s+(\S+)\s+-\s+(\S+)\s+-\s+(\S+)", line)
        if title_match:
            _, source, channel, category = title_match.groups()
            current_news["source"] = source
            current_news["channel"] = channel
            current_news["category"] = category
            continue

        # 解析标题  标题: xxx
        if line.startswith("标题:"):
            current_news["title"] = line.replace("标题:", "").strip()
            continue

        # 解析时间  时间: xxx
        if line.startswith("时间:"):
            current_news["pub_time"] = line.replace("时间:", "").strip()
            continue

        # 解析链接  链接: xxx
        if line.startswith("链接:"):
            current_news["url"] = line.replace("链接:", "").strip()
            continue

        # 解析图片  图片: xxx
        if line.startswith("图片:"):
            current_news["img_url"] = line.replace("图片:", "").strip()
            continue

    # 最后一条
    if current_news.get("title") and current_news.get("url") and current_news.get("pub_time"):
        news_items.append(NewsItem(**current_news))

    return news_items


@app.post("/api/crawl")
async def run_crawler(request: CrawlRequest):
    """
    运行热点抓取爬虫
    使用真实新闻源抓取
    """
    try:
        from server.spider import crawl_all

        # 映射平台名称
        platform_map = {
            "wangyi": "wangyi",
            "pengpai": "pengpai",
            "tencent": "tencent"
        }

        platforms = [platform_map.get(p, p) for p in request.platforms]

        # 抓取新闻
        news_data = await crawl_all(platforms, limit=request.limit)

        # 保存到文件
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            for i, news in enumerate(news_data, 1):
                f.write(f"[{i}] {news['source']} - {news['channel']} - {news['category']}\n")
                f.write(f"标题: {news['title']}\n")
                f.write(f"时间: {news['pub_time']}\n")
                f.write(f"链接: {news['url']}\n")
                f.write(f"图片: {news['img_url']}\n")
                f.write("---\n")

        # 转换为NewsItem格式
        news_items = [NewsItem(**n) for n in news_data]

        return {
            "success": True,
            "news": [item.model_dump() for item in news_items],
            "count": len(news_items),
            "stdout": f"成功抓取 {len(news_items)} 条新闻",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "news": []
        }


async def generate_sample_data():
    """生成示例热点新闻数据（当爬虫不可用时）"""
    sample_news = [
        NewsItem(title="人工智能在医疗领域取得重大突破", url="https://example.com/news/1", img_url="", pub_time="2026-04-02", source="网易", category="科技", channel="热点"),
        NewsItem(title="全球芯片短缺问题持续缓解，新能源汽车受影响", url="https://example.com/news/2", img_url="", pub_time="2026-04-02", source="澎湃", category="财经", channel="热点"),
        NewsItem(title="新能源汽车销量再创新高，国产崛起", url="https://example.com/news/3", img_url="", pub_time="2026-04-02", source="腾讯", category="汽车", channel="热点"),
        NewsItem(title="量子计算技术进入实用化阶段，科技新突破", url="https://example.com/news/4", img_url="", pub_time="2026-04-02", source="网易", category="科技", channel="热点"),
        NewsItem(title="国际油价波动对全球经济影响深远", url="https://example.com/news/5", img_url="", pub_time="2026-04-02", source="澎湃", category="财经", channel="热点"),
        NewsItem(title="电商平台推出新政策，扶持中小企业发展", url="https://example.com/news/6", img_url="", pub_time="2026-04-02", source="网易", category="财经", channel="热点"),
        NewsItem(title="5G网络覆盖全国，智慧城市建设加速", url="https://example.com/news/7", img_url="", pub_time="2026-04-02", source="腾讯", category="科技", channel="热点"),
        NewsItem(title="房地产市场调控政策效果显现", url="https://example.com/news/8", img_url="", pub_time="2026-04-02", source="澎湃", category="房产", channel="热点"),
        NewsItem(title="国产芯片技术突破，打破国外垄断", url="https://example.com/news/9", img_url="", pub_time="2026-04-02", source="网易", category="科技", channel="热点"),
        NewsItem(title="跨境电商新机遇，数字化贸易成趋势", url="https://example.com/news/10", img_url="", pub_time="2026-04-02", source="腾讯", category="财经", channel="热点"),
        NewsItem(title="人工智能技术在教育领域广泛应用", url="https://example.com/news/11", img_url="", pub_time="2026-04-02", source="澎湃", category="教育", channel="热点"),
        NewsItem(title="碳中和目标推动新能源产业快速发展", url="https://example.com/news/12", img_url="", pub_time="2026-04-02", source="网易", category="能源", channel="热点"),
        NewsItem(title="元宇宙概念持续火热，科技巨头纷纷布局", url="https://example.com/news/13", img_url="", pub_time="2026-04-02", source="腾讯", category="科技", channel="热点"),
        NewsItem(title="生物医药创新成果频出，健康产业迎新机遇", url="https://example.com/news/14", img_url="", pub_time="2026-04-02", source="澎湃", category="医疗", channel="热点"),
        NewsItem(title="数字货币试点扩大，支付方式变革加速", url="https://example.com/news/15", img_url="", pub_time="2026-04-02", source="网易", category="金融", channel="热点"),
        NewsItem(title="智能制造推动工业升级，传统产业转型", url="https://example.com/news/16", img_url="", pub_time="2026-04-02", source="腾讯", category="工业", channel="热点"),
        NewsItem(title="碳达峰碳中和成为国家重点战略", url="https://example.com/news/17", img_url="", pub_time="2026-04-02", source="澎湃", category="环保", channel="热点"),
        NewsItem(title="自动驾驶技术成熟，智能汽车新时代来临", url="https://example.com/news/18", img_url="", pub_time="2026-04-02", source="网易", category="汽车", channel="热点"),
        NewsItem(title="云计算市场快速增长，企业数字化转型加速", url="https://example.com/news/19", img_url="", pub_time="2026-04-02", source="腾讯", category="科技", channel="热点"),
        NewsItem(title="直播电商成为新零售重要模式", url="https://example.com/news/20", img_url="", pub_time="2026-04-02", source="澎湃", category="电商", channel="热点"),
    ]

    # 保存到数据文件
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for i, news in enumerate(sample_news, 1):
            f.write(f"[{i}] {news.source} - {news.channel} - {news.category}\n")
            f.write(f"标题: {news.title}\n")
            f.write(f"时间: {news.pub_time}\n")
            f.write(f"链接: {news.url}\n")
            f.write(f"图片: {news.img_url}\n")
            f.write("---\n")

    return {
        "success": True,
        "news": [item.model_dump() for item in sample_news],
        "count": len(sample_news),
        "stdout": "使用示例数据（爬虫不可用）",
    }


@app.get("/api/parse")
async def parse_existing():
    """
    解析已有的 hot_news.txt 文件
    （不重新抓取）
    """
    news = parse_hot_news_file(str(OUTPUT_FILE))

    return {
        "success": True,
        "news": [item.model_dump() for item in news],
        "count": len(news),
    }


class KeywordRequest(BaseModel):
    news: List[NewsItem]
    top_k: int = 50
    method: str = "tfidf"  # tfidf 或 textrank


def extract_keywords(news: List[NewsItem], top_k: int = 50, method: str = "tfidf") -> List[dict]:
    """
    从新闻标题中提取关键词
    使用 jieba 的 TF-IDF 或 TextRank 算法
    """
    # 合并所有标题
    titles = [item.title for item in news if item.title]

    if not titles:
        return []

    text = " ".join(titles)

    # 停用词（常见无意义词）
    stop_words = {
        '的', '了', '是', '在', '和', '与', '或', '为', '对', '这', '那', '就', '都',
        '也', '要', '会', '能', '可以', '一个', '我们', '你们', '他们', '她们', '它们',
        '自己', '什么', '这个', '那个', '因为', '所以', '但是', '如果', '虽然', '只是',
        '还有', '没有', '不是', '而是', '而且', '或者', '以及', '关于', '通过', '进行',
        '已经', '正在', '可能', '应该', '需要', '如何', '怎么', '怎样', '为什么', '哪个',
        '哪些', '哪里', '谁', '多少', '很久', '最新', '今日', '昨天', '今天', '去年',
        '今年', '明年', '月', '日', '时', '分', '秒', '/年', '/', '—', '｜', '：', ':',
        '！', '！', '？', '?', '。', '，', '、', '"', '"', ''', ''', '【', '】',
        '[', ']', '(', ')', '（', '）', '.', ',', '!', '?', '<', '>', '{', '}',
    }

    # 使用 jieba 提取关键词
    if method == "textrank":
        keywords = jieba.analyse.textrank(text, topK=top_k, withWeight=True)
    else:
        keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)

    # 过滤停用词和单字
    result = []
    for word, weight in keywords:
        if len(word) >= 2 and word not in stop_words:
            result.append({
                "word": word,
                "weight": round(weight, 4),
            })

    return result


@app.post("/api/keywords")
async def extract_keywords_api(request: KeywordRequest):
    """
    从新闻列表中提取关键词/热词
    """
    keywords = extract_keywords(request.news, request.top_k, request.method)

    return {
        "success": True,
        "keywords": keywords,
        "count": len(keywords),
    }


@app.get("/api/status")
async def status():
    """检查服务状态"""
    spider_path = SPIDER_DIR / "run.py"

    return {
        "status": "ok",
        "spider_exists": spider_path.exists(),
        "output_exists": OUTPUT_FILE.exists(),
        "data_dir": str(DATA_DIR),
        "spider_dir": str(SPIDER_DIR),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
