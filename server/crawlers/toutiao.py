#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
今日头条爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional

import requests
from lxml import etree


class ToutiaoSpider:
    """今日头条爬虫"""
    source_name = "今日头条"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.toutiao.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    def request(self, method="GET", url=None, headers=None, timeout=15):
        """同步请求"""
        request_headers = headers or self.headers
        request_headers = {**request_headers, "User-Agent": self.headers["User-Agent"]}
        response = requests.request(method=method, url=url, headers=request_headers, timeout=timeout)
        return response

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取今日头条热榜"""
        try:
            url = "https://www.toutiao.com/hot-event/hot-board/?origin=hot_board&activeTab=hoot_ranking_essay&cate=article"
            response = self.request(url=url, headers=self.headers, timeout=15)
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
            response = self.request(url=item["url"], timeout=10)
            response.encoding = response.apparent_encoding
            html = etree.HTML(response.text)

            xpath_rules = {
                "paragraphs": '//*[@class="article-content"]//p | //*[@id="content"]//p | //article//p',
                "title": '//h1//text() | //*[@class="article-title"]//text() | //title/text()'
            }
            article_info, img_list = self._extract_article_content(html, xpath_rules)

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

    def _extract_article_content(self, html, xpath_rules):
        """提取文章内容"""
        paragraphs = html.xpath(xpath_rules.get("paragraphs", "//article//p"))
        article_info = "\n".join([p.text.strip() if p.text else "" for p in paragraphs if p.text and p.text.strip()])
        img_list = []
        for p in paragraphs:
            imgs = p.xpath('.//img/@src')
            img_list.extend(imgs)
        return article_info, img_list
