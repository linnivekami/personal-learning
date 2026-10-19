# Knowledge Summary Mode — 知识归纳

把一门课、一个单元或一个主题整理成**可交互的单文件 HTML 知识归纳**：先看薄弱点，再看分类树，点开任一知识点即可读到核心、详解、结构判据、例子、易错点、关联和自测。它取代 v1.3 的 Mind Map Mode；导图的“展开分支、查看关联、只看薄弱点”都在 HTML 中完成。

## 何时启用

- 用户想快速了解一门课 / 单元 / 主题的知识点，或说“知识归纳 / 总览 / 知识点总结 / 复习页 / 思维导图 / 帮我把这门课梳理一下”等。只要对话内概括一份资料时用 Quick Mode（见 `modes.md`）。
- 备考时用户要“一页看完”的复习材料；Exam Mode 下可直接产出，考试目标保持不变。
- 只想问一个概念时不启用：直接解释即可。

范围沿用用户指定或当前对话已确认的 Project / 单元 / 主题；存在多个项目且无法判断时只问一次范围。跨课程总览按课程分开生成，不混合项目。

## 输入（只读）

| 来源 | 用途 |
| --- | --- |
| 课程资料（PDF / PPT / 讲义 / 作业 / 案例） | 内容唯一来源：定义、例子、数字、公式、题型。先查 `material-index.md` 定位资料 |
| `knowledge-map.md` | 分类骨架与节点 ID；卡片的 `id` / `node` 与地图节点对齐 |
| `state.md` | 掌握度、待核验标记、Weaknesses / Error Map、Memory 的 Next Review，用于徽章与“薄弱点优先” |
| `data/learner-profile.md` | 解释风格：场景与案例先行、结构判据优于符号死记、术语保留英文 |

资料不可访问时如实写入 `coverageGaps`，不得用索引标题冒充已读正文。需要补充资料外的通用知识时标为“课外补充”。

## 产出与路径

```
data/projects/<project>/summaries/<topic>.json   ← 卡片数据（plos-knowledge-summary/1）
data/projects/<project>/summaries/<topic>.html   ← 由 scripts/build_summary.py 生成
```

- `<topic>` 用小写 kebab-case，如 `midterm-overview`、`unit-3`。同一主题再生成时覆盖旧 HTML，JSON 增量修改。
- 构建命令（在 `personal-learning/` 下运行）：

```
python3 scripts/build_summary.py data/projects/<p>/summaries/<topic>.json \
  --state data/projects/<p>/state.md --map data/projects/<p>/knowledge-map.md
```

- 模板是 `assets/knowledge-summary-template.html`，字段骨架是 `assets/knowledge-summary-cards-template.json`，公开演示见 `examples/knowledge-summary-demo/`。
- 不能运行 Python 时：复制模板，把 JSON 粘进 `<script id="plos-data">`（`</` 写成 `<\/`），并手工填写 `status`（见下文）。
- `summaries/` 位于私有 `data/projects/` 下，不进入公开仓库。

## 页面结构（固定顺序）

1. **页首**：标题、范围、资料来源、考试信息（仅来自资料或用户）、状态快照日期与来源标签图例。
2. **★ 先看薄弱点**：依次为 state 记录的薄弱点 / 最近检索失败 → 到期复习（Next Review ≤ 快照日）→ 待核验的历史等级。没有证据时不把节点列为薄弱。
3. **🗂 知识分类树**：分类 → 知识点芯片，圆点颜色表示掌握度；点击直接展开对应卡片。
4. **分类与知识点卡片**：每个分类一节，卡片默认收起，点开查看详情。
5. **∑ 公式与表格**：按分类自动汇总公式（或自定义 `formulaSheet`），附查表数据，可跳回卡片。
6. **⚠ 易错点汇总**：按分类汇总，可跳回卡片。
7. **◌ 资料覆盖缺口**：提取不到的图表、扫描页、缺失讲次。

## 卡片字段

