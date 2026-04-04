"""
Hot News Workflow - FastAPI 后端服务
对接现有 hot_news_spider 爬虫
"""
import subprocess
import re
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from collections import Counter

# 确保 server 目录在 Python 路径中
sys.path.insert(0, str(Path(__file__).parent))

import jieba
import jieba.analyse
import yake
import requests

# 加载 AI 赛道用户词典（提升专有名词识别准确性）
_USER_DICT = Path(__file__).parent / "ai_dict.txt"
if _USER_DICT.exists():
    jieba.load_userdict(str(_USER_DICT))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Hot News Workflow API")

# CORS - 允许本地开发端口
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
        "http://localhost:5176", "http://localhost:5177", "http://localhost:5178",
        "http://localhost:5179",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175",
        "http://127.0.0.1:5176", "http://127.0.0.1:5177", "http://127.0.0.1:5178",
        "http://127.0.0.1:5179",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
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
        from spider import crawl_all

        # 映射平台名称
        platform_map = {
            "wangyi": "wangyi",
            "pengpai": "pengpai",
            "tencent": "tencent"
        }

        platforms = [platform_map.get(p, p) for p in request.platforms]

        # 抓取新闻（返回数据和平台统计）
        news_data, platform_stats = await crawl_all(platforms, limit=request.limit)

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

        # 构建平台结果摘要
        platform_results = []
        for p in request.platforms:
            key = platform_map.get(p, p)
            count = platform_stats.get(key, 0)
            platform_results.append({
                "platform": p,
                "count": count,
                "success": count > 0
            })

        return {
            "success": True,
            "news": [item.model_dump() for item in news_items],
            "count": len(news_items),
            "platformResults": platform_results,
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
    method: str = "phrase"  # tfidf / textrank / phrase


class ContentGenerateRequest(BaseModel):
    keywords: List[dict]  # 选中的热词（包含 source_news）
    news_titles: List[str] = []  # 相关新闻标题（可选，用于参考）
    style: str = "科普向"  # 科普向 / 观点向 / 教程向 / 测评向
    api_type: str = "deepseek"  # deepseek / openai / claude
    api_key: Optional[str] = None
    api_base: Optional[str] = None


# 通用词过滤列表（新闻高频但对内容生成价值低）
GENERIC_NEWS_TERMS = {
    # 国际/政治人物（太通用）
    '特朗普', '拜登', '普京', '奥巴马', '习近平', '李克强', '默克尔', '马克龙',
    '伊朗', '俄罗斯', '美国', '中国', '日本', '韩国', '朝鲜', '乌克兰', '以色列',
    '联合国', '北约', '欧盟', '外交部', '克里姆林宫', '白宫', '国会', '参议院', '众议院',
    # 时间词
    '今日', '昨天', '今天', '明日', '去年', '今年', '明年', '本周', '上周', '下周',
    '凌晨', '傍晚', '上午', '下午', '晚上', '早些时候', '日前', '近日', '目前',
    # 媒体惯用词
    '报道', '据悉', '消息', '回应', '表示', '称', '认为', '指出', '强调', '声称',
    '最新', '首个', '首次', '第一', '主要', '重要', '重大', '紧急', '突发',
    # 数量词
    '一个', '几个', '多个', '一名', '两人', '多人', '首次', '第一次', '第二届',
    # 地名（太泛）
    '北京', '上海', '广州', '深圳', '香港', '澳门', '台湾', '成都', '武汉', '西安',
    # 机构（太泛）
    '公司', '企业', '集团', '医院', '学校', '大学', '医院', '警方', '法院', '检察院',
}

# 停用词（常见无意义词）
STOP_WORDS = {
    '的', '了', '是', '在', '和', '与', '或', '为', '对', '这', '那', '就', '都',
    '也', '要', '会', '能', '可以', '我们', '你们', '他们', '她们', '它们',
    '自己', '什么', '这个', '那个', '因为', '所以', '但是', '如果', '虽然', '只是',
    '还有', '没有', '不是', '而是', '而且', '或者', '以及', '关于', '通过', '进行',
    '已经', '正在', '可能', '应该', '需要', '如何', '怎么', '怎样', '为什么', '哪个',
    '哪些', '哪里', '谁', '多少', '很久',
    '月', '日', '时', '分', '秒', '/年', '/', '—', '｜', '：', ':',
    '！', '？', '。', '，', '、', '"', '"', ''', ''', '【', '】',
    '[', ']', '(', ')', '（', '）', '.', ',', '!', '?', '<', '>', '{', '}',
    '一下', '一点', '一些', '一直', '一定', '一起', '一般', '一样', '一方面', '另一方面',
}


def extract_keywords(news: List[NewsItem], top_k: int = 50, method: str = "phrase") -> List[dict]:
    """
    从新闻标题中提取关键词/关键短语
    支持三种模式:
    - tfidf: jieba TF-IDF 关键词
    - textrank: jieba TextRank 关键词
    - phrase: YAKE 关键短语（推荐，对内容生成最有价值）
    """
    # 合并所有标题
    titles = [item.title for item in news if item.title]

    if not titles:
        return []

    text = " ".join(titles)

    # 短语提取模式（推荐）
    if method == "phrase":
        return extract_phrases_yake(titles, top_k)

    # 基于词的提取（tfidf/textrank）
    if method == "textrank":
        keywords = jieba.analyse.textrank(text, topK=top_k * 2, withWeight=True)
    else:
        keywords = jieba.analyse.extract_tags(text, topK=top_k * 2, withWeight=True)

    result = []
    for word, weight in keywords:
        # 过滤
        if len(word) >= 2 and word not in STOP_WORDS and word not in GENERIC_NEWS_TERMS:
            result.append({
                "word": word,
                "weight": round(weight, 4),
                "type": "word"
            })

    # 去重（同义词归一化简单处理）
    seen = set()
    unique_result = []
    for item in result:
        # 简单去重：跳过包含相同2字符的项
        is_dup = False
        for seen_item in seen:
            if len(item["word"]) >= 3 and len(seen_item) >= 3:
                if item["word"][:2] == seen_item[:2]:
                    is_dup = True
                    break
        if not is_dup:
            unique_result.append(item)
            seen.add(item["word"])

    return unique_result[:top_k]


def preprocess_for_yake(text: str) -> str:
    """
    jieba 分词预处理，解决 YAKE 中文分词差的问题

    思路：用 jieba 做中文分词（它擅长这个），然后用空格拼接分词结果
    喂给 YAKE（它擅长多词短语排序和去重）。
    中文标点替换为句号，作为 YAKE 的句子边界，防止跨标点组合短语。
    """
    words = jieba.lcut(text)
    segments = []
    for w in words:
        w = w.strip()
        if not w:
            continue
        # 中英文标点 → 句子边界（YAKE 用句号分割短语范围）
        if re.match(r'^[，。？！、；：""''【】《》（）\[\]{}+…—\-·,.?!;:%]+$', w):
            segments.append('.')
        else:
            segments.append(w)
    processed_text = ' '.join(segments)
    processed_text = re.sub(r'\s+', ' ', processed_text).strip()
    return processed_text


def is_valid_keyphrase(word: str) -> bool:
    """
    过滤规则：过滤低质量短语
    """
    # 1. 过滤纯数字/版本号
    if re.match(r'^[\d.%]+$', word):
        return False
    # 2. 过滤过长的短语（>15字大概率是垃圾）
    if len(word) > 15:
        return False
    # 3. 过滤以停用词开头/结尾的短语
    for sw in ['的', '了', '是', '在', '将', '其', '把', '被']:
        if word.startswith(sw) or word.endswith(sw):
            return False
    # 4. 过滤包含残留标点的短语（标点粘连是 YAKE 提取失败的特征）
    if re.search(r'[，。？！、；：""''【】《》（）\[\]{}]', word):
        return False
    return True


def _is_chinese(text: str) -> bool:
    """判断文本是否包含中文（用于语言分流）"""
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def extract_phrases_yake(titles: List[str], top_k: int = 50) -> List[dict]:
    """使用 YAKE 提取关键短语"""
    # P2.4.5b: 中英文分流处理，避免 jieba 切碎英文
    kw_extractor_zh = yake.KeywordExtractor(lan="zh", n=3, dedupLim=0.7, dedupFunc="seqm", windowsSize=1, top=top_k*2, features=None)
    kw_extractor_en = yake.KeywordExtractor(lan="en", n=3, dedupLim=0.7, dedupFunc="seqm", windowsSize=1, top=top_k*2, features=None)
    all_keywords: list[tuple[str, float, set[str]]] = []
    for title in titles:
        if not title:
            continue
        # P2.4.5b: 中文用 jieba+YAKE，英文直接用 YAKE en
        if _is_chinese(title):
            keywords = kw_extractor_zh.extract_keywords(preprocess_for_yake(title))
        else:
            keywords = kw_extractor_en.extract_keywords(title)
        for word, score in keywords:
            all_keywords.append((word.strip(), score, {title}))

    # 按得分排序（YAKE 得分越低越好）
    all_keywords.sort(key=lambda x: x[1])

    # 过滤并去重（同时收集来源标题）
    # P2.4.5a: seen 存 (score, sources, full_word)，去重 key 前3字符，输出 full_word
    seen: dict[str, tuple[float, set[str], str]] = {}
    for word, score, sources in all_keywords:
        if word in STOP_WORDS:
            continue
        if word in GENERIC_NEWS_TERMS:
            continue
        if not is_valid_keyphrase(word):
            continue

        # P2.4.5d: 最短长度过滤 — 英文 ≥4，中文 ≥2
        has_chinese = bool(re.search(r'[\u4e00-\u9fff]', word))
        if has_chinese:
            if len(word) < 2:
                continue
        else:
            if len(word) < 4:
                continue

        # 简短去重 key（前3字符），保留完整词
        dedup_key = word[:3] if len(word) >= 3 else word

        # 过滤包含通用词的短语
        is_filtered = False
        for generic in GENERIC_NEWS_TERMS:
            if generic in word and len(word) < len(generic) + 2:
                is_filtered = True
                break
        if is_filtered:
            continue

        if dedup_key in seen:
            old_score, old_sources, old_word = seen[dedup_key]
            if score < old_score:
                seen[dedup_key] = (score, old_sources | sources, word)
            else:
                seen[dedup_key] = (old_score, old_sources | sources, old_word)
        else:
            seen[dedup_key] = (score, sources, word)

    # 构建结果
    result = []
    for dedup_key, (score, sources, word) in seen.items():
        # YAKE 得分转权重（得分越低权重越高）
        weight = max(0.1, round(1.0 / (score + 0.1), 4))
        result.append({
            "word": word,
            "weight": weight,
            "type": "phrase" if len(word) >= 4 else "word",
            "score": round(score, 4),
            "source_news": list(sources)[:5],
        })

    result.sort(key=lambda x: x["weight"], reverse=True)
    return result[:top_k]


# AI 供应商配置
AI_PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "key_env": "DEEPSEEK_API_KEY",
    },
    "minimax": {
        "base_url": "https://api.minimaxi.com/v1",
        "model": "MiniMax-Text-01",
        "key_env": "MINIMAX_API_KEY",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
        "key_env": "OPENAI_API_KEY",
    },
    "claude": {
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-sonnet-4-20250514",
        "key_env": "ANTHROPIC_API_KEY",
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
        "key_env": "ZHIPU_API_KEY",
    },
}

