#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
热点新闻爬虫 - 整合版 v3
整合网易、澎湃、腾讯、搜狐、IT之家、新浪、中国日报、微博、知乎等
支持新闻列表抓取和文章详情抓取
新增防封策略：随机UA、请求间隔、退避重试
"""
import asyncio
import json
import re
import time
import ast
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlparse, parse_qs, quote
from collections import Counter

import requests
from lxml import etree


# User-Agent 轮换池
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

# 随机延迟范围（秒）
MIN_DELAY = 2
MAX_DELAY = 5


def random_delay():
    """随机延迟，避免被识别为爬虫"""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


def get_random_ua():
    """获取随机 User-Agent"""
    return random.choice(USER_AGENTS)


class BaseSpider:
    """爬虫基类"""
    source_name = "Unknown"

    def __init__(self):
        self.headers = {
            "User-Agent": get_random_ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }

    def request(self, method="GET", url=None, params=None, data=None, json=None, timeout=15, retry=3, headers=None):
        """同步请求（带重试和退避）"""
        request_headers = headers or self.headers
        for attempt in range(retry):
            try:
                # 每次请求使用不同的 User-Agent
                request_headers = {**request_headers, "User-Agent": get_random_ua()}

                response = requests.request(
                    method=method,
                    url=url,
                    headers=request_headers,
                    params=params,
                    data=data,
                    json=json,
                    timeout=timeout,
                )

                # 429 Too Many Requests 或 5xx 错误时退避
                if response.status_code == 429:
                    wait_time = (attempt + 1) * 10  # 10, 20, 30 秒
                    print(f"  请求过于频繁，等待 {wait_time} 秒...")
                    time.sleep(wait_time)
                    continue

                response.raise_for_status()
                return response

            except Exception as e:
                if attempt == retry - 1:
                    raise e
                # 指数退避：2, 4, 8 秒
                backoff = 2 ** (attempt + 1)
                print(f"  请求失败，{backoff} 秒后重试...")
                time.sleep(backoff)

    def extract_article_content(self, html: etree._Element, xpath_rules: Dict) -> Tuple[str, List[str]]:
        """通用文章内容提取

        Args:
            html: HTML 解析后的元素
            xpath_rules: XPath 规则字典

        Returns:
            (article_text, image_urls)
        """
        article_info = ""
        img_list = []

        # 提取正文段落
        paragraphs = html.xpath(xpath_rules.get("paragraphs", '//article//p | //div[@class="article-content"]//p'))
        for p in paragraphs:
            # 提取图片
            imgs = p.xpath('.//img/@src | .//img/@data-src | .//img/@data-original')
            for img in imgs:
                if img and self._is_valid_image_url(img):
                    img_list.append(self._fix_image_url(img))

            # 提取文本
            texts = p.xpath('.//text()')
            text = ''.join([t.strip() for t in texts if t.strip()])
            if text:
                article_info += text + "\n"

        # 提取标题
        title = ""
        title_xpaths = xpath_rules.get("title", '//h1//text() | //h2//text() | //title/text()')
        title_elements = html.xpath(title_xpaths)
        if title_elements:
            title = title_elements[0].strip() if isinstance(title_elements[0], str) else ""

        return article_info.strip(), img_list

    def _is_valid_image_url(self, url: str) -> bool:
        """检查是否是有效的图片URL"""
        if not url or len(url) < 10:
            return False
        invalid_patterns = ['data:image', 'logo', 'avatar', 'icon', '1x1', 'pixel']
        return not any(p in url.lower() for p in invalid_patterns)

    def _fix_image_url(self, url: str) -> str:
        """修复相对URL为绝对URL"""
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            parsed = urlparse(self.current_url if hasattr(self, 'current_url') else "")
            return f"{parsed.scheme}://{parsed.netloc}{url}"
        return url


class WangYiSpider(BaseSpider):
    """网易新闻爬虫"""
    source_name = "网易"

    category_list = [
        {"name": "时事热点", "code": "https://news.163.com/special/cm_yaowen20200213/?callback=data_callback", "classify": "时事热点"},
        {"name": "军事", "code": "https://news.163.com/special/cm_war/?callback=data_callback", "classify": "军事"},
        {"name": "社会", "code": "https://news.163.com/special/cm_guonei/?callback=data_callback", "classify": "社会"},
        {"name": "科技", "code": "https://tech.163.com/special/00097UHL/tech_datalist.js?callback=data_callback", "classify": "科技"},
        {"name": "财经", "code": "https://money.163.com/special/00259K2L/data_stock_redian.js?callback=data_callback", "classify": "财经"},
        {"name": "娱乐", "code": "https://ent.163.com/special/000381Q1/newsdata_movieidx.js?callback=data_callback", "classify": "娱乐"},
        {"name": "教育", "code": "https://edu.163.com/special/002987KB/newsdata_edu_hot.js?callback=data_callback", "classify": "教育"},
        {"name": "生活", "code": "https://baby.163.com/special/003687OS/newsdata_hot.js?callback=data_callback", "classify": "生活"},
    ]

    def get_news_list(self, limit=20) -> List[Dict]:
        all_news = []
        for cat in self.category_list:
            try:
                url = cat["code"]
                response = self.request(url=url, params={"callback": "data_callback"})
                res = response.text.replace("data_callback(", "")[0:-1]
                data_str = json.loads(res.rstrip(",\n ]").strip() + "]")

                for item in data_str[:limit // 2]:
                    if "video" not in item.get("docurl", "") and item.get("title"):
                        try:
                            pub_time = datetime.strptime(item["time"], "%m/%d/%Y %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
                        except:
                            pub_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                        all_news.append({
                            "title": item["title"],
                            "url": item["docurl"],
                            "img_url": item.get("imgurl", ""),
                            "pub_time": pub_time,
                            "source": self.source_name,
                            "category": cat["classify"],
                            "channel": cat["name"]
                        })
                time.sleep(0.3)
            except Exception as e:
                print(f"网易 {cat['name']} 获取失败: {e}")

        seen = set()
        unique_news = []
        for n in all_news:
            if n["url"] not in seen:
                seen.add(n["url"])
                unique_news.append(n)

        return unique_news[:limit]

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取网易新闻详情"""
        if "video" in item.get("url", ""):
            return None

        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            html = etree.HTML(response.text)

            # 提取时间
            date_str = item.get("pub_time", "")
            try:
                time_elem = html.xpath('//*[@class="post_time_source"]/text() | //*[@id="contain"]/div[2]/div[2]/text()')
                if time_elem:
                    date_str = time_elem[0].strip().replace("　来源:", "").replace("来源:", "")
                    match = re.search(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", date_str)
                    if match:
                        date_str = match.group()
                    else:
                        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            except:
                pass

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="content"]//p | //*[@class="article"]//p',
                "title": '//*[@id="contain"]/div[2]/h1//text() | //h1//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": date_str,
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取网易详情失败: {e}")
        return None