| 字段 | 要求 |
| --- | --- |
| `id` / `node` | 稳定 ID 与地图节点路径；ID 与 `knowledge-map.md` 中的 `#id` 一致。地图缺节点时提示维护或在教学中增量补地图，不另建第二套结构 |
| `title` / `en` | 中文名与英文术语（方便对照全英文讲义与考试） |
| `core` | **一句话核心**：解决什么问题、关键关系是什么 |
| `explain` | **详解**：最小充分解释，具体到抽象；英文术语加粗；行内公式写 `\( … \)`、独立公式写 `\[ … \]`（不用 `$`，美元写 `\$`） |
| `criteria` | **结构判据**：看到什么条件、方向、维度就该用它；不写“背下这个公式” |
| `why` | 为什么重要：在决策、作业或考试中的作用 |
| `example` | 例子：优先用资料中的原始数字；推算结果标“据课件计算” |
| `formulas` / `vars` | 仅在确实需要时给出，附读法或结构含义；不要求死记 |
| `traps` | 易错点：常见误解、条件方向、单位与符号 |
| `related` | 关联 / 先修：`prereq` 先修、`contrast` 对比、`apply` 应用、`derive` 推导、`part` 组成、`related` 相关 |
| `quiz` | 先答再看的自测：答案隐藏，页面说明不计入 Mastery |
| `figure` | 可选示意图：`flow` / `cycle` / `tree` / `compare` / `curve` / `svg` |
| `stateTopic` / `memoryItem` | 对应 state 中 Mastery / Memory 条目原文；无对应就省略 |
| `weak` | 薄弱原因，只能来自 state 的 Weaknesses / Error Map 或实际作答记录 |

## 来源标签（统一三种）

- `source` **课件原文**：资料中的定义、例子、数字、题目。
- `computed` **据课件计算**：资料给了数据、结果由助教推算；需可复核。
- `outside` **课外补充**：资料之外的通用知识或类比；考试以课件为准。

卡片整体用 `origin`，例子、公式、易错点、自测可单独标注。不得把补充内容写成课程要求，也不得改写资料中的数字。

## 掌握度叠加与证据边界

- 构建时从 `state.md` 读取只读快照：等级、`待按 v1.2 核验` 缺口、Next Review、最近检索失败，并注明快照日期。没有对应条目显示**未记录**，不按近似名称套用整章等级，也不记为 0。
- 一个 state 条目对应多张卡片时显示“合并”，不把同一等级拆成各节点独立评分；一张卡对应多个条目时取最低等级。
- 历史待核验等级与等级一起显示，不能写成“已掌握”。
- **生成、浏览、勾选“已复习”、做页面自测都不产生学习证据**：不改 Mastery、Confidence、Last Verified、Memory、log 或 Next Action。“已复习”只存在本机浏览器。
- 用户把自测答案发回对话后，才按现行教学流程评估并增量更新 state / log。实际讲到新知识时最多按 Quick Mode 记录明确覆盖节点的 Exposure。

## 导航（取代思维导图）

| 用户操作 | HTML 中 | 对话中 |
| --- | --- | --- |
| 展开某分支 / 某概念 | 分类树或目录点击，卡片展开 | 给出该卡的核心与链接位置 |
| 返回总览 | “返回总览”或回到分类树 | 回到分类树摘要 |
| 查看关联 | 卡片“查看关联”只显示它与关联节点 | 列出先修 / 对比 / 应用关系 |
| 只看薄弱点 / 按掌握度筛选 | “★ 薄弱 / 待复习”与掌握度下拉框 | 只列有证据的薄弱点并保留待核验说明 |
| 搜索 | 中英文、公式源码均可搜 | — |
| 解释 / 练习 / 继续学习 | — | 按意图转入 Normal / Exam 教学 |

环境不能生成文件时，可在对话中输出同结构的 Markdown 精简版（分类树 + 每点一句核心 + 薄弱点），同样只读。

## 质量检查（生成后自查）

- 每张卡都有 `core`、`explain` 和至少一条 `criteria` 或 `traps`；内容可追溯到资料或已标注来源。
- 薄弱点、待核验、未记录均来自 state 原文；构建器提示的未匹配 `stateTopic` 已处理。
- `build_summary.py --check` 通过；HTML 不引用外部脚本、字体或样式，断网可用。
- 资料中提取不到的图表、扫描页已写入 `coverageGaps`，并同步到 `material-index.md` 的“覆盖缺口”。
- 结束时告诉用户文件路径和一句话使用提示，不附强制练习；Next Action 保持原样。
