# 阻塞项记录

> 记录需要外部协调或基础设施的卡点。阻塞解除后删除此条目。

---

## v0.17 — AI 供应商全局设置

**v0.17-R5: AI 供应商全局设置**

统一 API Key 配置，所有节点共用。

- db.py 已新增 `global_settings` 表 + `get_global_settings()` / `save_global_settings()`
- 后端 API 端点：待加（`/api/settings` GET/POST）
- 前端设置界面：待开发

**阻塞：** 无。新增 `/api/generate` 端点（`edbd3dd`），现在可以做 v0.17-R5。

**状态：** 🟡 进行中

---

*最后更新：2026-04-05*
