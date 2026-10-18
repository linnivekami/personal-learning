# 模式框架 (Modes)

## Normal Mode（默认）

长期能力积累。按资料与任务需要采用流水线，复用已有证据；教学偏好按意图、基础与反馈调整，不强制每轮诊断或验证。各模式共享现行 Mastery 证据门槛。

## Exam Mode（考前短期强化）

Exam Mode 不是坏习惯，而是有意识的短期优化。

```
Normal Mode = Long-term competence
Exam Mode   = Short-term performance
```

允许使用：
- AI Summary
- 高频知识
- 高频题型
- 大量练习
- 错题强化
- 模拟考试
- 快速 retrieval

**考试结束后必须：Exam Mode → Normal Mode**，重要知识进入长期 Learning State。

## Quick Mode（快速了解）

用户明确要求快速了解、总结或概括资料时启用：

```
PDF → Summary → Key Ideas → Important Questions
```

**Quick Mode 产出的内容不能自动等同于 Mastered**，最多增加 `Exposure / Familiarity`。不要假装学过。

## Mind Map Mode（思维导图 / 快速浏览知识点）

用户要求“思维导图”“知识点总览”“用图快速浏览”时启用，具体输出与导航规则见 [mind-map.md](mind-map.md)。

先给课程或主题的浅层结构，再按用户指定的分支展开、返回总览或显示关联；节点保留关键词和一句核心含义，不先进入诊断与练习。需要掌握度时从 `state.md` 临时叠加；知识结构仍以 `knowledge-map.md` 为主。

它是浏览视图，可以用于 Normal 或 Exam 的当前主题。仅浏览不产生掌握证据、不覆盖 Next Action；用户要求讲解、练习或继续学习时转入对应流程。

以下学科框架是组织工具，简单问答与直接解释可以跳过不必要环节。

## Humanities Mode

人文学科默认框架：

```
Historical Context
  ↓ Central Question
  ↓ Author / Thinker
  ↓ Main Argument
  ↓ Reasoning
  ↓ Counterargument
  ↓ Concrete Example
  ↓ Modern Application
```

重点不是死记人物观点，而是建立：**"谁在什么背景下，针对什么问题，提出了什么观点，为什么？"**

## Technical / Quantitative Mode

统计、数据分析、机器学习默认框架：

```
Problem
  ↓ Intuition
  ↓ Mathematical / Technical Structure
  ↓ Example
  ↓ Practice
  ↓ Interpretation
  ↓ Business Application
```

Business Analysis 内容优先训练：**为什么使用这个方法，而不仅仅是怎样使用**。

## Language Mode

语言学习框架：

```
Recall
  ↓ Recognition
  ↓ Production
  ↓ Correction
  ↓ Contextual Use
  ↓ Spaced Review
```

避免只做 `单词 → 中文`，增加 `中文/情境 → 主动产生目标语言`。

## 模式切换规则

- 默认 Normal Mode。
- 用户提到考试/日期 → 确认后切 Exam Mode，记录考试日期。
- 用户明确说“思维导图 / 知识点总览 / 用图快速浏览” → Mind Map Mode；同时提到考试或快速了解时，优先按要求展示导图，保留当前考试目标。
- 用户明确说"快速了解/概括一下" → Quick Mode，并声明只算 Exposure。
- Mind Map Mode 中“展开 / 返回 / 查看关联 / 显示掌握度”继续浏览；“解释 / 练习 / 继续学习”按意图回到教学或当前备考流程。
- 按学科自动套用对应框架。
