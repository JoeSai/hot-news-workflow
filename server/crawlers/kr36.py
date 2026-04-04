#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
36氪 RSS爬虫
"""
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Optional

import requests
from lxml import etree


class Spider36Kr:
    """36氪 RSS"""
    source_name = "36氪"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    def request(self, url=None, timeout=15):
        """同步请求"""
        headers = {**self.headers, "User-Agent": self.headers["User-Agent"]}
        response = requests.get(url=url, headers=headers, timeout=timeout)
        return response

    def get_news_list(self, limit: int = 20) -> List[Dict]:
        """获取36氪最新文章（RSS 方式）"""
        try:
            response = self.request(url="https://36kr.com/feed", timeout=15)
            root = ET.fromstring(response.text)
            channel = root.find('channel')
            items = channel.findall('item')
            result = []
            for item in items[:limit]:
                title = item.find('title')
                link = item.find('link')
                pub_date = item.find('pubDate')
                result.append({
                    "title": title.text.strip() if title is not None and title.text else "",
                    "url": link.text.strip() if link is not None and link.text else "",
                    "img_url": "",
                    "pub_time": pub_date.text[:10] if pub_date is not None and pub_date.text else datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "AI科技",
                    "channel": "36氪",
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
            article_info, img_list = self._extract_article_content(html, xpath_rules)
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
                "cover_url": item.get("img_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": f"36氪文章: {item['title']}",
                "img_list": [],
                "category": "AI科技",
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
