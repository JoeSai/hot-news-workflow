#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
新浪国际新闻爬虫
"""
from datetime import datetime

import requests
from lxml import etree


class XinLangSpider:
    """新浪国际新闻爬虫"""
    source_name = "新浪"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    def get_news_list(self, limit=20):
        """获取新浪国际新闻列表"""
        try:
            url = "https://news.sina.com.cn/world/"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.encoding = response.apparent_encoding
            content_html = etree.HTML(response.text)

            # 根据实际页面结构调整XPath
            news_items = content_html.xpath('//*[@class="news-"]//li')
            if not news_items:
                news_items = content_html.xpath('//div[@class="main-content"]//a')

            result = []
            for item in news_items[:limit]:
                title_elem = item.xpath(".//span[@class='txt-title']//text()")
                if not title_elem:
                    title_elem = item.xpath(".//text()")

                title = "".join([t.strip() for t in title_elem if t.strip()])
                if not title or len(title) < 5:
                    continue

                link = item.get("href", "")
                if not link:
                    link_elem = item.xpath(".//@href")
                    link = link_elem[0] if link_elem else ""

                result.append({
                    "title": title,
                    "article_url": link if link.startswith("http") else f"https://news.sina.com.cn{link}",
                    "cover_url": "",
                    "pub_time": datetime.now().strftime("%Y-%m-%d"),
                    "source": self.source_name,
                    "category": "国际",
                    "channel": "国际"
                })

            return result
        except Exception as e:
            print(f"新浪国际获取失败: {e}")
            return []

    def get_news_info(self, item, category=None):
        """获取新浪国际新闻详情"""
        try:
            response = requests.get(item["article_url"], headers=self.headers, timeout=10)
            response.encoding = response.apparent_encoding
            content_html = etree.HTML(response.text)

            # 根据实际页面结构调整XPath
            content_div = content_html.xpath('//*[@id="article-content"]')
            if not content_div:
                content_div = content_html.xpath('//*[@class="article"]')
            if not content_div:
                content_div = content_html.xpath('//*[@id="cont_0_0"]')

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
                "category": "国际",
            }
        except Exception as e:
            print(f"获取新浪详情失败: {e}")
        return None