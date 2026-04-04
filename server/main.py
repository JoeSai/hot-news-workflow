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
import yake
import requests

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
    keywords: List[str]  # 选中的热词
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


def extract_phrases_yake(titles: List[str], top_k: int = 50) -> List[dict]:
    """
    使用 YAKE 提取关键短语
    YAKE 能提取多词短语，对内容生成更有价值
    """
    # 初始化 YAKE（中文）
    kw_extractor = yake.KeywordExtractor(
        lan="zh",           # 中文
        n=3,                # 短语长度 1-3
        dedupLim=0.7,       # 去重阈值（相似短语会被过滤）
        dedupFunc="seqm",   # 字符串匹配去重
        windowsSize=1,
        top=top_k * 2,      # 先提取更多，后面过滤
        features=None,
    )

    # 对每条标题单独提取，再合并
    all_keywords = []
    for title in titles:
        if not title:
            continue
        # YAKE 对短文本效果更好
        keywords = kw_extractor.extract_keywords(title)
        all_keywords.extend(keywords)

    # 按得分排序（YAKE 得分越低越好）
    all_keywords.sort(key=lambda x: x[1])

    # 过滤并去重
    seen = set()
    result = []
    for word, score in all_keywords:
        word = word.strip()

        # 基本过滤
        if len(word) < 2:
            continue
        if word in STOP_WORDS:
            continue
        if word in GENERIC_NEWS_TERMS:
            continue

        # 简短去重
        key = word[:3] if len(word) >= 3 else word
        if key in seen:
            continue

        # 过滤包含通用词的短语
        is_filtered = False
        for generic in GENERIC_NEWS_TERMS:
            if generic in word and len(word) < len(generic) + 2:
                is_filtered = True
                break
        if is_filtered:
            continue

        seen.add(key)
        # YAKE 得分转权重（得分越低权重越高）
        weight = max(0.1, round(1.0 / (score + 0.1), 4))
        result.append({
            "word": word,
            "weight": weight,
            "type": "phrase" if len(word) >= 4 else "word",
            "score": round(score, 4)
        })

        if len(result) >= top_k:
            break

    # 按权重排序
    result.sort(key=lambda x: x["weight"], reverse=True)
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


# 内容风格配置
CONTENT_STYLES = {
    "科普向": "以科普的角度，用通俗易懂的语言介绍这个话题，适合新手入门",
    "观点向": "表达对这个话题的独特观点和看法，有态度有立场，引发讨论",
    "教程向": "以教程的形式，手把手教读者了解/使用这个话题相关的技能或工具",
    "测评向": "对比评测同类产品或服务，给出选购建议和使用体验",
}

# API 配置
API_CONFIGS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "default_key_env": "DEEPSEEK_API_KEY",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
        "default_key_env": "OPENAI_API_KEY",
    },
    "claude": {
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-3-haiku-20240307",
        "default_key_env": "CLAUDE_API_KEY",
    },
    "minimax": {
        "base_url": "https://api.minimax.chat/v1",
        "model": "MiniMax-M2.7",
        "default_key_env": "MINIMAX_API_KEY",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "default_key_env": "DASHSCOPE_API_KEY",
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
        "default_key_env": "ZHIPU_API_KEY",
    },
}


@app.post("/api/generate")
async def generate_content(request: ContentGenerateRequest):
    """
    AI 内容生成接口
    根据热词生成小红书风格内容草稿
    """
    # Debug log
    print(f"[DEBUG] Received request: api_type={request.api_type}, has_key={'Yes' if request.api_key else 'No'}")
    try:
        keywords_str = "、".join(request.keywords)
        style_desc = CONTENT_STYLES.get(request.style, CONTENT_STYLES["科普向"])

        # 构建新闻参考上下文
        news_context = ""
        if request.news_titles:
            news_context = "\n".join([f"- {t}" for t in request.news_titles[:5]])
            news_context = f"\n\n参考新闻标题：\n{news_context}"

        # 构造 prompt
        prompt = f"""你是一个专业的小红书科技博主，擅长写吸引人的AI科技内容。

请根据以下热词生成一篇小红书风格的内容草稿：

热词：{keywords_str}
内容风格：{style_desc}
{news_context}

请生成以下内容：

## 标题（3个备选）
[标题1]
[标题2]
[标题3]

## 正文
[正文字数建议300-600字，分段清晰，带emoji，带适当话题标签]

## 推荐标签（5-8个）
[标签1] [标签2] [标签3] ...

---
⚠️ 注意：这是AI辅助生成的草稿，请根据实际情况修改后使用。</verbar>"""

        # 获取 API 配置
        api_config = API_CONFIGS.get(request.api_type, API_CONFIGS["deepseek"])

        # 获取 API key
        api_key = request.api_key or os.environ.get(api_config["default_key_env"], "")
        if not api_key:
            return {
                "success": False,
                "error": f"请配置 {request.api_type} API Key",
                "draft": None,
            }

        # 调用 AI API（统一使用 OpenAI 兼容格式）
        result = call_openai_compatible_api(
            api_key,
            api_config["base_url"],
            api_config["model"],
            prompt
        )

        if result.get("error"):
            return {
                "success": False,
                "error": result["error"],
                "draft": None,
            }

        return {
            "success": True,
            "draft": result.get("content", ""),
            "model": api_config["model"],
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "draft": None,
        }


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
