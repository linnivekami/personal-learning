# Learning State 字段定义

Learning State 是跨会话工作记忆，回答“下一次怎样更有效地教我”，不是学习笔记。沿用既有字段与 Markdown 表格，增量修改；历史细节追加 log。

## Identity 与 Progress

Identity 保留 Project / Course / Current Unit / Current Topic / Last Updated。维护状态时可更新 Last Updated 并说明维护性质；Last Verified 只用实际作答日期。

Progress 区分 Exposure / Understanding / Application / Transfer。看完不等于学会，已接触但未测不等于不会。

## Mastery 与 Evidence

整数 0–5，累计门槛见 `mastery-scale.md`。沿用已有表格列；Confidence Register 可替代行内信心列。

Evidence 记录实际能力范围、作答结果、辅助程度、日期和复测条件；本次结果可为 Demonstrated / Partially Demonstrated / Not Demonstrated / Insufficient Evidence。例如：

```
能力：贝叶斯分母计算；结果：Demonstrated；辅助：无提示；日期：2026-10-08；间隔：首次；尚未验证假设检验解释或长期保持
```

新的或变更的 Level ≥2 用 `累积证据：` 段列出全部支撑能力与日期（格式见 `mastery-scale.md`）。历史等级缺证据时写“待按 v1.2 核验：缺少≥2天无提示复测”等具体缺口，不另建等级或状态系统。

## Weaknesses

写具体障碍及证据，区分未覆盖、未测、已发现错误、已纠正待复测。不能笼统记“这一章不会”，也不能从表达不清推断能力缺失。

## Error Map

保留现有分类并补充必要类别。分类可并存，选择主要障碍及相关因素；原因未经确认标“推测”。

| 类别 | 最小干预 |
| ---- | -------- |
| Concept Error | 对比正确/错误理解，用反例修正关键关系 |
| Reasoning Error | 定位首个不成立的推理步骤，从这里引导 |
| Calculation Error | 纠正局部计算，保留已证明的概念理解 |
| Recall Error | 给检索线索；提示后成功另记辅助证据 |
| Application Error / Transfer Error | 定位情境到原理的映射断点，用必要变式练习 |
| Reading Error / Careless Error | 检查条件、符号或漏项；勿凭一次错误断言粗心 |
| Procedural Error | 示范必要步骤或给逐级提示 |
| Prerequisite Gap | 只补阻碍当前任务的前置知识，再返回原任务 |
| Expression Ambiguity | 澄清关键含义，不先判对错或更新等级 |
| Unknown | 获取最少额外证据，不猜测原因 |

沿用 Error / Cause（兼容旧 Underlying Cause）/ Intervention / Status：

```
Error: 把 P(Data|H0) 与 P(H0|Data) 的条件方向互换
Cause: Concept Error — 学生明确把 p-value 当作 H0 后验；具体原因尚待澄清
Intervention: 对比固定 H0 的尾部概率与观察数据后的假设概率
Status: 已纠正待无提示验证
```

## Memory

Last Learned / Last Successful Recall / Last Failed Recall / Next Review。辅助成功不能冒充无提示成功；错误类型决定是否属于相关能力的保持失败。间隔规则见 mastery-scale，复习计划按实际表现调整。

## Confidence 与 Learner Insights

关键任务按需采集信心；保留来源日期，未问如实记录。校准依据同题信心与客观表现，规则见 mastery-scale。

Learner Insights 记录自主质疑、洞察和方法及其教学含义；推断范围应与观察一致。

## Learning Log

保留题目/答案、能力、结果、辅助、日期/间隔、信心是否采集、错误或洞察、状态变化原因及 Next。例如：

```
Topic: Bayes calculation
Result: 4/13 正确；无提示首次应用
Evidence: 仅证明本题计算，不证明假设检验或保持
Confidence: 未采集（本轮未询问）
Mastery: 1 → 2
Next: 相关能力需要时再做间隔复测
```

## Next Action 与更新

具体、一个、可立即开始、5–15 分钟可启动且有完成条件。仅在产生有意义证据时更新相关字段；不为每次微小互动重写全部状态。保留既定目标，历史核验缺口只在影响当前教学决策时触发最小复测。
