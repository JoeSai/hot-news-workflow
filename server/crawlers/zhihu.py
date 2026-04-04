#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
知乎热榜爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional

import requests
from lxml import etree


class ZhiHuSpider:
    """知乎热榜爬虫"""
    source_name = "知乎"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.zhihu.com/",
    }

    def request(self, method="GET", url=None, headers=None, timeout=15):
        """同步请求"""
        request_headers = headers or self.headers
        request_headers = {**request_headers, "User-Agent": self.headers["User-Agent"]}
        response = requests.request(method=method, url=url, headers=request_headers, timeout=timeout)
        return response

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取知乎热榜"""
        try:
            url = "https://api.zhihu.com/topstory/hot-lists/total?limit=20"
            response = self.request(url=url, headers=self.headers, timeout=15)
            data = response.json()

            items = data.get("data", [])

            result = []
            for item_data in items[:limit]:
                target = item_data.get("target", {})
                title = target.get("title", "") or target.get("question", {}).get("title", "")
                if not title:
                    continue

                link = target.get("url", "") or f"https://www.zhihu.com/question/{target.get('question', {}).get('id', '')}"

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
