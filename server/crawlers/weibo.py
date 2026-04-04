#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
微博热搜爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional
from urllib.parse import quote

import requests
from lxml import etree


class WeiboSpider:
    """微博热搜爬虫"""
    source_name = "微博"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }

    def request(self, url=None, timeout=15):
        """同步请求"""
        headers = {**self.headers, "User-Agent": self.headers["User-Agent"]}
        response = requests.get(url=url, headers=headers, timeout=timeout)
        return response

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取微博热搜榜（多种方式）"""
        # 方式1：尝试移动端 API
        result = self._get_via_mobile_api(limit)
        if result:
            return result

        # 方式2：尝试网页抓取
        result = self._get_via_web_scrape(limit)
        if result:
            return result

        return []

    def _get_via_mobile_api(self, limit=20) -> List[Dict]:
        """通过移动端 API 获取"""
        try:
            # 尝试移动端 API（可能需要 Cookie）
            headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": "https://m.weibo.cn/",
            }
            response = requests.get(
                url="https://m.weibo.cn/api/container/getIndex?type=2&queryVal=微博热搜榜&containerid=100103type%3D2%26q%3D%E5%BE%AE%E5%8D%9A%E7%83%AD%E6%90%9C%E6%A6%9C&page=1",
                headers=headers,
                timeout=10
            )
            data = response.json()
            cards = data.get("data", {}).get("cards", [])
            result = []
            for card in cards:
                title = card.get("card_title", "")
                if not title:
                    continue
                result.append({
                    "title": title,
                    "url": f"https://s.weibo.com/weibo?q={quote(title)}",
                    "img_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "热搜",
                    "channel": "微博热搜",
                })
                if len(result) >= limit:
                    break
            return result
        except Exception as e:
            print(f"微博移动API获取失败: {e}")
            return []

    def _get_via_web_scrape(self, limit=20) -> List[Dict]:
        """通过网页抓取获取微博热搜"""
        try:
            response = self.request(url="https://s.weibo.com/top/summary", timeout=10)
            html = etree.HTML(response.text)

            # 尝试多种选择器
            items = html.xpath('//table//tr | //div[@class="hot_item"] | //div[contains(@class, "list-item")]')[:limit]

            result = []
            for item in items:
                title_elem = item.xpath('.//a//text() | .//span[@class="title"]//text()')
                title = "".join([t.strip() for t in title_elem if t.strip()])
                if not title:
                    continue
                result.append({
                    "title": title,
                    "url": "https://s.weibo.com/weibo?q=" + quote(title),
                    "img_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "热搜",
                    "channel": "微博热搜",
                })
                if len(result) >= limit:
                    break

            return result
        except Exception as e:
            print(f"微博网页抓取失败: {e}")
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
