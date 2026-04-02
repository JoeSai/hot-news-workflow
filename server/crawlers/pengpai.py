#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
澎湃新闻爬虫
"""
import time
from urllib.parse import quote

import requests
from lxml import etree


class PengPaiSpider:
    """澎湃新闻爬虫"""
    source_name = "澎湃"
    headers = {
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "client-type": "1",
        "content-type": "application/json",
        "origin": "https://www.thepaper.cn",
        "referer": "https://www.thepaper.cn/",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    # 分类配置
    category_list = [
        {"name": "舆论场", "code": "25489", "classify": "社会"},
        {"name": "中国政库", "code": "25950", "classify": "时政"},
        {"name": "打虎记", "code": "25948", "classify": "时政"},
        {"name": "财经", "code": "25490", "classify": "财经"},
        {"name": "科技", "code": "25492", "classify": "科技"},
    ]

    def get_news_list(self, limit=20):
        """获取澎湃新闻列表"""
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

                response = requests.post(
                    "https://api.thepaper.cn/contentapi/nodeCont/getByNodeIdPortal",
                    headers=self.headers,
                    json=json_data,
                    timeout=10
                )

                data = response.json()
                items = data.get("data", {}).get("list", [])

                for item in items[:limit // 2]:
                    if item.get("link"):  # 跳过外部链接
                        continue
                    pub_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(item.get("pubTimeLong", 0) / 1000))

                    all_news.append({
                        "title": item.get("name", ""),
                        "article_url": f"https://www.thepaper.cn/newsDetail_forward_{quote(item.get('contId', ''))}",
                        "cover_url": item.get("pic", ""),
                        "pub_time": pub_time,
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"澎湃 {cat['name']} 获取失败: {e}")

        # 按时间排序
        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item, category=None):
        """获取澎湃新闻详情"""
        try:
            article_url = item["article_url"]
            response = requests.get(article_url, headers=self.headers, timeout=10)
            content_html = etree.HTML(response.text)

            img_list = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/img/@src')
            txt_elements = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/p')

            article_info = ""
            for p in txt_elements:
                t = p.xpath(".//text()")
                for i in t:
                    article_info += i + "\n"

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "article_url": article_url,
                "cover_url": item.get("cover_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
            }
        except Exception as e:
            print(f"获取澎湃详情失败: {e}")
        return None