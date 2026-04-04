---
description: "代码评审：验收修复 + 深度审查 + 架构建议，更新 TECH-REVIEW"
agent: "agent"
---
请执行代码评审，更新 `docs/TECH-REVIEW.md`。

## 流程

1. **验收最新改动** — 读 `docs/CHANGELOG.md` 最新版本，逐条去源码中确认修复是否正确
2. **深度审查代码** — 重点扫描以下高频出 bug 区域：
   - `src/hooks/useWorkflowStore.ts` — runAll/runNode state 读取、闭包问题
   - `src/components/` — useCallback/useEffect 依赖、数据流传递
   - `server/main.py` — 正则表达式、API 响应格式
   - `server/crawlers/*.py` — import、XPath/选择器健壮性
   - `src/services/crawlerApi.ts` — API 调用 success 检查
3. **架构与实现评估** — 从整体设计角度给出建议（数据流合理性、模块耦合度、扩展性）

## 更新 TECH-REVIEW.md 规则

- 已修复的 bug → 移入「已验证修复」表格，标 ✅
- 新发现的 bug → 写入「未修复 Bug」章节，格式如下：
  ```
  ### 🔴/🟠/🟡 B{N}: {标题}
  **文件：** `{路径}` line {行号}
  **当前代码：** （代码片段）
  **问题分析：** （为什么是 bug）
  **修复：** （修复后的代码）
  ```
- 架构建议 → 简要写入独立章节，每条一句话 + 理由
- 文档保持简洁，不写冗余描述
