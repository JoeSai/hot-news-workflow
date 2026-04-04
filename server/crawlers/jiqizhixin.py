#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
机器之心爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional

import requests
from lxml import etree


class JiQiXinSpider:
    """机器之心"""
    source_name = "机器之心"
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
            article_info, img_list = self._extract_article_content(html, xpath_rules)
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

    def _extract_article_content(self, html, xpath_rules):
        """提取文章内容"""
        paragraphs = html.xpath(xpath_rules.get("paragraphs", "//article//p"))
        article_info = "\n".join([p.text.strip() if p.text else "" for p in paragraphs if p.text and p.text.strip()])
        img_list = []
        for p in paragraphs:
            imgs = p.xpath('.//img/@src')
            img_list.extend(imgs)
        return article_info, img_list