@app.post("/api/generate", response_model=dict)
async def generate_content(request: ContentGenerateRequest):
    """AI 内容生成"""
    try:
        # 确定 API Key 来源
        api_key = request.api_key or os.environ.get("DEEPSEEK_API_KEY", "")
        provider = AI_PROVIDERS.get(request.api_type, AI_PROVIDERS["deepseek"])
        base_url = request.api_base or provider["base_url"]
        model = provider["model"]

        if not api_key:
            return {"success": False, "error": "请提供 API Key"}

        # 构建 prompt
        keywords_str = "、".join([k.get("word", k) if isinstance(k, dict) else str(k) for k in request.keywords[:10]])
        style = request.style or "科普向"

        news_context_block = ""
        if request.news_titles:
            news_context_block = "相关热点：\n" + "\n".join(request.news_titles[:5])

        prompt_parts = [
            "你是一个专业的小红书内容创作者，擅长写吸引人的 AI 赛道种草文案。",
            f"风格要求：{style}",
            f"关键词：{keywords_str}",
        ]
        if news_context_block:
            prompt_parts.append(news_context_block)
        prompt_parts.append("""请按以下格式生成内容：

## 标题
1. [标题1]
2. [标题2]
3. [标题3]

## 正文
[正文内容，800-1500字，使用 emoji，适当分段]

## 推荐标签
[标签1] [标签2] [标签3] [标签4] [标签5] [标签6] [标签7] [标签8]
""")
        prompt = "\n".join(prompt_parts)

        result = call_openai_compatible_api(api_key, base_url, model, prompt)
        if "error" in result:
            return {"success": False, "error": result["error"]}

        draft = result.get("content", "")
        parsed = parse_draft_structured(draft)

        # 保存草稿到数据库
        try:
            from db import save_draft as db_save_draft
            keywords_list = [k.get("word", k) if isinstance(k, dict) else str(k) for k in request.keywords]
            draft_id = db_save_draft(
                keywords=keywords_list,
                titles=parsed.get("titles", []),
                body=parsed.get("body", ""),
                tags=parsed.get("tags", []),
                style=style,
            )
        except Exception:
            pass  # 草稿保存失败不影响返回

        return {
            "success": True,
            "draft": draft,
            "titles": parsed.get("titles", []),
            "body": parsed.get("body", ""),
            "tags": parsed.get("tags", []),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}



