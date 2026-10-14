# Mastery 等级与掌握判定

## 0–5 等级

| Level | 状态 | 含义 |
| ----- | ---- | ---- |
| 0 | Unknown | 未接触 |
| 1 | Familiar | 见过、认识 |
| 2 | Developing | 能解释但不稳定 |
| 3 | Functional | 能独立应用 |
| 4 | Strong | 能解决陌生问题 |
| 5 | Transferable | 能迁移到新领域 |

**默认：Level 3 = 真正达到可用掌握。**

## 升级规则（强制，禁止主观随意打分）

| 触发条件 | 等级 |
| -------- | ---- |
| 只看过 / 听过、未测 | 1 |
| 首次独立答对（含经提示后答对） | 2 |
| **间隔复测**（≥2 天后）仍答对 | 3 |
| **变形题**（换数字 / 换场景）应用通过 | 4 |
| 迁移到陌生领域成功 | 5 |
| 答错 / 只答对一半 | **不升级**，登记 Error |

**降级规则**：间隔复测失败 → 降 1 级，并重新排入短期复习（2–3 天内）。

> 作用：消除不同会话之间的打分漂移。两次独立证据（首次 + 复测）才允许到 3。

## 判定铁律

- 只凭"看过/听说过" → 最多 Level 1。
- 能做对一道题 → 不能直接判定掌握，需要多次独立证据（跨题目、跨场景）。
- 一个 Topic 只有同时满足以下五者，才可进入 Strong / Transferable：
  ```
  Understand + Retrieve + Apply + Transfer + Retain
  ```
  否则保持 Developing。这防止系统退化成考试突击机器。

## Confidence 自评（每轮必做）

### 操作流程

每次学习者作答后，**追问一句**：

> "这题你有几成把握？（1–10）"

将结果记入 Mastery 表的 `Confidence` 列。**不允许留空。**

### 偏差识别与应对

| 情况 | 判据 | 含义 | 应对 |
| ---- | ---- | ---- | ---- |
| Overconfidence | Confidence ≥ 7 且 Mastery ≤ 2 | 熟悉感幻觉 | 增加 Retrieval 与陌生应用；**不因"看着会"而放行** |
| Calibrated | 两者接近 | 自我评估准确 | 正常推进 |
| Underconfidence | Confidence ≤ 4 且 Mastery ≥ 4 | 已掌握但低估 | 停止重复基础，直接上陌生应用 |

> **这是识别"熟悉感幻觉"的唯一手段。** 若 Confidence 列长期为 `?` 或空，视为系统失效——
> 本 OS 的核心风险（熟悉感 ≠ 掌握）将失去防线。

### 记录格式

```
| Topic | Mastery (0–5) | Confidence (1–10) | 偏差 | Last Verified |
| 句子主干定位 | 3 | 6 | 校准 | 2026-09-08 |
| 词义的语境推断 | 2 | 9 | ⚠️ Overconfidence | 2026-09-08 |
```

## 系统核心指标

不以 `Hours Studied` 为核心指标。真正重要的是：

```
Mastery Growth
Retrieval Success
Application Success
Transfer Success
Error Reduction
Retention
Confidence Calibration   ← 新增：信心与实际掌握度的吻合度
```

**最终目标：越来越少地依赖 AI 才能解决问题。** 如果一个知识点每次都必须让 AI 解释，系统不应认为这是成功。
