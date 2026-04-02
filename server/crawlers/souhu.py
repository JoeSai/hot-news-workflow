#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
搜狐新闻爬虫
"""
import ast
import re
from datetime import datetime, timedelta

import requests
from lxml import etree


class SouHuSpider:
    """搜狐新闻爬虫"""
    source_name = "搜狐"
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }

    # 分类配置
    category_list = [
        {"name": "时政", "code": "438647_15", "classify": "时政"},
        {"name": "国际", "code": "1649_13", "classify": "国际"},
        {"name": "财经", "code": "54401_15", "classify": "财经"},
        {"name": "科技", "code": "666_13", "classify": "科技"},
        {"name": "娱乐", "code": "55955_15", "classify": "娱乐"},
        {"name": "体育", "code": "477_13", "classify": "体育"},
        {"name": "教育", "code": "659_13", "classify": "教育"},
        {"name": "健康", "code": "879_13", "classify": "健康"},
    ]

    def parse_relative_time(self, relative_time: str) -> str:
        """将相对时间转换为标准时间格式"""
        now = datetime.now()

        if match := re.match(r"(\d+)秒前", relative_time):
            seconds = int(match.group(1))
            result_time = now - timedelta(seconds=seconds)
        elif match := re.match(r"(\d+)分钟前", relative_time):
            minutes = int(match.group(1))
            result_time = now - timedelta(minutes=minutes)
        elif match := re.match(r"(\d+)小时前", relative_time):
            hours = int(match.group(1))
            result_time = now - timedelta(hours=hours)
        elif match := re.match(r"昨天(\d{2}):(\d{2})", relative_time):
            hour, minute = map(int, match.groups())
            result_time = now - timedelta(days=1)
            result_time = result_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
        elif match := re.match(r"前天(\d{2}):(\d{2})", relative_time):
            hour, minute = map(int, match.groups())
            result_time = now - timedelta(days=2)
            result_time = result_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
        elif match := re.match(r"(\d+)天前", relative_time):
            days = int(match.group(1))
            result_time = now - timedelta(days=days)
        else:
            return relative_time

        return result_time.strftime("%Y-%m-%d %H:%M:%S")

    def get_news_list(self, limit=20):
        """获取搜狐新闻列表"""
        all_news = []

        for cat in self.category_list:
            try:
                productId, productType = cat["code"].split("_")
                json_data = {
                    "mainContent": {
                        "productType": "13",
                        "productId": "1524",
                        "secureScore": "50",
                        "categoryId": "47",
                    },
                    "resourceList": [{
                        "tplCompKey": "TPLFeedMul_2_9_feedData",
                        "isServerRender": False,
                        "isSingleAd": False,
                        "configSource": "mp",
                        "content": {
                            "productId": productId,
                            "productType": productType,
                            "size": 20,
                            "pro": "0,1",
                            "feedType": "XTOPIC_LATEST",
                            "view": "feedMode",
                            "innerTag": "channel",
                            "spm": "smpc.channel_114.block3_77_O0F7zf_1_fd",
                            "page": 1,
                            "requestId": f"{int(time.time() * 1000)}Adk66ZV_1524",
                        },
                    }],
                }

                response = requests.post(
                    "https://odin.sohu.com/odin/api/blockdata",
                    headers=self.headers,
                    json=json_data,
                    timeout=10
                )

                data = response.json()
                data_list = data["data"]["TPLFeedMul_2_9_feedData"]["list"]

                for item in data_list[:limit // 2]:
                    if item.get("icon") in ["images", "video"]:
                        continue

                    date_str = ""
                    if item.get("extraInfoList"):
                        date_str = item["extraInfoList"][1].get("text", "") if len(item["extraInfoList"]) > 1 else ""
                        date_str = self.parse_relative_time(date_str)

                    cover = item.get("cover", [])
                    cover_url = f"https:{cover[0]}" if cover and "https:" not in cover[0] else (cover[0] if cover else "")

                    all_news.append({
                        "title": item.get("title", ""),
                        "article_url": f"https://www.sohu.com{item.get('url', '')}",
                        "cover_url": cover_url,
                        "pub_time": date_str,
                        "source": self.source_name,
                        "category": cat["classify"],
                        "channel": cat["name"]
                    })
            except Exception as e:
                print(f"搜狐 {cat['name']} 获取失败: {e}")

        # 按时间排序
        all_news.sort(key=lambda x: x["pub_time"], reverse=True)
        return all_news[:limit]

    def get_news_info(self, item, category=None):
        """获取搜狐新闻详情"""
        try:
            article_url = item["article_url"]
            response = requests.get(article_url, headers=self.headers, timeout=10)
            content_html = etree.HTML(response.text)

            article_element = content_html.xpath('//article[@id="mp-editor"]')
            if not article_element:
                return None

            article_element = article_element[0]

            # 获取时间
            if not item.get("pub_time"):
                try:
                    date_str = content_html.xpath('//span[@id="news-time"]/text()')[0].strip()
                except:
                    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                date_str = item["pub_time"]

            # 移除广告元素
            for ad in article_element.xpath('.//a[@id="backsohucom"]'):
                ad.getparent().remove(ad)

            # 提取文本
            text_list = [
                p.xpath("string(.)").strip()
                for p in article_element.xpath('.//p[not(contains(., "责任编辑"))]')
                if p.xpath("string(.)").strip()
            ]

            # 提取图片
            match = re.search(r"imgsList:\s*(\[[^\]]+\])", response.text, re.DOTALL)
            img_list = []
            if match:
                try:
                    imgs_list_str = match.group(1)
                    img_list = ast.literal_eval(imgs_list_str)
                    img_list = [
                        f"https:{img['url']}" if "https:" not in img.get("url", "") else img["url"]
                        for img in img_list
                    ]
                except:
                    pass

            article_info = "\n".join(text_list)
            if not article_info:
                return None

            return {
                "title": item["title"],
                "article_url": article_url,
                "cover_url": item.get("cover_url", ""),
                "pub_time": date_str,
                "article_info": article_info,
                "img_list": img_list,
                "category": category or item.get("category", ""),
            }
        except Exception as e:
            print(f"获取搜狐详情失败: {e}")
        return None