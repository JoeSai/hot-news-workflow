#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
网易新闻爬虫
"""
import json
import re
from datetime import datetime

import requests
from lxml import etree


class WangYiSpider:
    """网易新闻爬虫"""
    source_name = "网易"
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }

    # 分类配置
    category_list = [
        {"name": "时事热点", "code": "https://news.163.com/special/cm_yaowen20200213/?callback=data_callback", "classify": "时事热点"},
        {"name": "军事", "code": "https://news.163.com/special/cm_war/?callback=data_callback", "classify": "军事"},
        {"name": "社会", "code": "https://news.163.com/special/cm_guonei/?callback=data_callback", "classify": "社会"},
        {"name": "科技", "code": "https://tech.163.com/special/00097UHL/tech_datalist.js?callback=data_callback", "classify": "科技"},
        {"name": "娱乐", "code": "https://ent.163.com/special/000381Q1/newsdata_movieidx.js?callback=data_callback", "classify": "娱乐"},
        {"name": "财经", "code": "https://money.163.com/special/00259K2L/data_stock_redian.js?callback=data_callback", "classify": "财经"},
        {"name": "教育", "code": "https://edu.163.com/special/002987KB/newsdata_edu_hot.js?callback=data_callback", "classify": "教育"},
        {"name": "生活", "code": "https://baby.163.com/special/003687OS/newsdata_hot.js?callback=data_callback", "classify": "生活"},
    ]

    def get_news_list(self, limit=20):
        """获取网易新闻列表"""
        all_news = []
        for cat in self.category_list:
            try:
                url = cat["code"]
                params = {"callback": "data_callback"}
                response = requests.get(url, params=params, headers=self.headers, timeout=10)
                res = response.text.replace("data_callback(", "")[0:-1]
                data_str = json.loads(res.rstrip(",\n ]").strip() + "]")

                for item in data_str[:limit // 2]:
                    if "video" not in item.get("docurl", "") and item.get("title"):
                        try:
                            pub_time = datetime.strptime(item["time"], "%m/%d/%Y %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
                        except:
                            pub_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                        all_news.append({
                            "title": item["title"],
                            "article_url": item["docurl"],
                            "cover_url": item.get("imgurl", ""),
                            "pub_time": pub_time,
                            "source": self.source_name,
                            "category": cat["classify"],
                            "channel": cat["name"]
                        })
            except Exception as e:
                print(f"网易 {cat['name']} 获取失败: {e}")

        # 去重
        seen = set()
        unique_news = []
        for n in all_news:
            if n["article_url"] not in seen:
                seen.add(n["article_url"])
                unique_news.append(n)

        return unique_news[:limit]

    def get_news_info(self, item, category=None):
        """获取网易新闻详情"""
        title = item["title"]
        article_url = item["article_url"]
        cover_url = item.get("cover_url", "")

        if "video" in article_url:
            return None

        try:
            content = requests.get(article_url, headers=self.headers, timeout=10)
            content_html = etree.HTML(content.text)

            try:
                date_str = content_html.xpath('//*[@id="contain"]/div[2]/div[2]/text()')[0].strip().replace("　来源:", "")
            except:
                try:
                    date_str = content_html.xpath('//*[@id="container"]/div[1]/div[2]/text()[1]')[0].strip().replace("　来源:", "")
                except:
                    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            match = re.search(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", date_str)
            if match:
                date_str = datetime.strptime(match.group(), "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
            else:
                date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            img_list = content_html.xpath('//*[@id="content"]/div[2]/p/img/@src')
            txt = content_html.xpath('//*[@id="content"]/div[2]/p')

            article_info = ""
            for p in txt:
                t = p.xpath(".//text()")
                for i in t:
                    article_info += i + "\n"

            if len(article_info) > 0 and "徙" not in article_info:
                return {
                    "title": title,
                    "article_url": article_url,
                    "cover_url": cover_url,
                    "pub_time": date_str,
                    "article_info": article_info,
                    "img_list": img_list,
                    "category": category or item.get("category", ""),
                }
        except Exception as e:
            print(f"获取网易详情失败: {e}")
        return None