class PengPaiSpider(BaseSpider):
    """澎湃新闻爬虫"""
    source_name = "澎湃"
    headers = {
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "client-type": "1",
        "content-type": "application/json",
        "origin": "https://www.thepaper.cn",
        "referer": "https://www.thepaper.cn/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    category_list = [
        {"name": "舆论场", "code": "25489", "classify": "社会"},
        {"name": "中国政库", "code": "25950", "classify": "时政"},
        {"name": "打虎记", "code": "25948", "classify": "时政"},
    ]

    def get_news_list(self, limit=20) -> List[Dict]:
        all_news = []
        timestamp_ms = int(time.time() * 1000)

        for cat in self.category_list:
            try:
                json_data = {
                    "nodeId": cat["code"],
                    "excludeContIds": [],
                    "pageSize": 20,
                    "startTime": timestamp_ms,
                    "pageNum": 1,
                }

                response = self.request(
                    method="POST",
                    url="https://api.thepaper.cn/contentapi/nodeCont/getByNodeIdPortal",
                    json=json_data,
                )

                items = response.json().get("data", {}).get("list", [])

                for item in items[:limit // 2]:
                    if item.get("link"):
                        continue

                    pub_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(item.get("pubTimeLong", 0) / 1000))
                    all_news.append({
                        "title": item.get("name", ""),
                        "url": f"https://www.thepaper.cn/newsDetail_forward_{quote(item.get('contId', ''))}",
                        "img_url": item.get("pic", ""),
                        "pub_time": pub_time,
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"澎湃 {cat['name']} 获取失败: {e}")

        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取澎湃新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            html = etree.HTML(response.text)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="__next"]//p | //article//p | //*[@class="article-content"]//p',
                "title": '//h1//text() | //*[@class="tittleINFO"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取澎湃详情失败: {e}")
        return None


