# 阻塞项记录

> 记录需要外部协调或基础设施的卡点，等待产品经理/运营/架构师回复后推进。

---

## v0.17 — 关键词引擎修复

### v0.17-R3: 英文关键词翻译为中文

**阻塞：** 需要 LLM API 翻译能力。

**方案确认：** 后端已有 `call_openai_compatible_api()`（`server/main.py` line 524），支持 DeepSeek/MiniMax/OpenAI 等所有 OpenAI 兼容格式。翻译只需复用此函数，不用新建基础设施。

**实现路径：**
1. 在 `/api/keywords` 返回结果前，检测英文关键词（已有语言检测逻辑）
2. 批量拼 prompt：`"将以下英文关键词翻译为中文，每行一个：\n{keywords}"`
3. 调用 `call_openai_compatible_api()`，解析返回
4. API Key 来源：复用前端传来的 key（和内容生成共用），或读环境变量 `LLM_API_KEY`

**已确认：**
- LLM：MiniMax-M2.7（`https://api.minimaxi.chat/v1`）
- API Key：已写入 `.env`（`LLM_API_KEY`）
- 所有 AI 服务（翻译、内容生成、后续图片描述等）统一用 MiniMax-M2.7

**前置需求：** 需要先做「AI 供应商全局设置」（v0.17-R5），让后端读 `.env` 配置，前端提供设置界面。

**状态：** ✅ 已解除阻塞，可开发

---

## v0.18 — 选题推荐重构

### v0.18-R1: 选题推荐与热词列表合并

**阻塞：** 合并后 UI 交互方式需确认。

**方案确认：** 合并为一个「智能选题」节点，分两个区域：

```
┌─ 智能选题 ─────────────────────┐
│ 📊 推荐选题（自动，按评分排序）  │
│  ☑ AI Agent 应用落地  92%      │
│  ☐ 芯片短缺影响      78%      │
│  ☐ 大模型开源趋势    65%      │
│                                │
│ 🔥 全部热词（可手动增删选）     │
│  AI Agent  芯片  开源  ...     │
│                                │
│ [✓ 确认选词 → 传递给内容生成]   │
└────────────────────────────────┘
```

- 上半部：推荐选题（重写评分后），点击直接选中
- 下半部：全部热词列表（保留手动增删、复制功能）
- 底部：确认按钮，选中的词流向下游 `contentGenerate`
- runAll 时自动取推荐 TOP 5，不需要用户操作

**状态：** ✅ 方案已确认，可开发

---

### v0.18-R2: 重写评分算法

**阻塞：** 需要真实运营数据。

**方案确认：** 不等数据，先用改进的规则算法替换当前全 100% 的评分：

| 维度 | 权重 | 逻辑 |
|------|------|------|
| 多源出现 | 40% | 同一关键词出现在 ≥2 个平台，热度更高 |
| AI 赛道相关 | 30% | 保留关键词匹配，但降低单次匹配分值（+15 → 不会一个词就满分） |
| 时效性 | 20% | 近 24h 新闻优先 |
| 短语质量 | 10% | 2-4 字短语 > 单字，过长短语降分 |

后续有运营数据后再微调权重。

**状态：** ✅ 方案已确认，可开发

---

### v0.18-R3: 纳入 runAll & v0.18-B1/B2/B3

**依赖 R1 合并完成后一起做。**

**状态：** 🟡 待 R1

---

## v0.19 — 封面图 AI 生成

### v0.19-R1: 接入 MiniMax image-01

**原阻塞：** 需要 Google API Key + 确认调用方式。

**方案变更：** 不接 Google Imagen，统一用 MiniMax Token Plan（已有 API Key）。

**MiniMax image-01 接口信息：**
- **Endpoint:** `POST https://api.minimaxi.com/v1/image_generation`
- **Auth:** `Authorization: Bearer {LLM_API_KEY}`（复用同一个 key）
- **Model:** `image-01`（文生图 + 图生图）
- **参数：** `model`, `prompt`, `aspect_ratio`（如 `"3:4"` 对应小红书封面比例）, `response_format: "base64"`
- **返回：** `data.image_base64[]`（base64 编码的 JPEG）

**示例调用：**
```python
payload = {
    "model": "image-01",
    "prompt": "AI科技感封面，标题：大模型开源趋势",
    "aspect_ratio": "3:4",
    "response_format": "base64",
}
response = requests.post(url, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
images = response.json()["data"]["image_base64"]
```

**状态：** ✅ 已解除阻塞，可开发

---

*最后更新：2026-04-05*
