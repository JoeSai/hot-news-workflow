#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
中国日报新闻爬虫
"""
from datetime import datetime

import requests
from lxml import etree


class ZhongGuoRiBaoSpider:
    """中国日报新闻爬虫"""
    source_name = "中国日报"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    # 分类配置
    category_list = [
        {"name": "时政要闻", "code": "chinadaily", "classify": "时政"},
        {"name": "国际资讯", "code": "world", "classify": "国际"},
        {"name": "财经", "code": "business", "classify": "财经"},
        {"name": "观点", "code": "opinion", "classify": "观点"},
        {"name": "中文国际", "code": "intl", "classify": "国际"},
    ]

    def get_news_list(self, limit=20):
        """获取中国日报新闻列表"""
        all_news = []

        for cat in self.category_list:
            try:
                if cat["code"] == "chinadaily":
                    url = "https://www.chinadaily.com.cn/china/"
                elif cat["code"] == "world":
                    url = "https://www.chinadaily.com.cn/world/"
                elif cat["code"] == "business":
                    url = "https://www.chinadaily.com.cn/business/"
                elif cat["code"] == "opinion":
                    url = "https://www.chinadaily.com.cn/opinion/"
                else:
                    url = "https://www.chinadaily.com.cn/intl/"

                response = requests.get(url, headers=self.headers, timeout=10)
                response.encoding = response.apparent_encoding
                content_html = etree.HTML(response.text)

                news_items = content_html.xpath('//div[@class="mb_10"]//a')[:limit // 2]

                for item in news_items:
                    title = item.xpath(".//text()")
                    title = "".join([t.strip() for t in title if t.strip()])

                    if not title or len(title) < 5:
                        continue

                    link = item.get("href", "")
                    if not link:
                        continue

                    # 修复相对链接
                    if not link.startswith("http"):
                        link = "https://www.chinadaily.com.cn" + link

                    all_news.append({
                        "title": title,
                        "article_url": link,
                        "cover_url": "",
                        "pub_time": datetime.now().strftime("%Y-%m-%d"),
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"中国日报 {cat['name']} 获取失败: {e}")

        return all_news[:limit]

    def get_news_info(self, item, category=None):
        """获取中国日报新闻详情"""
        try:
            response = requests.get(item["article_url"], headers=self.headers, timeout=10)
            response.encoding = response.apparent_encoding
            content_html = etree.HTML(response.text)

            content_div = content_html.xpath('//*[@id="Content"]')
            if not content_div:
                content_div = content_html.xpath('//*[@class="article"]')

            if not content_div:
                return None

            content_div = content_div[0]

            text_list = content_div.xpath(".//p//text()")
            img_list = content_div.xpath(".//img/@src")

            article_info = "".join([t.strip() + "\n" for t in text_list if t.strip()])

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "article_url": item["article_url"],
                "cover_url": item.get("cover_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": list(img_list),
                "category": category or item.get("category", ""),
            }
        except Exception as e:
            print(f"获取中国日报详情失败: {e}")
        return None