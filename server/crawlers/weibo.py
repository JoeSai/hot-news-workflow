#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
微博热搜爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional
from urllib.parse import quote

import requests


class WeiboSpider:
    """微博热搜爬虫"""
    source_name = "微博"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://weibo.com/",
    }

    def request(self, method="GET", url=None, headers=None, timeout=15):
        """同步请求"""
        request_headers = headers or self.headers
        request_headers = {**request_headers, "User-Agent": self.headers["User-Agent"]}
        response = requests.request(method=method, url=url, headers=request_headers, timeout=timeout)
        return response

    def get_news_list(self, limit=20) -> List[Dict]:
        """获取微博热搜榜（移动版）"""
        try:
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
