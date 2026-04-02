#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
IT之家爬虫
"""
from datetime import datetime

import requests
from lxml import etree


class ITHomeSpider:
    """IT之家爬虫"""
    source_name = "IT之家"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    def convert_time_str(self, time_str, date_str=None):
        """将时间字符串转换为标准日期时间格式"""
        try:
            if date_str:
                date_part = datetime.strptime(date_str, "%Y-%m-%d").date()
            else:
                date_part = datetime.now().date()

            hour, minute = map(int, time_str.strip().split())
            full_datetime = datetime.combine(date_part, datetime.min.time()).replace(
                hour=hour, minute=minute, second=0
            )
            return full_datetime.strftime("%Y-%m-%d %H:%M:%S")
        except:
            return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def get_news_list(self, limit=20):
        """获取IT之家新闻列表"""
        try:
            url = "https://www.ithome.com/"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.encoding = response.apparent_encoding
            content_html = etree.HTML(response.text)

            news_items = content_html.xpath('//*[@id="nnews"]/div[3]/ul/li')
            result = []

            for item in news_items[:limit]:
                title_elements = item.xpath(".//a")
                if not title_elements:
                    continue

                title = title_elements[0].text
                if not title:
                    continue
                title = title.strip()
                link = title_elements[0].get("href", "").strip()

                date_str = item.xpath("./b//text()")
                if date_str:
                    date_str = self.convert_time_str(date_str[0].strip())
                else:
                    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                result.append({
                    "title": title,
                    "article_url": link,
                    "cover_url": "",
                    "pub_time": date_str,
                    "source": self.source_name,
                    "category": "科技",
                    "channel": "数码"
                })

            return result
        except Exception as e:
            print(f"IT之家获取失败: {e}")
            return []

    def get_news_info(self, item, category=None):
        """获取IT之家新闻详情"""
        try:
            article_url = item["article_url"]
            response = requests.get(article_url, headers=self.headers, timeout=10)
            response.encoding = response.apparent_encoding
            content_html = etree.HTML(response.text)

            content_div = content_html.xpath('//*[@id="paragraph"]')
            if not content_div:
                return None
            content_div = content_div[0]

            # 提取文本
            text_list = content_div.xpath(
                './/p[not(@class="ad-tips") and not(descendant::dir)]/text()'
            )

            # 提取图片
            data_original_list = content_div.xpath(
                './/p[not(@class="ad-tips") and not(descendant::dir)]//img/@data-original'
            )
            src_list = content_div.xpath(
                './/p[not(@class="ad-tips") and not(descendant::dir)]//img/@src'
            )

            img_list = []
            for data_original, src in zip(data_original_list, src_list):
                if data_original and not data_original.strip().startswith("//"):
                    img_url = data_original.strip()
                elif data_original and data_original.strip().startswith("//"):
                    img_url = "https:" + data_original.strip()
                else:
                    img_url = src.strip() if src else ""
                    if img_url.startswith("//"):
                        img_url = "https:" + img_url
                if img_url:
                    img_list.append(img_url)

            article_info = "".join([t.strip() + "\n" for t in text_list if t.strip()])

            if not article_info or len(article_info) < 50:
                return None

            return {
                "title": item["title"],
                "article_url": article_url,
                "cover_url": img_list[0] if img_list else "",
                "pub_time": item.get("pub_time", ""),
                "article_info": article_info.replace("\u3000", "").replace("\xa0", ""),
                "img_list": img_list,
                "category": "科技",
            }
        except Exception as e:
            print(f"获取IT之家详情失败: {e}")
        return None