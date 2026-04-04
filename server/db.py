# -*- coding: utf-8 -*-
"""
数据库模块 - SQLite 持久化
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(__file__).parent / "data.db"


def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化数据库表"""
    conn = get_db()
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

    conn.commit()
    conn.close()


def save_draft(keywords: List[str], titles: List[str], body: str, tags: List[str], style: str) -> int:
    """保存草稿"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO drafts (created_at, keywords, titles, body, tags, style) VALUES (?, ?, ?, ?, ?, ?)",
        (datetime.now().isoformat(), json.dumps(keywords, ensure_ascii=False),
         json.dumps(titles, ensure_ascii=False), body, json.dumps(tags, ensure_ascii=False), style)
    )
    draft_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return draft_id


def get_drafts(limit: int = 50) -> List[Dict[str, Any]]:
    """获取草稿列表"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drafts ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_draft(draft_id: int) -> Optional[Dict[str, Any]]:
    """获取单个草稿"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_draft(draft_id: int) -> bool:
    """删除草稿"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM drafts WHERE id = ?", (draft_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def save_crawl_history(platform: str, news_count: int, news_data: List[Dict]) -> int:
    """保存抓取历史"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO crawl_history (created_at, platform, news_count, news_data) VALUES (?, ?, ?, ?)",
        (datetime.now().isoformat(), platform, news_count, json.dumps(news_data, ensure_ascii=False))
    )
    history_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return history_id


def get_crawl_history(limit: int = 30) -> List[Dict[str, Any]]:
    """获取抓取历史"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM crawl_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def save_workflow_config(name: str, config: Dict) -> bool:
    """保存工作流配置"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO workflow_configs (name, config, updated_at) VALUES (?, ?, ?)",
        (name, json.dumps(config, ensure_ascii=False), datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return True


def get_workflow_config(name: str) -> Optional[Dict]:
    """获取工作流配置"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT config FROM workflow_configs WHERE name = ?", (name,))
    row = cursor.fetchone()
    conn.close()
    return json.loads(row["config"]) if row else None


# 初始化数据库
init_db()
