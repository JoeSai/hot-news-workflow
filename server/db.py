# -*- coding: utf-8 -*-
"""
数据库模块 - SQLite 持久化
线程安全版本
"""
import sqlite3
import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "data.db"

# 写入锁 - 保证多线程写入安全
_write_lock = threading.Lock()


def get_db():
    """获取数据库连接（读操作专用）"""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db_write():
    """获取数据库连接（写操作专用，自动加锁）"""
    with _write_lock:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def init_db():
    """初始化数据库表"""
    with get_db_write() as conn:
        cursor = conn.cursor()

        # 草稿表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                keywords TEXT NOT NULL,
                titles TEXT NOT NULL,
                body TEXT NOT NULL,
                tags TEXT NOT NULL,
                style TEXT NOT NULL
            )
        """)

        # 抓取历史表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawl_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                platform TEXT NOT NULL,
                news_count INTEGER NOT NULL,
                news_data TEXT NOT NULL
            )
        """)

        # 工作流配置表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workflow_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                config TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # 关键词趋势表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS keyword_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recorded_date TEXT NOT NULL,
                keyword TEXT NOT NULL,
                weight REAL NOT NULL,
                count INTEGER DEFAULT 1,
                source TEXT NOT NULL,
                UNIQUE(recorded_date, keyword)
            )
        """)

        # 内容效果记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS content_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id TEXT,
                draft_title TEXT,
                keywords TEXT,
                style TEXT,
                published_at TEXT,
                platform TEXT DEFAULT '小红书',
                likes INTEGER DEFAULT 0,
                collects INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        """)


def save_draft(keywords: List[str], titles: List[str], body: str, tags: List[str], style: str) -> int:
    """保存草稿"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO drafts (created_at, keywords, titles, body, tags, style) VALUES (?, ?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), json.dumps(keywords, ensure_ascii=False),
             json.dumps(titles, ensure_ascii=False), body, json.dumps(tags, ensure_ascii=False), style)
        )
        return cursor.lastrowid


def get_drafts(limit: int = 50) -> List[Dict[str, Any]]:
    """获取草稿列表"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_draft(draft_id: int) -> Optional[Dict[str, Any]]:
    """获取单个草稿"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_draft(draft_id: int) -> bool:
    """删除草稿"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM drafts WHERE id = ?", (draft_id,))
        return cursor.rowcount > 0


def save_crawl_history(platform: str, news_count: int, news_data: List[Dict]) -> int:
    """保存抓取历史"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO crawl_history (created_at, platform, news_count, news_data) VALUES (?, ?, ?, ?)",
            (datetime.now().isoformat(), platform, news_count, json.dumps(news_data, ensure_ascii=False))
        )
        return cursor.lastrowid


def get_crawl_history(limit: int = 30) -> List[Dict[str, Any]]:
    """获取抓取历史"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM crawl_history ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def save_workflow_config(name: str, config: Dict) -> bool:
    """保存工作流配置"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO workflow_configs (name, config, updated_at) VALUES (?, ?, ?)",
            (name, json.dumps(config, ensure_ascii=False), datetime.now().isoformat())
        )
        return True


def get_workflow_config(name: str) -> Optional[Dict]:
    """获取工作流配置"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT config FROM workflow_configs WHERE name = ?", (name,))
        row = cursor.fetchone()
        return json.loads(row["config"]) if row else None
    finally:
        conn.close()


