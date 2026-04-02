"""
Hot News Workflow - FastAPI 后端服务
对接现有 hot_news_spider 爬虫
"""
import subprocess
import re
import json
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
    调用现有的 hot_news_spider/run.py
    """
    # 爬虫项目路径 - 使用绝对路径
    SPIDER_DIR = Path(r"C:\Users\admin\Desktop\hot_news_spider")
    spider_path = SPIDER_DIR / "run.py"
    output_path = SPIDER_DIR / "hot_news.txt"

    # 确保路径存在
    if not spider_path.exists():
        return {
            "success": False,
            "error": f"爬虫文件不存在: {spider_path}",
            "news": []
        }

    try:
        # 运行爬虫
        result = subprocess.run(
            ["python", str(spider_path)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(spider_path.parent)
        )

        # 解析输出文件
        news = parse_hot_news_file(str(output_path))

        return {
            "success": True,
            "news": [item.model_dump() for item in news],
            "count": len(news),
            "stdout": result.stdout[-500:] if result.stdout else "",
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "爬虫运行超时",
            "news": []
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "news": []
        }


@app.get("/api/parse")
async def parse_existing():
    """
    解析已有的 hot_news.txt 文件
    （不重新抓取）
    """
    SPIDER_DIR = Path(r"C:\Users\admin\Desktop\hot_news_spider")
    output_path = SPIDER_DIR / "hot_news.txt"
    news = parse_hot_news_file(str(output_path))

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
    SPIDER_DIR = Path(r"C:\Users\admin\Desktop\hot_news_spider")
    spider_path = SPIDER_DIR / "run.py"
    output_path = SPIDER_DIR / "hot_news.txt"

    return {
        "status": "ok",
        "spider_exists": spider_path.exists(),
        "output_exists": output_path.exists(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
