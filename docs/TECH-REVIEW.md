# 技术评审

---

## 待修 Bug（仅保留未闭环）

（暂无）

---

## 已修复

| 编号 | 问题 | 修复版本 |
|------|------|----------|
| v0.11-B1 | SQLite 并发安全 | v0.11 |
| v0.11-B2 | 草稿双写 | v0.11 |
| v0.11-B3 | Run All 交互节点自动取 TOP 5 | v0.11 |
| v0.11-B4 | Store 无用字段删除 | v0.11 |
| v0.12-B1 | fetchWithTimeout 全覆盖 | v0.12 |
| v0.13-B1 | 新节点加入面板 | v0.13 |
| v0.13-B2 | 后端输入验证 | v0.13 |
| v0.13-B3 | 删除 500ms setTimeout | v0.13 |
| v0.13-B4 | TrendNode useEffect 依赖 | v0.13 |
| v0.13-B5 | CORS 收紧 | v0.13 |
| v0.14-B1 | weibo.py lxml import | v0.14 |
| v0.14-B2 | runAll stale state | v0.14 |
| v0.14-B3 | getNextNodeId 闭包 | v0.14 |
| v0.14-B4 | 澎湃 XPath 脆弱 | v0.14 |
| v0.17-B1 | 关键词去重截断输出 | v0.17 |
| v0.17-B2 | 英文关键词走中文管道 | v0.17 |
| v0.17-B3 | preprocess 标点正则损坏 | v0.17 |
| v0.17-B4 | runAll 读不到上游 selectedKeywords | v0.17 |
| v0.17-B5 | is_valid_keyphrase 行尾正则错误 | v0.17 |
| v0.18-B1 | 选题推荐评分区分度不足 | v0.18 |
| v0.18-B3 | topicRecommend 未纳入 runAll | v0.18 |
| v0.18-B2 | 选题推荐输出是死胡同 | v0.18 |
| v0.18-B4 | CoverImage 忽略上游关键词 | v0.18 |

---

## 架构备注

- CORS 收紧、输入验证、请求超时全覆盖
- SQLite 写锁 + context manager
- 草稿存储统一后端 API
- 15 个爬虫全部注册
