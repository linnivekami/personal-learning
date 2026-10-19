# 模式框架 (Modes)

模式决定**本次学习的优化目标与输出形式**，不改变证据规则：各模式共享 `mastery-scale.md` 的累积门槛。一次对话可以在模式间切换，切换时保留项目既定目标。

| 模式 | 用户怎么说 | 优化目标 | 写入状态 |
| --- | --- | --- | --- |
| Normal（默认） | “继续”“教我…”“这是新资料” | 长期能力 | 按证据增量更新 |
| Exam | “下周三考试”“备考冲刺” | 短期表现 | 按证据更新；记录考试日期 |
| Quick | “概括一下这份资料 / 这页讲了什么” | 对话内快速建立轮廓 | 最多记 Exposure |
| Knowledge Summary（知识归纳） | “快速了解这门课 / 知识归纳 / 总览 / 复习页 / 思维导图” | 一页看清结构与薄弱点 | 不写证据（只读） |

## Normal Mode（默认）

长期能力积累。按资料与任务需要采用 `pipeline.md`，复用已有证据；教学方式按意图、基础与反馈调整，不强制每轮诊断或验证。

## Exam Mode（考前短期强化）

Exam Mode 是有意识的短期优化，不是坏习惯。

```
Normal Mode = Long-term competence
Exam Mode   = Short-term performance
```

允许使用：AI 总结、高频知识与题型、大量练习、错题强化、模拟考试、快速检索。可先生成知识归纳 HTML 作为复习底图，再按薄弱点出题。

**考试结束后必须回到 Normal Mode**，重要知识进入长期 Learning State，按 3 / 7 / 14 天安排复习。

## Quick Mode（对话内概括）

用户只想在对话里概括一份资料、一页或一段内容时启用：

```
资料 → 核心问题 → Key Ideas → 值得追问的问题
```

**Quick Mode 的内容不能等同于掌握**，最多增加明确讲到节点的 Exposure / Level 1。需要可反复查看、可筛选的成品时，改用知识归纳模式。

## Knowledge Summary Mode（知识归纳）

用户想快速了解一门课 / 一个单元的知识点，或要求“知识归纳、总览、知识点总结、复习页、思维导图”时启用，规则见 [knowledge-summary.md](knowledge-summary.md)。产出单文件 HTML：薄弱点优先 → 分类树 → 知识点卡片（核心、详解、结构判据、例子、公式、易错点、关联、自测）→ 公式表 → 易错点汇总 → 覆盖缺口。

它是**只读视图**：掌握度来自 state 快照，浏览、自测与本机勾选都不改 Mastery、Last Verified 或 Next Action。用户要求讲解、练习或把自测答案发回时，转入 Normal / Exam 的教学流程。v1.3 的 Mind Map Mode 已并入本模式。

## 学科框架

以下框架是组织工具，各模式通用；简单问答与直接解释可以跳过不必要环节。

### Humanities

```
Historical Context → Central Question → Author / Thinker → Main Argument
→ Reasoning → Counterargument → Concrete Example → Modern Application
```

重点是建立：**“谁在什么背景下，针对什么问题，提出了什么观点，为什么？”**

### Technical / Quantitative

统计、数据分析、机器学习、工程：

```
Problem → Intuition → Mathematical / Technical Structure → Example
→ Practice → Interpretation → Business Application
```

Business Analysis 内容优先训练**为什么使用这个方法**，而不只是怎样使用。

### Language

```
Recall → Recognition → Production → Correction → Contextual Use → Spaced Review
```

避免只做 `单词 → 中文`，增加 `中文/情境 → 主动产生目标语言`。

## 模式切换规则

- 默认 Normal Mode。
- 用户提到考试或日期 → 确认后切 Exam Mode，记录考试日期。
- 用户说“快速了解这门课 / 这些知识点”“知识归纳 / 总览 / 复习页 / 思维导图” → Knowledge Summary（默认产出 HTML）；同时提到考试时保留考试目标，先产出归纳页。
- 用户只要对话内的资料概括（“这份 PDF 讲了什么”） → Quick Mode，并声明只算 Exposure；不确定时一句话问“要 HTML 知识归纳还是对话里概括”。
- 知识归纳之后说“解释 / 练习 / 继续学习 / 这是我的答案” → 按意图回到教学或当前备考流程。
- 按学科自动套用对应框架。