class GlobalSettingsRequest(BaseModel):
    provider: str = "deepseek"
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None


@app.get("/api/settings", response_model=dict)
async def get_settings():
    """获取全局 AI 设置"""
    try:
        from db import get_global_settings
        settings = get_global_settings()
        return {"success": True, "settings": settings}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/settings", response_model=dict)
async def save_settings(request: GlobalSettingsRequest):
    """保存全局 AI 设置"""
    try:
        from db import save_global_settings
        save_global_settings(
            provider=request.provider,
            api_key=request.api_key,
            api_base=request.api_base,
            model=request.model,
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def parse_draft_structured(draft: str) -> dict:
    """解析草稿文本为结构化数据"""
    if not draft:
        return {"titles": [], "body": "", "tags": []}

    titles = []
    # 匹配 "1. 标题" 或 "标题1" 格式
    title_section_match = draft.find("## 标题")
    if title_section_match >= 0:
        title_section = draft[title_section_match:]
        # 匹配 "1. xxx" 或 "2. xxx" 格式
        for line in title_section.split("\n"):
            line = line.strip()
            m = re.match(r"^\d+[.、]\s*(.+)", line)
            if m:
                titles.append(m.group(1).strip())
            elif line.startswith("#"):
                continue  # 跳过 markdown 标题
            elif line and not line.startswith("[") and len(line) < 40 and len(line) > 3:
                # 可能是无序号的标题
                if not any(c in line for c in "[]（）【】()"):
                    titles.append(line.strip())
    # 去重
    titles = list(dict.fromkeys(titles))[:3]

    body = ""
    body_match = re.search(r"## 正文\n([\s\S]+?)(?=##|\Z)", draft)
    if body_match:
        body = body_match.group(1).strip()

    tags = []
    tag_match = re.search(r"## 推荐标签\n?([\s\S]+?)$", draft)
    if tag_match:
        tag_section = tag_match.group(1)
        # 匹配 [标签] 或 #标签 或纯词语
        for m in re.findall(r"\[([^\]\n]+)\]|#([^\s#\n]+)|([^\s#\n\[\]]+)", tag_section):
            tag = m[0] or m[1] or m[2]
            tag = tag.strip()
            if tag and len(tag) > 1 and len(tag) < 15 and not re.match(r"^[0-9.]+$", tag):
                tags.append(tag)
    tags = list(dict.fromkeys(tags))[:8]

    return {"titles": titles, "body": body, "tags": tags}


def call_openai_compatible_api(api_key: str, base_url: str, model: str, prompt: str) -> dict:
    """调用 OpenAI 兼容格式的 API（DeepSeek/Minimax/通义等）"""
    try:
        url = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 2000,
        }

        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        return {"content": content}

    except requests.exceptions.Timeout:
        return {"error": "API 请求超时，请重试"}
    except requests.exceptions.RequestException as e:
        return {"error": f"API 请求失败: {str(e)}"}
    except Exception as e:
        return {"error": f"生成失败: {str(e)}"}


