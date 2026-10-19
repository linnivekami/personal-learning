# 11 步流水线 (PDF → Learning State Pipeline)

扎实学习资料采用以下组织顺序；它不是每次问答必须执行的教学脚本。可复用已有资料结构和学习证据、合并步骤或按需跳过诊断与验证。**多个文件不得默认混成一份总结。**

```
PDF / PPT / Notes
  ↓ 1. INGEST
  ↓ 2. MAP
  ↓ 3. DIAGNOSE
  ↓ 4. INITIAL STATE
  ↓ 5. ADAPTIVE LEARN
  ↓ 6. RETRIEVE
  ↓ 7. APPLY
  ↓ 8. ASSESS
  ↓ 9. UPDATE STATE
  ↓ 10. NEXT ACTION
  ↓ 11. REVIEW
```

## 1. INGEST（识别资料）

判断并记录：
- 文件类型（PDF / PPT / Notes / HW / Case）
- 属于哪个 Course / Project
- 核心资料还是补充资料
- 文件之间的关系（讲义 + 作业 + 案例 可能同属一单元）
- 资料覆盖的主题
- 可能的先修知识

输出到 `material-index.md`。提取不到的表格、图片、扫描页或缺失讲次写入其“覆盖缺口”，不假装已读。**不要**立刻生成"资料总结"；用户要总览时用知识归纳模式（`knowledge-summary.md`）。

## 2. MAP（建立知识地图）

为资料建立 Knowledge Map 树，作为后续诊断、学习与 State 的骨架。示例：

```
Regression
├── Purpose
├── Variables
├── Model
├── OLS
├── Coefficients
├── R²
├── Assumptions
└── Business Application
```

输出到 `knowledge-map.md`。重要节点可在末尾加稳定 ID（如 `` `#bayes` ``），供知识归纳卡片、讲解和练习对齐；ID 不是状态标记。

## 3. DIAGNOSE（诊断）

不假定用户"应该会"。对每个重要知识点默认标 `Unknown?`，直到获得证据。
诊断工具（按优先级）：
- 简短问题
- 让用户自己解释
- 判断对错
- 小型案例
- 预测
- 迁移题

当前障碍或证据不明时，优先一道能区分认知状态的问题；已有明确错误位置可直接干预。简单定义、明确直接答案请求或已有足够证据时跳过诊断。

## 4. INITIAL STATE（初始状态）

生成四类状态：`Strong / Developing / Weak / Unknown`，并为每个知识点标记：
- Mastery（0–5）
- Confidence（1–10 或如实记未采集，关键任务按需采集）
- Error patterns
- Prerequisites
- Priority

写入 `state.md`。

## 5. ADAPTIVE LEARN（自适应教学）

教学顺序由 State 动态决定：
- 若 prerequisite 不牢：`Current Topic → Prerequisite Weak → Repair → Return`
- 若相关能力有可靠掌握证据且无待核验缺口：跳过基础解释
- 若理解但应用困难：减少讲解、增加应用
- 若应用好但迁移难：增加陌生场景

需要练习时可采用 `Input → Question → Output → Feedback`；短问答直接回答。按基础与反馈选择直接讲解、对比、推导、例题或提示；连续两次未理解时切换表示或补最小前置缺口。

## 6. RETRIEVE（检索）

重要误解纠正、复杂新知识或下一步决策缺证据时，按需把知识"交还给用户"；自然交互证据可以复用，简单事实问答无需检验。常用方式：
- 不看资料解释
- 回答问题
- 写出步骤
- 从案例中识别概念
- 教给别人

目标：收集本题涉及能力的证据；即时检验不等于长期保持。

## 7. APPLY（应用）

应用难度分级：
- L1 Direct（直接应用）
- L2 Modified（变式）
- L3 Scenario（场景题）
- L4 Novel（陌生题）
- L5 Decision（决策题）

Business Analysis 尽量训练完整链条：`数据 → 分析 → 解释 → 商业决策`。

## 8. ASSESS（评估）

评估四维：`Understanding / Application / Transfer / Confidence`。
**不能因为"做对一道题"就判定整个主题掌握。** 分别记录能力范围、辅助与日期，按 `mastery-scale.md` 累积更新整数等级；同日变式最高为 2，间隔条件满足后可复用该证据。

## 9. UPDATE STATE（更新状态）

只更新产生有意义新证据的字段：Mastery / Weaknesses / Errors / Confidence / Memory / Learning Log / Next Action。
不要求每次微小互动都完整更新。

## 10. NEXT ACTION（下一步）

按 `references/next-action.md` 的引擎生成一个 Next Action 写入 state。

## 11. REVIEW（安排复习）

记录：`Last Learned / Last Successful Recall / Last Failed Recall / Next Review`。
复习间隔根据表现动态调整，优先保证"重要知识不会因为考试结束而永久消失"。
