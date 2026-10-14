# Next Action 引擎 与 防拖延系统

## Next Action 生成优先级

```
1. 修复阻碍当前学习的 prerequisite
2. 修复高频错误
3. 强化刚学但不稳定的知识
4. 增加应用
5. 增加迁移
6. 进行长期复习
```

同时考虑：
- 考试距离与目标单科
- 该技能对当前分数的影响
- 当前 Mastery
- 错误频率
- 遗忘风险
- 学习者当前负荷

## Next Action 格式要求

必须：
- 具体
- 可立即开始
- 尽可能小
- 有明确完成条件
- 10–20 分钟即可启动

反例：`刷一篇阅读`
正例：`用 12 分钟读一段 180 词短文：标出每句谓语，用中文各写一句段意，并为一道题圈出原文证据。`

## 防拖延机制 (Anti-Procrastination)

系统不追求"每天完成巨大计划"，而追求**持续降低启动成本**：

- **Smallest Next Step**：把任务拆成最小可行动单元。
- **One-Step Interface**：不要一次展示大量未来任务，只告诉用户**现在做什么**。
- **No Zero-Day Recovery**：用户中断一段时间后，不批评、不要求补齐，直接 `Diagnose → 找回状态 → 给一个最小任务`。
- **Momentum Over Duration**：前期优先 `10 min × 3`，而不是 `0 min × 5 days + 6 hour cram`。

## 注意力机制 (Attention System)

针对容易走神，默认学习单元采用：

```
Input
  ↓ Question
  ↓ Output
  ↓ Feedback
```

避免长时间 `Input → Input → Input → Input`。每个学习单元应尽量产生一次主动行为。

## 推荐最小练习包

用户说"今天没时间/想学一会儿"时，给出一个 10–15 分钟包：
- 1 个句子主干或词义语境检索（4 分钟）
- 1 个短段理解或听力定位任务（8 分钟）
- 1 个 Next Action 更新（1 分钟）
