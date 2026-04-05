# 技术评审

---

## 未修复 Bug

（暂无）

---

## 已验证修复

| 编号 | 验证结论 | 状态 |
|------|----------|------|
| B1 | `saveKeywordTrends` 已增加 `data.success` 校验，失败时抛出明确错误 | ✅ |
| B2 | `getContentStats` 已增加 `result.success` 校验，避免后端异常时返回空统计 | ✅ |
| v0.18-B2 | `TopicRecommendNode` 已新增 `source` Handle，且输出 `keywords` 字段，数据链可连到下游 | ✅ |
| v0.21-R1 | 已新增 `TopicHotwordNode`，模板已迁移到合并节点，节点面板不再暴露旧「选题推荐」入口 | ✅ |
| UI 修复 | AI 设置面板已改为右上角弹层，不再默认遮挡模板按钮 | ✅ |
| v0.17-R3 | `/api/keywords` 新增英文关键词批量 LLM 翻译，`Keyword` 类型增加 `wordCn` 字段，内容生成时优先使用中文翻译 | ✅ |

---

## 架构建议

- 统一后端响应协议：所有 API 固定返回 `success` 字段，避免前端分支处理不一致。
- `runAll` 交互节点自动选词逻辑建议抽为通用函数，减少 `hotwordList/topicRecommend/topicHotword` 三处重复。
- 逐步下线 `TopicRecommendNode` 组件与类型注册，避免双实现长期并存造成维护分叉。

---

## 验收记录

- 验收基准：`docs/CHANGELOG.md` 最新版本 `v0.21`
- 构建验证：`pnpm build` 通过（TypeScript + Vite）