def save_keyword_trends(keywords: List[Dict], source: str = "crawl") -> int:
    """保存关键词趋势快照（按日期）"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        today = datetime.now().strftime("%Y-%m-%d")
        saved = 0
        for kw in keywords:
            cursor.execute(
                """INSERT OR REPLACE INTO keyword_trends
                   (recorded_date, keyword, weight, count, source)
                   VALUES (?, ?, ?, ?, ?)""",
                (today, kw.get("word", kw.get("keyword", "")), kw.get("weight", 0), kw.get("count", 1), source)
            )
            saved += 1
        return saved


def get_keyword_trends(keywords: List[str] = None, days: int = 7) -> Dict[str, List[Dict]]:
    """获取关键词趋势数据"""
    conn = get_db()
    try:
        cursor = conn.cursor()

        if keywords:
            placeholders = ",".join(["?"] * len(keywords))
            cursor.execute(
                f"""SELECT keyword, recorded_date, weight, count
                    FROM keyword_trends
                    WHERE keyword IN ({placeholders})
                      AND recorded_date >= date('now', ?)
                    ORDER BY recorded_date ASC""",
                keywords + [f"-{days} days"]
            )
        else:
            # 返回最近有数据的关键词
            cursor.execute(
                """SELECT DISTINCT keyword FROM keyword_trends
                   WHERE recorded_date >= date('now', ?)
                   ORDER BY keyword""",
                (f"-{days} days",)
            )
            keyword_rows = cursor.fetchall()
            if not keyword_rows:
                return {}
            keywords = [row["keyword"] for row in keyword_rows]
            placeholders = ",".join(["?"] * len(keywords))
            cursor.execute(
                f"""SELECT keyword, recorded_date, weight, count
                    FROM keyword_trends
                    WHERE keyword IN ({placeholders})
                      AND recorded_date >= date('now', ?)
                    ORDER BY recorded_date ASC""",
                keywords + [f"-{days} days"]
            )

        rows = cursor.fetchall()

        # 按关键词分组
        result: Dict[str, List[Dict]] = {kw: [] for kw in keywords}
        for row in rows:
            kw = row["keyword"]
            if kw in result:
                result[kw].append({
                    "date": row["recorded_date"],
                    "weight": row["weight"],
                    "count": row["count"]
                })

        return result
    finally:
        conn.close()


# ==================== 内容效果记录 CRUD ====================

def save_content_record(
    draft_id: str = None,
    draft_title: str = None,
    keywords: List[str] = None,
    style: str = "",
    published_at: str = "",
    platform: str = "小红书",
    likes: int = 0,
    collects: int = 0,
    comments: int = 0,
    shares: int = 0,
    notes: str = ""
) -> int:
    """保存内容效果记录"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO content_records
               (draft_id, draft_title, keywords, style, published_at, platform,
                likes, collects, comments, shares, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (draft_id, draft_title, json.dumps(keywords or [], ensure_ascii=False),
             style, published_at, platform, likes, collects, comments, shares,
             notes, datetime.now().isoformat())
        )
        return cursor.lastrowid


def get_content_records(limit: int = 50) -> List[Dict[str, Any]]:
    """获取内容效果记录列表"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM content_records ORDER BY id DESC LIMIT ?", (limit,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_content_record(record_id: int) -> Optional[Dict[str, Any]]:
    """获取单条内容效果记录"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM content_records WHERE id = ?", (record_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_content_record(record_id: int) -> bool:
    """删除内容效果记录"""
    with get_db_write() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM content_records WHERE id = ?", (record_id,)
        )
        return cursor.rowcount > 0


def get_content_stats() -> Dict[str, Any]:
    """获取内容效果统计"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(likes) as total_likes,
                   SUM(collects) as total_collects,
                   SUM(comments) as total_comments,
                   SUM(shares) as total_shares,
                   AVG(likes) as avg_likes,
                   AVG(collects) as avg_collects,
                   AVG(comments) as avg_comments,
                   AVG(shares) as avg_shares
            FROM content_records
        """)
        row = cursor.fetchone()

        # 按 style 分组统计
        cursor.execute("""
            SELECT style,
                   COUNT(*) as count,
                   AVG(likes) as avg_likes,
                   AVG(collects) as avg_collects,
                   AVG(comments) as avg_comments,
                   AVG(shares) as avg_shares
            FROM content_records
            WHERE style != ''
            GROUP BY style
        """)
        style_rows = cursor.fetchall()

        return {
            "total": row["total"] or 0,
            "total_likes": row["total_likes"] or 0,
            "total_collects": row["total_collects"] or 0,
            "total_comments": row["total_comments"] or 0,
            "total_shares": row["total_shares"] or 0,
            "avg_likes": round(row["avg_likes"] or 0, 2),
            "avg_collects": round(row["avg_collects"] or 0, 2),
            "avg_comments": round(row["avg_comments"] or 0, 2),
            "avg_shares": round(row["avg_shares"] or 0, 2),
            "by_style": [dict(r) for r in style_rows]
        }
    finally:
        conn.close()


# 初始化数据库
init_db()
