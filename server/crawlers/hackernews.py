#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Hacker News爬虫
"""
from datetime import datetime
from typing import List, Dict, Optional

import requests


class HackerNewsSpider:
    """Hacker News"""
    source_name = "Hacker News"
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