# ==================== 草稿管理 API ====================

from pydantic import BaseModel
from typing import List, Optional


class DraftSaveRequest(BaseModel):
    keywords: List[str]
    titles: List[str]
    body: str
    tags: List[str]
    style: str


class DraftResponse(BaseModel):
    id: int
    created_at: str
    keywords: str
    titles: str
    body: str
    tags: str
    style: str


@app.post("/api/drafts")
async def save_draft(request: DraftSaveRequest):
    """保存草稿到数据库"""
    try:
        from db import save_draft
        draft_id = save_draft(
            keywords=request.keywords,
            titles=request.titles,
            body=request.body,
            tags=request.tags,
            style=request.style
        )
        return {"success": True, "id": draft_id}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/drafts")
async def list_drafts(limit: int = Query(50, ge=1, le=500)):
    """获取草稿列表"""
    try:
        from db import get_drafts
        drafts = get_drafts(limit=limit)
        # 解析 JSON 字段
        for d in drafts:
            d["keywords"] = json.loads(d["keywords"])
            d["titles"] = json.loads(d["titles"])
            d["tags"] = json.loads(d["tags"])
        return {"drafts": drafts}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/drafts/{draft_id}")
async def get_draft(draft_id: int):
    """获取单个草稿"""
    try:
        from db import get_draft as db_get_draft
        draft = db_get_draft(draft_id)
        if not draft:
            return {"error": "草稿不存在"}
        draft["keywords"] = json.loads(draft["keywords"])
        draft["titles"] = json.loads(draft["titles"])
        draft["tags"] = json.loads(draft["tags"])
        return draft
    except Exception as e:
        return {"error": str(e)}


