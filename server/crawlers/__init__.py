# -*- coding: utf-8 -*-
"""
热点新闻爬虫模块
"""
from .wangyi import WangYiSpider
from .pengpai import PengPaiSpider
from .tengxun import TengXunSpider, TengXunTiYuSpider
from .souhu import SouHuSpider
from .ithome import ITHomeSpider
from .xinlang import XinLangSpider
from .zhongguoribao import ZhongGuoRiBaoSpider
from .weibo import WeiboSpider
from .zhihu import ZhiHuSpider
from .toutiao import ToutiaoSpider
from .kr36 import Spider36Kr
from .liangzi import LiangziSpider
from .jiqizhixin import JiQiXinSpider
from .hackernews import HackerNewsSpider

__all__ = [
    # 新闻平台
    "WangYiSpider",
    "PengPaiSpider",
    "TengXunSpider",
    "TengXunTiYuSpider",
    "SouHuSpider",
    "ITHomeSpider",
    "XinLangSpider",
    "ZhongGuoRiBaoSpider",
    # 热搜榜单
    "WeiboSpider",
    "ZhiHuSpider",
    "ToutiaoSpider",
    # AI 垂直平台
    "Spider36Kr",
    "LiangziSpider",
    "JiQiXinSpider",
    "HackerNewsSpider",
]
