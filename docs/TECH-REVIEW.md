# 技术评审

---

## v0.17 — 待修 Bug

对应需求：[PRODUCT-REQUIREMENTS.md v0.17](PRODUCT-REQUIREMENTS.md#v017--关键词引擎修复)

### 🔴 v0.17-B1: 去重截断 `word[:3]` 后当作输出词

**文件：** `server/main.py` line 441（`extract_phrases_yake`）

```python
# 去重 key 取前 3 字符
key = word[:3] if len(word) >= 3 else word
# ...
for key, (score, sources) in seen.items():
    word = key  # ← BUG: 截断的 key 当作最终关键词
```

**问题：** 所有关键词被截成 3 字符。`"Mysterious"` → `"Mys"`，`"Coding"` → `"Cod"`。

**修复：** 去重时保留原始词，key 仅用于判重：
```python
seen[key] = (score, sources, word)  # 保留原始 word
# 构建结果时用原始 word，不用 key
```

---

### 🔴 v0.17-B2: 英文标题硬过中文 jieba + YAKE(zh) 管道

**文件：** `server/main.py` line 353-425（`preprocess_for_yake` + `extract_phrases_yake`）

```python
words = jieba.lcut(text)        # jieba 不懂英文，切碎 "Intelligence" → "Int" "elli" "gence"
kw_extractor = yake.KeywordExtractor(lan="zh", ...)  # 中文模式处理英文
```

**问题：** HackerNews 等英文源标题被 jieba 切成碎片，YAKE 中文模式再拼出垃圾短语。

**修复：** 语言检测分流。中文 → jieba+YAKE(zh)，英文 → YAKE(en) 直接处理。

---

### 🔴 v0.17-B3: preprocess_for_yake 标点正则损坏

**文件：** `server/main.py` line 371

```python
if re.match(r'^[，。？！、；：""''【】《》（）\[\]{}]+…—\-·,.?!;:%]+\$', w):
```

**问题：** 字符类在 `}` 处闭合，`+…—\-·` 等成了字面量序列。`\$` 是字面 `$` 非行尾。单个中文标点永远不匹配。

**修复：**
```python
if re.match(r'^[，。？！、；：""''【】《》（）\[\]{}\+…—\-·,.?!;:%]+$', w):
```

---

### 🔴 v0.17-B4: runAll 内容生成节点读不到上游热词

**文件：** `src/hooks/useWorkflowStore.ts` line 422-427

```typescript
case 'contentGenerate': {
  const selectedKws = nodeData.selectedKeywords as Keyword[] || [];  // 读自己 → 永远空
```

**问题：** `runAll` 把热词写到 `hotwordList` 节点，但 `runNode('contentGenerate')` 从自身 data 读 → 空 → 报错。

**修复：** 从上游边读取（与 `inputNews` 读取模式一致）：
```typescript
case 'contentGenerate': {
  let selectedKws = nodeData.selectedKeywords as Keyword[] || [];
  if (selectedKws.length === 0) {
    for (const edge of incomingEdges) {
      const sourceNode = get().nodes.find(n => n.id === edge.source);
      if (sourceNode?.data?.selectedKeywords?.length) {
        selectedKws = sourceNode.data.selectedKeywords as Keyword[];
        break;
      }
    }
  }
```

---

### 🟠 v0.17-B5: is_valid_keyphrase 正则 `\$`

**文件：** `server/main.py` line 382

```python
if re.match(r'^[\d.%]+\$', word):
```

**问题：** `\$` 是字面 `$`，`"42"` 不会被过滤。

**修复：** `r'^[\d.%]+$'`

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

---

## 架构备注

- CORS 收紧、输入验证、请求超时全覆盖
- SQLite 写锁 + context manager
- 草稿存储统一后端 API
- 15 个爬虫全部注册