class TengXunSpider(BaseSpider):
    """腾讯新闻爬虫"""
    source_name = "腾讯"

    category_list = [
        {"name": "科技", "code": "news_news_tech", "classify": "科技"},
        {"name": "财经", "code": "news_news_finance", "classify": "财经"},
        {"name": "娱乐", "code": "news_news_ent", "classify": "娱乐"},
        {"name": "国际", "code": "news_news_world", "classify": "国际"},
        {"name": "军事", "code": "news_news_mil", "classify": "军事"},
        {"name": "游戏", "code": "news_news_game", "classify": "游戏"},
    ]

    def get_news_list(self, limit=20) -> List[Dict]:
        all_news = []

        for cat in self.category_list:
            try:
                json_data = {
                    "base_req": {"from": "pc"},
                    "forward": "2",
                    "qimei36": "0_C47K1MESdC7T6",
                    "device_id": "0_C47K1MESdC7T6",
                    "flush_num": 1,
                    "channel_id": cat["code"],
                    "item_count": 12,
                    "is_local_chlid": "0",
                }

                response = self.request(
                    method="POST",
                    url="https://i.news.qq.com/web_feed/getPCList",
                    json=json_data,
                )

                items = response.json().get("data", [])
                for item in items[:limit // 2]:
                    # 跳过子项目视频等
                    if item.get("sub_item"):
                        continue
                    # 跳过视频类型
                    if item.get("articletype") == "525":
                        continue

                    pic_info = item.get("pic_info", {})
                    big_img = pic_info.get("big_img", "") if isinstance(pic_info, dict) else ""
                    # 确保 img_url 是字符串
                    if isinstance(big_img, list):
                        big_img = big_img[0] if big_img else ""
                    big_img = str(big_img) if big_img else ""

                    title = item.get("title", "")
                    if not title:
                        continue

                    all_news.append({
                        "title": title,
                        "url": f"https://news.qq.com/rain/a/{item.get('id', '')}",
                        "img_url": big_img,
                        "pub_time": item.get("publish_time", "") or datetime.now().strftime("%Y-%m-%d"),
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"腾讯 {cat['name']} 获取失败: {e}")

        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取腾讯新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            html = etree.HTML(response.text)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="article-content"]//p | //article//p | //*[@class="content"]//p',
                "title": '//h1//text() | //*[@class="title"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取腾讯详情失败: {e}")
        return None


class SouHuSpider(BaseSpider):
    """搜狐新闻爬虫"""
    source_name = "搜狐"

    category_list = [
        {"name": "时政", "code": "438647_15", "classify": "时政"},
        {"name": "国际", "code": "1649_13", "classify": "国际"},
        {"name": "财经", "code": "54401_15", "classify": "财经"},
        {"name": "科技", "code": "666_13", "classify": "科技"},
        {"name": "娱乐", "code": "55955_15", "classify": "娱乐"},
    ]

    def parse_relative_time(self, relative_time: str) -> str:
        now = datetime.now()

        if match := re.match(r"(\d+)秒前", relative_time):
            seconds = int(match.group(1))
            result_time = now - timedelta(seconds=seconds)
        elif match := re.match(r"(\d+)分钟前", relative_time):
            minutes = int(match.group(1))
            result_time = now - timedelta(minutes=minutes)
        elif match := re.match(r"(\d+)小时前", relative_time):
            hours = int(match.group(1))
            result_time = now - timedelta(hours=hours)
        elif match := re.match(r"昨天(\d{2}):(\d{2})", relative_time):
            hour, minute = map(int, match.groups())
            result_time = now - timedelta(days=1)
            result_time = result_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
        elif match := re.match(r"前天(\d{2}):(\d{2})", relative_time):
            hour, minute = map(int, match.groups())
            result_time = now - timedelta(days=2)
            result_time = result_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
        elif match := re.match(r"(\d+)天前", relative_time):
            days = int(match.group(1))
            result_time = now - timedelta(days=days)
        else:
            return relative_time

        return result_time.strftime("%Y-%m-%d %H:%M:%S")

    def get_news_list(self, limit=20) -> List[Dict]:
        all_news = []

        for cat in self.category_list:
            try:
                productId, productType = cat["code"].split("_")
                json_data = {
                    "mainContent": {
                        "productType": "13",
                        "productId": "1524",
                        "secureScore": "50",
                        "categoryId": "47",
                    },
                    "resourceList": [{
                        "tplCompKey": "TPLFeedMul_2_9_feedData",
                        "isServerRender": False,
                        "isSingleAd": False,
                        "configSource": "mp",
                        "content": {
                            "productId": productId,
                            "productType": productType,
                            "size": 20,
                            "pro": "0,1",
                            "feedType": "XTOPIC_LATEST",
                            "view": "feedMode",
                            "innerTag": "channel",
                            "page": 1,
                            "requestId": f"{int(time.time() * 1000)}Adk66ZV_1524",
                        },
                    }],
                }

                response = self.request(
                    method="POST",
                    url="https://odin.sohu.com/odin/api/blockdata",
                    json=json_data,
                )

                data = response.json()
                data_list = data["data"]["TPLFeedMul_2_9_feedData"]["list"]

                for item in data_list[:limit // 2]:
                    if item.get("icon") in ["images", "video"]:
                        continue

                    date_str = ""
                    if item.get("extraInfoList"):
                        date_str = item["extraInfoList"][1].get("text", "") if len(item["extraInfoList"]) > 1 else ""
                        date_str = self.parse_relative_time(date_str)

                    cover = item.get("cover", [])
                    cover_url = f"https:{cover[0]}" if cover and "https:" not in cover[0] else (cover[0] if cover else "")

                    all_news.append({
                        "title": item.get("title", ""),
                        "url": f"https://www.sohu.com{item.get('url', '')}",
                        "img_url": cover_url,
                        "pub_time": date_str,
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"搜狐 {cat['name']} 获取失败: {e}")

        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取搜狐新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            html = etree.HTML(response.text)

            # 移除广告
            for ad in html.xpath('//a[@id="backsohucom"]'):
                ad.getparent().remove(ad)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//article[@id="mp-editor"]//p | //*[@class="article"]//p',
                "title": '//h1//text() | //*[@class="text-title"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            # 尝试从 response 提取图片列表
            match = re.search(r"imgsList:\s*(\[[^\]]+\])", response.text, re.DOTALL)
            if match and not img_list:
                try:
                    imgs = ast.literal_eval(match.group(1))
                    img_list = [f"https:{img['url']}" if "https:" not in img.get("url", "") else img["url"] for img in imgs]
                except:
                    pass

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取搜狐详情失败: {e}")
        return None


class ITHomeSpider(BaseSpider):
    """IT之家爬虫"""
    source_name = "IT之家"

    def get_news_list(self, limit=20) -> List[Dict]:
        try:
            url = "https://www.ithome.com/"
            response = self.request(url=url)
            response.encoding = 'utf-8'  # 强制 UTF-8
            html = etree.HTML(response.text)

            news_items = html.xpath('//*[@id="nnews"]/div[3]/ul/li')
            result = []

            for item in news_items[:limit]:
                title_elem = item.xpath(".//a")
                if not title_elem:
                    continue

                title = title_elem[0].text
                if not title:
                    continue
                title = title.strip()
                link = title_elem[0].get("href", "").strip()

                date_str = item.xpath("./b//text()")
                if date_str:
                    try:
                        hour, minute = map(int, date_str[0].strip().split())
                        date_str = datetime.now().strftime(f"%Y-%m-%d {hour:02d}:{minute:02d}:00")
                    except:
                        date_str = datetime.now().strftime("%Y-%m-%d")
                else:
                    date_str = datetime.now().strftime("%Y-%m-%d")

                result.append({
                    "title": title,
                    "url": link,
                    "img_url": "",
                    "pub_time": date_str,
                    "source": self.source_name,
                    "category": "科技",
                    "channel": "数码"
                })

            return result
        except Exception as e:
            print(f"IT之家获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取IT之家新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="paragraph"]//p | //article//p',
                "title": '//h1//text() | //*[@class="title"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": "科技",
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取IT之家详情失败: {e}")
        return None


class XinLangSpider(BaseSpider):
    """新浪新闻爬虫"""
    source_name = "新浪"

    category_list = [
        {"name": "国内", "url": "https://news.sina.com.cn/china/", "classify": "国内"},
        {"name": "国际", "url": "https://news.sina.com.cn/world/", "classify": "国际"},
        {"name": "财经", "url": "https://finance.sina.com.cn/", "classify": "财经"},
        {"name": "科技", "url": "https://tech.sina.com.cn/", "classify": "科技"},
    ]

    def get_news_list(self, limit=20) -> List[Dict]:
        result = []

        for cat in self.category_list:
            try:
                response = self.request(url=cat["url"], timeout=10)
                response.encoding = response.apparent_encoding
                html = etree.HTML(response.text)

                # 查找所有新闻链接
                all_links = html.xpath('//a[contains(@href, "sina.com.cn")]/@href')
                seen = set()

                for link in all_links:
                    # 只保留文章链接
                    if not any(x in link for x in ['.shtml', '/doc-', '/202']):
                        continue
                    if link in seen:
                        continue

                    # 跳过视频链接
                    if 'video' in link.lower():
                        continue

                    seen.add(link)
                    title_match = html.xpath(f'//a[@href="{link}"]//text()')
                    title = "".join([t.strip() for t in title_match if t.strip()])

                    if not title or len(title) < 5:
                        continue

                    result.append({
                        "title": title[:100],
                        "url": link if link.startswith("http") else f"https://news.sina.com.cn{link}",
                        "img_url": "",
                        "pub_time": datetime.now().strftime("%Y-%m-%d"),
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })

                    if len(result) >= limit:
                        break

                if len(result) >= limit:
                    break
            except Exception as e:
                print(f"新浪 {cat['name']} 获取失败: {e}")

        return result[:limit]

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取新浪新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="article-content"]//p | //*[@class="article"]//p | //*[@id="cont_0_0"]//p',
                "title": '//h1//text() | //*[@class="main-title"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取新浪详情失败: {e}")
        return None


class ZhongGuoRiBaoSpider(BaseSpider):
    """中国日报新闻爬虫"""
    source_name = "中国日报"

    def get_news_list(self, limit=20) -> List[Dict]:
        try:
            url = "https://www.chinadaily.com.cn/china/"
            response = self.request(url=url)
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            news_items = html.xpath('//div[@class="mb_10"]//a')[:limit]

            result = []
            for item in news_items:
                title = item.xpath(".//text()")
                title = "".join([t.strip() for t in title if t.strip()])

                if not title or len(title) < 5:
                    continue

                link = item.get("href", "")
                if not link:
                    continue

                if not link.startswith("http"):
                    link = "https://www.chinadaily.com.cn" + link

                result.append({
                    "title": title,
                    "url": link,
                    "img_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "时政",
                    "channel": "时政要闻"
                })

            return result
        except Exception as e:
            print(f"中国日报获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取中国日报新闻详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"])
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            # 提取正文
            xpath_rules = {
                "paragraphs": '//*[@id="Content"]//p | //*[@class="article"]//p | //article//p',
                "title": '//h1//text() | //*[@class="article-title"]//text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            print(f"获取中国日报详情失败: {e}")
        return None


class WeiboSpider(BaseSpider):
    """微博热搜爬虫"""
    source_name = "微博"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://weibo.com/",
    }

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取微博热搜榜（移动版）"""
        try:
            # 使用移动版 API
            url = "https://weibo.com/ajax/side/hotSearch"
            response = self.request(url=url, headers=self.headers)
            data = response.json()

            if data.get("ok") != 1:
                return []

            hot_list = data.get("data", {}).get("realtime", [])

            result = []
            for item in hot_list[:limit]:
                word = item.get("word", "")
                if not word:
                    continue

                num = item.get("num", 0)

                result.append({
                    "title": word,
                    "url": f"https://s.weibo.com/weibo?q={quote(word)}",
                    "img_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "热搜",
                    "channel": "微博热搜",
                    "hot_value": num
                })

            return result
        except Exception as e:
            print(f"微博热搜获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取微博热搜详情"""
        return {
            "title": item["title"],
            "url": item["url"],
            "cover_url": "",
            "pub_time": item.get("pub_time", ""),
            "article_info": f"热搜话题: {item['title']}",
            "img_list": [],
            "category": "热搜",
            "source": self.source_name,
            "hot_value": item.get("hot_value", 0)
        }


class ZhiHuSpider(BaseSpider):
    """知乎热榜爬虫"""
    source_name = "知乎"

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取知乎热榜"""
        try:
            # 使用知乎热榜 API
            url = "https://api.zhihu.com/topstory/hot-lists/total?limit=20"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": "https://www.zhihu.com/",
            }
            response = self.request(url=url, headers=headers, timeout=15)
            data = response.json()

            items = data.get("data", [])

            result = []
            for item_data in items[:limit]:
                target = item_data.get("target", {})
                title = target.get("title", "") or target.get("question", {}).get("title", "")
                if not title:
                    continue

                link = target.get("url", "") or f"https://www.zhihu.com/question/{target.get('question', {}).get('id', '')}"

                # 热度值
                hot_value = item_data.get("detail_text", "") or item_data.get("score", "")

                result.append({
                    "title": title[:100],
                    "url": link,
                    "img_url": target.get("thumbnail", "") or "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "热榜",
                    "channel": "知乎热榜",
                    "hot_value": hot_value
                })

            return result
        except Exception as e:
            print(f"知乎热榜获取失败: {e}")
            # 备用：尝试网页版
            return self._get_from_page(limit)

    def _get_from_page(self, limit=20) -> List[Dict]:
        """从网页抓取知乎热榜"""
        try:
            url = "https://www.zhihu.com/hot"
            headers = {
                **self.headers,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
            response = self.request(url=url, headers=headers, timeout=15)
            html = etree.HTML(response.text)

            # 提取热榜项目
            items = html.xpath('//div[@class="HotList-item"] | //div[@class="List-item"]')[:limit]

            result = []
            for item in items:
                title_elem = item.xpath('.//h2//text() | .//span[@class="HotItem-title"]/text()')
                title = "".join([t.strip() for t in title_elem if t.strip()])

                if not title:
                    continue

                link_elem = item.xpath('.//a/@href')
                link = link_elem[0] if link_elem else ""

                if link and not link.startswith("http"):
                    link = "https://www.zhihu.com" + link

                # 热度指标
                metric_elem = item.xpath('.//MetricsInner//text()')
                metric = "".join([m.strip() for m in metric_elem if m.strip()])

                result.append({
                    "title": title,
                    "url": link or "https://www.zhihu.com/hot",
                    "img_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "热榜",
                    "channel": "知乎热榜",
                    "hot_value": metric
                })

            return result
        except Exception as e:
            print(f"知乎热榜网页版也失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取知乎问题摘要"""
        return {
            "title": item["title"],
            "url": item["url"],
            "cover_url": "",
            "pub_time": item.get("pub_time", ""),
            "article_info": f"知乎热榜: {item['title']}",
            "img_list": [],
            "category": "热榜",
            "source": self.source_name,
            "hot_value": item.get("hot_value", "")
        }


class ToutiaoSpider(BaseSpider):
    """今日头条爬虫"""
    source_name = "今日头条"

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取今日头条热榜"""
        try:
            # 今日头条新热榜 API
            url = "https://www.toutiao.com/hot-event/hot-board/?origin=hot_board&activeTab=hoot_ranking_essay&cate=article"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.toutiao.com/",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9",
            }
            response = self.request(url=url, headers=headers, timeout=15)
            data = response.json()

            items = data.get("data", [])

            result = []
            for item in items[:limit]:
                title = item.get("Title", "") or item.get("title", "")
                if not title:
                    continue

                link = item.get("Url", "") or item.get("url", "")
                if link and not link.startswith("http"):
                    link = "https://so.toutiao.com" + link

                result.append({
                    "title": title,
                    "url": link,
                    "img_url": item.get("ImageUrl", "") or item.get("middle_image", ""),
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": item.get("Label", "热点") or "热点",
                    "channel": "头条热榜",
                    "hot_value": item.get("HotValue", 0) or item.get("hot_score", 0)
                })

            return result
        except Exception as e:
            print(f"今日头条获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取今日头条文章详情"""
        try:
            self.current_url = item["url"]
            response = self.request(url=item["url"], timeout=10)
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            xpath_rules = {
                "paragraphs": '//*[@class="article-content"]//p | //*[@id="content"]//p | //article//p',
                "title": '//h1//text() | //*[@class="article-title"]//text() | //title/text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)

            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info or f"头条文章: {item['title']}",
                "img_list": img_list,
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }
        except Exception as e:
            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": f"头条文章: {item['title']}",
                "img_list": [],
                "category": category or item.get("category", ""),
                "source": self.source_name,
            }


# ==================== AI 垂直平台爬虫 ====================

class Spider36Kr(BaseSpider):
    """36氪 AI频道"""
    source_name = "36氪"

    def get_news_list(self, limit: int = 20) -> List[Dict]:
        """获取36氪AI相关文章"""
        try:
            url = "https://36kr.com/api/search/articles?query=AI&type=article"
            response = self.request(url=url, timeout=15)
            data = response.json()

            items = data.get("data", {}).get("items", [])
            result = []
            for item in items[:limit]:
                title = item.get("title", "")
                if not title:
                    continue
                result.append({
                    "title": title,
                    "url": f"https://36kr.com{item.get('path', '')}",
                    "img_url": item.get("cover", ""),
                    "pub_time": item.get("published_at", "")[:10] if item.get("published_at") else datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "AI科技",
                    "channel": "36氪AI",
                })
            return result
        except Exception as e:
            print(f"36氪获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取36氪文章详情"""
        try:
            response = self.request(url=item["url"], timeout=10)
            response.encoding = "utf-8"
            html = etree.HTML(response.text)

            xpath_rules = {
                "paragraphs": '//*[@class="article-content"]//p | //div[@class="content-body"]//p',
                "title": '//h1//text() | //title/text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)
            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info or f"36氪文章: {item['title']}",
                "img_list": img_list,
                "category": "AI科技",
                "source": self.source_name,
            }
        except Exception as e:
            return {
                "title": item["title"],
                "url": item["url"],
                "article_info": f"36氪文章: {item['title']}",
                "source": self.source_name,
            }


class LiangziSpider(BaseSpider):
    """量子位 - AI科技"""
    source_name = "量子位"

    def get_news_list(self, limit: int = 20) -> List[Dict]:
        """获取量子位AI文章"""
        try:
            url = "https://www.qbitai.com/api/search?q=AI&limit=20"
            response = self.request(url=url, timeout=15)
            data = response.json()

            items = data.get("data", [])
            result = []
            for item in items[:limit]:
                title = item.get("title", "") or item.get("news_title", "")
                if not title:
                    continue
                result.append({
                    "title": title,
                    "url": item.get("url", "") or item.get("news_url", ""),
                    "img_url": item.get("img_url", ""),
                    "pub_time": item.get("publish_time", "")[:10] if item.get("publish_time") else datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "AI科技",
                    "channel": "量子位",
                })
            return result
        except Exception as e:
            print(f"量子位获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取量子位文章详情"""
        try:
            response = self.request(url=item["url"], timeout=10)
            response.encoding = "utf-8"
            html = etree.HTML(response.text)
            xpath_rules = {
                "paragraphs": '//article//p | //*[@class="article-content"]//p',
                "title": '//h1//text() | //title/text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)
            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info or f"量子位文章: {item['title']}",
                "img_list": img_list,
                "category": "AI科技",
                "source": self.source_name,
            }
        except Exception as e:
            return {
                "title": item["title"],
                "url": item["url"],
                "article_info": f"量子位文章: {item['title']}",
                "source": self.source_name,
            }


class JiQiXinSpider(BaseSpider):
    """机器之心"""
    source_name = "机器之心"

    def get_news_list(self, limit: int = 20) -> List[Dict]:
        """获取机器之心AI文章"""
        try:
            url = "https://www.jiqizhixin.com/api/articles?tag=AI&limit=20"
            response = self.request(url=url, timeout=15)
            data = response.json()

            items = data.get("data", [])
            result = []
            for item in items[:limit]:
                title = item.get("title", "")
                if not title:
                    continue
                result.append({
                    "title": title,
                    "url": f"https://www.jiqizhixin.com/articles/{item.get('id', '')}",
                    "img_url": item.get("cover_image", ""),
                    "pub_time": item.get("published_at", "")[:10] if item.get("published_at") else datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "AI科技",
                    "channel": "机器之心",
                })
            return result
        except Exception as e:
            print(f"机器之心获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """获取机器之心文章详情"""
        try:
            response = self.request(url=item["url"], timeout=10)
            response.encoding = "utf-8"
            html = etree.HTML(response.text)
            xpath_rules = {
                "paragraphs": '//article//p | //*[@class="article-content"]//p',
                "title": '//h1//text() | //title/text()'
            }
            article_info, img_list = self.extract_article_content(html, xpath_rules)
            return {
                "title": item["title"],
                "url": item["url"],
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info or f"机器之心文章: {item['title']}",
                "img_list": img_list,
                "category": "AI科技",
                "source": self.source_name,
            }
        except Exception as e:
            return {
                "title": item["title"],
                "url": item["url"],
                "article_info": f"机器之心文章: {item['title']}",
                "source": self.source_name,
            }


class HackerNewsSpider(BaseSpider):
    """Hacker News"""
    source_name = "Hacker News"

    def get_news_list(self, limit: int = 20) -> List[Dict]:
        """获取Hacker News热门讨论"""
        try:
            # 获取 top stories
            url = "https://hacker-news.firebaseio.com/v0/topstories.json"
            response = self.request(url=url, timeout=15)
            story_ids = response.json()[:limit]

            result = []
            for story_id in story_ids:
                try:
                    story_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                    story_response = self.request(url=story_url, timeout=10)
                    story = story_response.json()

                    if story and story.get("title"):
                        result.append({
                            "title": story["title"],
                            "url": story.get("url", f"https://news.ycombinator.com/item?id={story_id}"),
                            "img_url": "",
                            "pub_time": datetime.fromtimestamp(story.get("time", 0)).strftime("%Y-%m-%d") if story.get("time") else datetime.now().strftime("%Y-%m-%d"),
                            "source": self.source_name,
                            "category": "科技",
                            "channel": "HackerNews",
                            "hot_value": story.get("score", 0),
                        })
                        if len(result) >= limit:
                            break
                except Exception:
                    continue

            return result
        except Exception as e:
            print(f"Hacker News获取失败: {e}")
            return []

    def get_news_info(self, item: Dict, category: str = None) -> Optional[Dict]:
        """Hacker News 详情"""
        return {
            "title": item["title"],
            "url": item["url"],
            "cover_url": "",
            "pub_time": item.get("pub_time", ""),
            "article_info": f"Hacker News: {item['title']}\n链接: {item['url']}",
            "img_list": [],
            "category": "科技",
            "source": self.source_name,
        }


def get_spider(platform: str):
    """获取爬虫实例"""
    spiders = {
        "wangyi": WangYiSpider(),
        "pengpai": PengPaiSpider(),
        "tencent": TengXunSpider(),
        "souhu": SouHuSpider(),
        "ithome": ITHomeSpider(),
        "xinlang": XinLangSpider(),
        "zhongguoribao": ZhongGuoRiBaoSpider(),
        "weibo": WeiboSpider(),
        "zhihu": ZhiHuSpider(),
        "toutiao": ToutiaoSpider(),
        # AI 垂直平台
        "36kr": Spider36Kr(),
        "liangzi": LiangziSpider(),
        "jiqizhixin": JiQiXinSpider(),
        "hackernews": HackerNewsSpider(),
    }
    return spiders.get(platform.lower())


def is_less_than_user_minutes(datetime_str: str, minutes: int = 30) -> bool:
    """判断时间是否在指定分钟内"""
    try:
        dt_object = datetime.fromisoformat(datetime_str)
        input_time = dt_object.strftime("%Y-%m-%d %H:%M:%S")
        input_time = datetime.strptime(input_time, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return False

    current_time = datetime.now()
    time_difference = current_time - input_time
    return time_difference < timedelta(minutes=minutes)


async def crawl_all(platforms: List[str], limit: int = 20) -> Tuple[List[Dict], Dict[str, int]]:
    """爬取所有平台的新闻（带防封策略）

    Returns:
        (all_news, platform_stats) - 新闻列表和每个平台的抓取数量
    """
    all_news = []
    platform_stats: Dict[str, int] = {}

    for platform in platforms:
        spider = get_spider(platform)
        if spider:
            print(f"正在爬取 {platform}...")
            try:
                news = spider.get_news_list(limit)
                print(f"  获取到 {len(news)} 条新闻")
                all_news.extend(news)
                platform_stats[platform] = len(news)
                # 平台间随机延迟，避免请求过于频繁
                random_delay()
            except Exception as e:
                print(f"  {platform} 爬取失败: {e}")
                platform_stats[platform] = 0
        else:
            print(f"未知平台: {platform}")
            platform_stats[platform] = 0

    all_news.sort(key=lambda x: x.get("pub_time", ""), reverse=True)
    return all_news[:limit * len(platforms) if platforms else limit], platform_stats


async def crawl_with_details(platforms: List[str], limit: int = 20, detail_limit: int = 5) -> Tuple[List[Dict], List[Dict]]:
    """爬取新闻并获取详情

    Returns:
        (news_list, news_details)
    """
    all_news = await crawl_all(platforms, limit)

    # 获取前 N 条的详情
    details = []
    for item in all_news[:detail_limit]:
        spider = get_spider(item.get("source", "").lower())
        if spider and hasattr(spider, 'get_news_info'):
            try:
                detail = spider.get_news_info(item)
                if detail:
                    details.append(detail)
                time.sleep(0.3)
            except Exception as e:
                print(f"获取详情失败: {e}")

    return all_news, details


# 兼容旧接口
async def crawl_all_simple(platforms: List[str], limit: int = 20) -> List[Dict]:
    """简化版爬取 - 兼容现有代码"""
    return await crawl_all(platforms, limit)


if __name__ == "__main__":
    async def test():
        print("=== 测试新闻列表抓取 ===")
        news = await crawl_all(["wangyi", "weibo", "zhihu", "toutiao"], 5)
        print(f"\n共获取 {len(news)} 条新闻:")
        for i, n in enumerate(news[:15], 1):
            hot_info = ""
            if n.get("hot_value"):
                hot_info = f" (热度: {n['hot_value']})"
            elif n.get("answer_count"):
                hot_info = f" (回答: {n['answer_count']})"
            print(f"{i}. [{n['source']}] {n['title'][:30]}...{hot_info} - {n['pub_time']}")

        print("\n=== 测试详情抓取 ===")
        _, details = await crawl_with_details(["wangyi"], 5, 2)
        for d in details:
            print(f"\n标题: {d['title']}")
            print(f"正文前100字: {d['article_info'][:100]}...")

    asyncio.run(test())
