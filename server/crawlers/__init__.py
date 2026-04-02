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

__all__ = [
    "WangYiSpider",
    "PengPaiSpider",
    "TengXunSpider",
    "TengXunTiYuSpider",
    "SouHuSpider",
    "ITHomeSpider",
    "XinLangSpider",
    "ZhongGuoRiBaoSpider",
]
