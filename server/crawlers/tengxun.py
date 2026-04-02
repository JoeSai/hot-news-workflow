#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
腾讯新闻爬虫
"""
import time
from datetime import datetime

import requests
from lxml import etree


class TengXunSpider:
    """腾讯新闻爬虫"""
    source_name = "腾讯"
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    # 分类配置
    category_list = [
        {"name": "科技", "code": "news_news_tech", "classify": "科技"},
        {"name": "财经", "code": "news_news_finance", "classify": "财经"},
        {"name": "娱乐", "code": "news_news_ent", "classify": "娱乐"},
        {"name": "国际", "code": "news_news_world", "classify": "国际"},
        {"name": "军事", "code": "news_news_mil", "classify": "军事"},
        {"name": "游戏", "code": "news_news_game", "classify": "游戏"},
        {"name": "汽车", "code": "news_news_auto", "classify": "汽车"},
        {"name": "教育", "code": "news_news_edu", "classify": "教育"},
    ]

    def get_news_list(self, limit=20):
        """获取腾讯新闻列表"""
        all_news = []

        for cat in self.category_list:
            try:
                json_data = {
                    "base_req": {"from": "pc"},
                    "forward": "2",
                    "qimei36": "0_C47K1MESdC7T6",
                    "device_id": "0_C47K1MESdC7T6",
                    "flush_num": 1,
                    "channel_id": cat["code"],
                    "item_count": 12,
                    "is_local_chlid": "0",
                }

                response = requests.post(
                    "https://i.news.qq.com/web_feed/getPCList",
                    headers=self.headers,
                    json=json_data,
                    timeout=10
                )

                items = response.json().get("data", [])
                for item in items[:limit // 2]:
                    if item.get("sub_item"):  # 跳过子项
                        continue

                    pic_info = item.get("pic_info", {})
                    big_img = pic_info.get("big_img", "") if isinstance(pic_info, dict) else ""

                    all_news.append({
                        "title": item.get("title", ""),
                        "article_url": f"https://news.qq.com/rain/a/{item.get('id', '')}",
                        "cover_url": big_img,
                        "pub_time": item.get("publish_time", ""),
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"腾讯 {cat['name']} 获取失败: {e}")

        # 按时间排序
        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item, category=None):
        """获取腾讯新闻详情"""
        try:
            article_url = item["article_url"]
            response = requests.get(article_url, headers=self.headers, timeout=10)
            content_html = etree.HTML(response.text)

            content = content_html.xpath('//*[@id="article-content"]/div[2]/div/p')
            img_list = []
            article_info = ""

            for info in content:
                try:
                    img = info.xpath(".//img/@src")
                    if len(img) > 0:
                        img_list.append(img[0])
                except:
                    pass
                txt = info.xpath(".//text()")
                for i in txt:
                    article_info += i + "\n"

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
            print(f"获取腾讯详情失败: {e}")
        return None


class TengXunTiYuSpider:
    """腾讯体育爬虫"""
    source_name = "腾讯体育"
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    }

    def get_news_list(self, limit=20):
        """获取腾讯体育新闻列表"""
        try:
            json_data = {
                "base_req": {"from": "pc"},
                "forward": "2",
                "channel_id": "sports",
                "item_count": limit,
            }

            response = requests.post(
                "https://i.news.qq.com/web_feed/getPCList",
                headers=self.headers,
                json=json_data,
                timeout=10
            )

            items = response.json().get("data", [])
            result = []
            for item in items[:limit]:
                pic_info = item.get("pic_info", {})
                big_img = pic_info.get("big_img", "") if isinstance(pic_info, dict) else ""

                result.append({
                    "title": item.get("title", ""),
                    "article_url": f"https://news.qq.com/rain/a/{item.get('id', '')}",
                    "cover_url": big_img,
                    "pub_time": item.get("publish_time", ""),
                    "source": self.source_name,
                    "category": "体育",
                    "channel": "体育"
                })
            return result
        except Exception as e:
            print(f"腾讯体育获取失败: {e}")
            return []

    def get_news_info(self, item, category=None):
        """获取腾讯体育新闻详情"""
        try:
            response = requests.get(item["article_url"], headers=self.headers, timeout=10)
            content_html = etree.HTML(response.text)

            content = content_html.xpath('//*[@id="article-content"]/div[2]/div/p')
            img_list = []
            article_info = ""

            for info in content:
                try:
                    img = info.xpath(".//img/@src")
                    if len(img) > 0:
                        img_list.append(img[0])
                except:
                    pass
                txt = info.xpath(".//text()")
                for i in txt:
                    article_info += i + "\n"

            return {
                "title": item["title"],
                "article_url": item["article_url"],
                "cover_url": item.get("cover_url", ""),
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info,
                "img_list": img_list,
                "category": "体育",
            }
        except Exception as e:
            print(f"获取腾讯体育详情失败: {e}")
        return None