@app.delete("/api/drafts/{draft_id}")
async def delete_draft(draft_id: int):
    """删除草稿"""
    try:
        from db import delete_draft as db_delete_draft
        deleted = db_delete_draft(draft_id)
        return {"success": deleted}
    except Exception as e:
        return {"error": str(e)}


# ==================== 抓取历史 API ====================

@app.get("/api/crawl/history")
async def list_crawl_history(limit: int = Query(30, ge=1, le=500)):
    """获取抓取历史"""
    try:
        from db import get_crawl_history
        history = get_crawl_history(limit=limit)
        for h in history:
            h["news_data"] = json.loads(h["news_data"])
        return {"history": history}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/crawl/history")
async def save_crawl_history(platform: str, news_count: int, news_data: List[dict]):
    """保存抓取历史"""
    try:
        from db import save_crawl_history as db_save_history
        history_id = db_save_history(platform, news_count, news_data)
        return {"success": True, "id": history_id}
    except Exception as e:
        return {"error": str(e)}


# ==================== 关键词趋势 API ====================

class KeywordTrendRequest(BaseModel):
    keywords: List[dict]
    source: str = "crawl"


@app.post("/api/keywords/trend")
async def save_keyword_trends(request: KeywordTrendRequest):
    """保存关键词趋势快照（每日调用）"""
    try:
        from db import save_keyword_trends as db_save_trends
        saved = db_save_trends(request.keywords, request.source)
        return {"success": True, "saved": saved}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/keywords/trend")
async def get_keyword_trends(keywords: str = None, days: int = Query(7, ge=1, le=90)):
    """获取关键词趋势数据

    Query params:
        keywords: 逗号分隔的关键词列表，如 "AI,大模型,ChatGPT"
        days: 查询天数，默认7天
    """
    try:
        from db import get_keyword_trends as db_get_trends
        kw_list = [k.strip() for k in keywords.split(",")] if keywords else None
        trends = db_get_trends(kw_list, days)
        return {"success": True, "trends": trends, "days": days}
    except Exception as e:
        return {"error": str(e)}


# ==================== 内容效果记录 API ====================

class ContentRecordRequest(BaseModel):
    draft_id: Optional[str] = None
    draft_title: Optional[str] = None
    keywords: List[str] = []
    style: str = ""
    published_at: str = ""
    platform: str = "小红书"
    likes: int = Field(0, ge=0, le=999999)
    collects: int = Field(0, ge=0, le=999999)
    comments: int = Field(0, ge=0, le=999999)
    shares: int = Field(0, ge=0, le=999999)
    notes: str = Field("", max_length=1000)


@app.post("/api/content-records")
async def save_content_record_api(request: ContentRecordRequest):
    """保存内容效果记录"""
    try:
        from db import save_content_record as db_save
        record_id = db_save(
            draft_id=request.draft_id,
            draft_title=request.draft_title,
            keywords=request.keywords,
            style=request.style,
            published_at=request.published_at,
            platform=request.platform,
            likes=request.likes,
            collects=request.collects,
            comments=request.comments,
            shares=request.shares,
            notes=request.notes,
        )
        return {"success": True, "id": record_id}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/content-records")
async def list_content_records(limit: int = Query(50, ge=1, le=500)):
    """获取内容效果记录列表"""
    try:
        from db import get_content_records as db_get
        records = db_get(limit)
        # JSON 解析
        for r in records:
            if r.get("keywords"):
                r["keywords"] = json.loads(r["keywords"])
        return {"success": True, "records": records}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/content-records/{record_id}")
async def get_content_record_api(record_id: int):
    """获取单条内容效果记录"""
    try:
        from db import get_content_record as db_get
        record = db_get(record_id)
        if not record:
            return {"error": "记录不存在"}
        if record.get("keywords"):
            record["keywords"] = json.loads(record["keywords"])
        return {"success": True, "record": record}
    except Exception as e:
        return {"error": str(e)}


@app.delete("/api/content-records/{record_id}")
async def delete_content_record_api(record_id: int):
    """删除内容效果记录"""
    try:
        from db import delete_content_record as db_delete
        deleted = db_delete(record_id)
        return {"success": deleted}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/content-records/stats/summary")
async def get_content_stats():
    """获取内容效果统计"""
    try:
        from db import get_content_stats as db_stats
        stats = db_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        return {"error": str(e)}


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
