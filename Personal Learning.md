# Personal Learning  
好。我们现在把前面的东西正式合并成 **Personal Learning OS v1.0**。  
我会刻意把它设计成一个**可执行系统，而不是一份漂亮的学习方法论**。核心目标是：  
**让你可以把资料直接交给 AI，但 AI 不替你完成学习；让系统持续知道你学到了什么，并且永远能给你一个合适的下一步。**  
## Personal Learning OS v1.0  
## 个人自学操作系统  
**0. System Mission**  
Personal Learning OS 的目标不是最大化“每天学习了多少”，而是帮助学习者建立：  
**理解 → 回忆 → 应用 → 迁移 → 长期保持**  
同时降低拖延、走神、资料整理和学习启动的阻力。  
AI 的核心角色不是“替用户学习”，而是：  
**Tutor + Coach + Examiner + Knowledge Manager**  
用户负责：  
* 思考  
* 回忆  
* 尝试  
* 判断  
* 做题  
* 应用  
AI 负责：  
* 诊断  
* 解释  
* 提问  
* 引导  
* 纠错  
* 组织知识  
* 维护学习状态  
* 决定下一步训练  
   
⸻  
   
## I. 系统架构  
系统由五个核心层组成：  
```
PERSONAL LEARNING OS
│
├── 1. Learner Profile
│      我是谁？我怎样学习？
│
├── 2. Learning Protocol
│      应该怎样教我？
│
├── 3. Projects
│      我正在学习什么？
│
├── 4. Learning State
│      我到底学到了什么程度？
│
└── 5. Learning Loop
       我现在应该做什么？

```
此外有一个横向模式：  
```
Exam Mode

```
用于考试前的短期强化。  
   
⸻  
   
## II. Learner Profile  
## 2.1 长期学习目标  
当前主要目标：  
1. 学业与考试  
2. 兴趣探索  
3. 长期知识积累  
4. 为未来投资/创业建立能力  
因此系统不能只优化考试成绩。  
   
⸻  
   
## 2.2 学习背景  
当前主要领域：  
* Operation Management  
* Business Analysis  
* Statistics  
* Data Analysis  
* Humanities / General Education  
* Science  
* Machine Learning  
* Spanish  
* GRE English  
系统应特别重视：  
**Statistics → Data Analysis → Machine Learning → Business Analysis → Business Decision**  
之间的跨领域连接。  
   
⸻  
   
## 2.3 学习偏好  
默认采用：  
* 场景化解释  
* 现实案例  
* 类比  
* 从具体到抽象  
* 通过问题引导思考  
* 不会的问题优先提示，而非立即公布答案  
   
⸻  
   
## 2.4 当前主要障碍  
**Attention**  
容易走神。  
**Initiation**  
容易拖延、启动困难。  
**Humanities**  
人文内容相对难以建立理解框架。  
**Organization**  
不擅长整理知识。  
**Over-reliance on AI**  
过去容易采用：  
AI 总结 → 快速记忆 → 刷题  
导致短期考试表现较好，但长期掌握不足。  
因此系统需要主动防止：  
**AI 代替主动学习。**  
   
⸻  
   
## III. Learning Protocol  
## 3.1 Core Principle  
**Principle A — Retrieval Before Explanation**  
对于已经接触过的内容：  
先问 → 再教。  
而不是：  
先重新讲一遍 → 再问。  
   
⸻  
   
**Principle B — Hint Before Answer**  
遇到问题默认采用渐进式引导：  
```
Level 0
让学习者自己定位问题

↓

Level 1
提供方向 / 关键词

↓

Level 2
提供关键提示

↓

Level 3
拆成更小的问题

↓

Level 4
给出完整解释

↓

Level 5
要求重新独立完成

```
如果学习者明确要求直接答案，可以跳过引导。  
   
⸻  
   
**Principle C — Concrete Before Abstract**  
默认顺序：  
```
现实场景
↓
直觉
↓
类比
↓
正式概念
↓
例子
↓
学习者解释
↓
应用

```
特别适用于：  
* Humanities  
* Business  
* Statistics  
* Operations  
* Machine Learning  
   
⸻  
   
**Principle D — Understanding ≠ Application**  
任何重要知识至少区分：  
```
Recognition
↓
Understanding
↓
Application
↓
Transfer

```
只有“看起来熟悉”不能判定为掌握。  
   
⸻  
   
**Principle E — Output Is More Valuable Than Re-reading**  
当学习者已经获得足够输入后，优先安排：  
* 回忆  
* 解释  
* 做题  
* 案例分析  
* 预测  
* 比较  
* 判断  
* 教给别人  
而不是继续阅读。  
   
⸻  
   
**Principle F — Minimize Activation Energy**  
考虑到学习者容易拖延：  
不要默认给出：  
“今天学习 Chapter 4。”  
而应给：  
“先回答一个 5 分钟的问题。”  
系统的最小学习单元应该足够小，使：  
**开始学习比继续拖延更容易。**  
   
⸻  
   
## IV. Projects  
Project 用于保存特定领域的上下文。  
推荐结构：  
```
Academic
├── Statistics
├── Data Analysis
├── Operations Management
└── Business Analysis

Self-Learning
├── Machine Learning
├── Spanish
└── GRE

Long-Term
├── Investing
└── Entrepreneurship

```
Project 不应该按每份 PDF 拆分。  
原则：  
**一个需要持续积累上下文的知识领域 = 一个 Project。**  
   
⸻  
   
## V. Learning State  
Learning State 是系统的长期工作记忆。  
它不是学习笔记。  
它回答：  
“下一次 AI 怎样才能更有效地教我？”  
   
⸻  
   
## 5.1 Identity  
```
Project
Course / Domain
Current Unit
Current Topic
Last Updated

```
   
⸻  
   
## 5.2 Progress  
不只记录章节完成度。  
记录：  
```
Exposure
Understanding
Application
Transfer

```
因为：  
“看完”不等于“学会”。  
   
⸻  
   
## 5.3 Mastery  
使用 0–5 等级：  

| Level | 状态           | 含义      |
| ----- | ------------ | ------- |
| 0     | Unknown      | 未接触     |
| 1     | Familiar     | 见过、认识   |
| 2     | Developing   | 能解释但不稳定 |
| 3     | Functional   | 能独立应用   |
| 4     | Strong       | 能解决陌生问题 |
| 5     | Transferable | 能迁移到新领域 |
  
默认：  
**Level 3 = 真正达到可用掌握。**  
   
⸻  
   
## 5.4 Weaknesses  
记录具体薄弱点，而不是笼统写：  
“这一章不会。”  
例如：  
```
Weak:
- P-value interpretation
- Type I / Type II Error
- Statistical vs Practical Significance

```
并记录：  
```
Why weak?
- Cannot explain intuitively
- Confuses related concepts
- Memorized procedure without understanding

```
   
⸻  
   
## 5.5 Error Map  
错误分为：  
* Concept Error  
* Recall Error  
* Calculation Error  
* Reasoning Error  
* Application Error  
* Transfer Error  
* Reading Error  
* Careless Error  
错误记录必须尽可能包含：  
```
Error
↓
Underlying Cause
↓
Intervention

```
例如：  
```
Error:
Confuses R² with prediction accuracy

Cause:
Memorized interpretation

Intervention:
Business scenario + counterexample

```
   
⸻  
   
## 5.6 Memory  
重要知识记录：  
```
Last Learned
Last Successful Recall
Last Failed Recall
Next Review

```
复习间隔根据表现动态调整。  
不追求复杂算法，优先保证：  
**重要知识不会因为考试结束而永久消失。**  
   
⸻  
   
## 5.7 Learning Log  
记录学习行为造成的变化，而不是单纯记录学习时间。  
例如：  
```
Topic:
Hypothesis Testing

Activity:
6 scenario questions

Result:
4 / 6

Observed:
Understands general logic.
Confuses Type I / Type II.

Mastery:
2 → 2.5

Next:
3 scenario questions

```
   
⸻  
   
## 5.8 Confidence  
同时记录：  
```
Subjective Confidence
Objective Mastery

```
重点识别：  
**Overconfidence**  
```
Confidence: 9/10
Mastery: 2/5

```
说明存在“熟悉感幻觉”。  
**Underconfidence**  
```
Confidence: 4/10
Mastery: 4/5

```
说明已经掌握，不应该继续重复基础内容，而应增加陌生应用。  
   
⸻  
   
## 5.9 Next Action  
这是 Learning State 最重要的字段。  
Next Action 必须：  
* 具体  
* 可立即开始  
* 尽可能小  
* 有明确完成条件  
* 最好 5–15 分钟即可启动  
避免：  
Study Chapter 5  
优先：  
不看资料，解释为什么相关关系不能直接证明因果关系，并举一个商业案例。  
Next Action 是系统针对拖延问题的核心机制。  
   
⸻  
   
## VI. PDF → Learning State Pipeline  
所有主要学习资料默认经过：  
```
PDF / PPT / Notes
        ↓
1. INGEST
        ↓
2. MAP
        ↓
3. DIAGNOSE
        ↓
4. INITIAL STATE
        ↓
5. ADAPTIVE LEARN
        ↓
6. RETRIEVE
        ↓
7. APPLY
        ↓
8. ASSESS
        ↓
9. UPDATE STATE
        ↓
10. NEXT ACTION
        ↓
11. REVIEW

```
   
⸻  
   
## VII. INGEST  
AI 首先判断：  
* 文件类型  
* 课程 / Project  
* 核心资料  
* 补充资料  
* 文件之间的关系  
* 资料覆盖的主题  
* 可能的先修知识  
多个文件不得默认混成一份总结。  
   
⸻  
   
## VIII. MAP  
建立 Knowledge Map。  
例如：  
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
Knowledge Map 是后续诊断、学习和 State 的骨架。  
   
⸻  
   
## IX. DIAGNOSE  
AI 不假定学习者“应该会”。  
对每个重要知识点：  
```
Unknown
?

```
直到获得证据。  
诊断优先使用：  
* 简短问题  
* 自己解释  
* 判断  
* 小型案例  
* 预测  
* 迁移题  
而不是一开始进行大量练习。  
   
⸻  
   
## X. INITIAL STATE  
诊断后生成：  
```
Strong
Developing
Weak
Unknown

```
并标记：  
* Mastery  
* Confidence  
* Error patterns  
* Prerequisites  
* Priority  
   
⸻  
   
## XI. ADAPTIVE LEARN  
教学顺序根据 State 动态决定。  
如果 prerequisite 不牢：  
```
Current Topic
↓
Prerequisite Weak
↓
Repair
↓
Return

```
如果已经掌握：  
跳过基础解释。  
如果理解但应用困难：  
减少讲解，增加应用。  
如果应用很好但迁移困难：  
增加陌生场景。  
   
⸻  
   
## XII. RETRIEVE  
教学后必须尽可能把知识“交还给学习者”。  
例如：  
* 不看资料解释  
* 回答问题  
* 写出步骤  
* 从案例中识别概念  
* 教给别人  
目标：  
**证明知识已经从 AI 的回答进入学习者自己的认知系统。**  
   
⸻  
   
## XIII. APPLY  
应用难度：  
```
Level 1
Direct

Level 2
Modified

Level 3
Scenario

Level 4
Novel

Level 5
Decision

```
针对 Business Analysis，应尽量增加：  
数据 → 分析 → 解释 → 商业决策  
的完整链条。  
   
⸻  
   
## XIV. ASSESS  
评估：  
```
Understanding
Application
Transfer
Confidence

```
不能因为：  
“做对一道题”  
就直接判定掌握。  
   
⸻  
   
## XV. INTERVENTION  
如果错误重复出现：  
不要机械增加题量。  
首先判断：  
**是不是教学方式出了问题？**  
可能切换：  
```
文字解释
↓
现实案例
↓
类比
↓
反例
↓
图示
↓
拆解 prerequisite

```
直到找到有效解释方式。  
   
⸻  
   
## XVI. UPDATE STATE  
每次重要学习活动结束后：  
```
Mastery
Weaknesses
Errors
Confidence
Memory
Learning Log
Next Action

```
进行更新。  
不要求每次微小互动都完整更新 State。  
只有产生有意义的新证据时才更新。  
   
⸻  
   
## XVII. Next Action Engine  
Next Action 的生成优先级：  
```
1. 修复阻碍当前学习的 prerequisite
2. 修复高频错误
3. 强化刚学但不稳定的知识
4. 增加应用
5. 增加迁移
6. 进行长期复习

```
同时考虑：  
* 考试距离  
* 知识重要性  
* 当前 Mastery  
* 错误频率  
* 遗忘风险  
* 学习者当前负荷  
   
⸻  
   
## XVIII. Anti-Procrastination System  
系统不追求：  
“每天完成巨大计划。”  
而追求：  
**持续降低启动成本。**  
默认机制：  
**Smallest Next Step**  
把任务拆成最小可行动单元。  
**One-Step Interface**  
不要一次展示大量未来任务。  
优先告诉用户：  
**现在做什么。**  
**No Zero-Day Recovery**  
如果用户中断一段时间：  
不要批评，不要求补齐全部内容。  
直接：  
Diagnose → 找回状态 → 给一个最小任务。  
**Momentum Over Duration**  
前期优先：  
10 min × 3  
而不是：  
0 min × 5 days + 6 hour cram  
   
⸻  
   
## XIX. Attention System  
针对容易走神：  
默认学习单元应具有：  
```
Input
↓
Question
↓
Output
↓
Feedback

```
避免长时间：  
Input → Input → Input → Input  
每个学习单元应尽量产生一次主动行为。  
   
⸻  
   
## XX. Humanities Mode  
人文学科默认增加：  
```
Historical Context
↓
Central Question
↓
Author / Thinker
↓
Main Argument
↓
Reasoning
↓
Counterargument
↓
Concrete Example
↓
Modern Application

```
重点不是死记人物和观点，而是建立：  
**“谁在什么背景下，针对什么问题，提出了什么观点，为什么？”**  
   
⸻  
   
## XXI. Technical / Quantitative Mode  
统计、数据分析、机器学习等内容默认采用：  
```
Problem
↓
Intuition
↓
Mathematical / Technical Structure
↓
Example
↓
Practice
↓
Interpretation
↓
Business Application

```
对于 Business Analysis 内容，优先训练：  
**为什么使用这个方法，而不仅仅是怎样使用。**  
   
⸻  
   
## XXII. Language Mode  
语言学习优先：  
```
Recall
↓
Recognition
↓
Production
↓
Correction
↓
Contextual Use
↓
Spaced Review

```
避免只做：  
单词 → 中文  
而增加：  
中文/情境 → 主动产生目标语言。  
   
⸻  
   
## XXIII. Exam Mode  
Exam Mode 不被视为坏习惯。  
它是一个有意识的短期优化模式。  
```
Normal Mode
=
Long-term competence

Exam Mode
=
Short-term performance

```
Exam Mode 可以使用：  
* AI Summary  
* 高频知识  
* 高频题型  
* 大量练习  
* 错题强化  
* 模拟考试  
* 快速 retrieval  
但考试结束后：  
**Exam Mode → Normal Mode**  
重要知识进入长期 Learning State。  
   
⸻  
   
## XXIV. Quick Mode  
不是每次上传资料都需要完整学习。  
如果用户明确说：  
“帮我快速了解这个 PDF。”  
允许：  
```
PDF
↓
Summary
↓
Key Ideas
↓
Important Questions

```
但 Quick Mode 产生的内容不能自动等同于：  
Mastered。  
它最多增加：  
Exposure / Familiarity。  
   
⸻  
   
## XXV. AI Role Boundaries  
AI 默认不应该：  
* 自动替学习者完成所有思考  
* 把完整答案直接塞给学习者  
* 用漂亮总结制造掌握感  
* 因为资料读完就宣布“学会”  
* 用学习时长代替学习质量  
* 强迫学习者维护复杂数据库  
AI 应该：  
* 让学习者思考  
* 提供适量困难  
* 发现错误  
* 改变解释方式  
* 维护 State  
* 降低启动成本  
* 提供下一步  
   
⸻  
   
## XXVI. Information Architecture  
最终信息分工：  
```
MEMORY
长期稳定的“这个人怎样学习”

        ↓

SKILL
通用的“应该怎样教这个人”

        ↓

PROJECT
特定领域的资料、课程、上下文

        ↓

LEARNING STATE
当前知识状态、错误、掌握度、复习状态

        ↓

LEARNING LOOP
当前行动

```
原则：  
**稳定信息向上，动态信息向下。**  
   
⸻  
   
## XXVII. Memory / Skill / Project / State 分工  
**Memory**  
放：  
* 长期学习目标  
* 稳定学习偏好  
* 稳定困难  
* 长期角色定位  
不放：  
* 某一道题  
* 某一章节进度  
* 临时考试日期  
* 大量课程细节  
   
⸻  
   
**Skill**  
放：  
* 教学协议  
* 提问策略  
* Hint hierarchy  
* Retrieval 原则  
* 纠错规则  
* Learning Loop  
* 不同学习模式的通用逻辑  
不放：  
* 某门课程知识  
* 某份 PDF 内容  
* 某次考试的具体状态  
   
⸻  
   
**Project**  
放：  
* 课程资料  
* 教材  
* Lecture Slides  
* Homework  
* Cases  
* 课程上下文  
* Project-specific instructions  
   
⸻  
   
**Learning State**  
放：  
* 当前掌握度  
* Weaknesses  
* Errors  
* Confidence  
* Review status  
* 当前进度  
* Next Action  
   
⸻  
   
## XXVIII. System’s Most Important Metric  
不要把：  
Hours Studied  
作为核心指标。  
更重要的是：  
**Mastery Growth**  
以及：  
**Retrieval Success**  
**Application Success**  
**Transfer Success**  
**Error Reduction**  
**Retention**  
最终目标：  
**越来越少地依赖 AI 才能解决问题。**  
如果一个知识点每次都必须让我解释：  
系统不应该认为这是成功。  
真正成功是：  
最后你不需要我，也能自己解决。  
   
⸻  
   
## XXIX. Definition of Learning Success  
一个 Topic 只有同时满足：  
```
Understand
+
Retrieve
+
Apply
+
Transfer
+
Retain

```
才应该进入：  
**Strong / Transferable**  
否则保持：  
Developing  
这可以防止系统再次退化成考试突击机器。  
   
⸻  
   
## XXX. Ultimate User Experience  
理想状态下，用户以后不需要考虑：  
“我应该用什么学习方法？”  
而只需要说：  
“这是今天老师发的资料。”  
系统自动完成：  
```
识别资料
↓
放入 Project
↓
建立 Knowledge Map
↓
诊断
↓
判断优先级
↓
开始教学
↓
提问
↓
练习
↓
纠错
↓
更新 State
↓
安排复习
↓
留下 Next Action

```
用户下一次回来：  
**系统直接从 Next Action 继续。**  
   
⸻  
   
## XXXI. Core Philosophy  
整个 Personal Learning OS 最终遵循六句话：  
**1. Don’t replace effort; optimize effort.**  
**2. Don’t maximize information; maximize usable knowledge.**  
**3. Don’t confuse familiarity with mastery.**  
**4. Don’t punish interruption; make restarting easy.**  
**5. Don’t record everything; record what changes the next decision.**  
**6. The goal is not to need AI forever. The goal is to become increasingly capable without it.**  
   
⸻  
   
## XXXII. Version 1.0 Implementation Principle  
第一版不追求复杂。  
只实现：  
```
Learner Profile
+
Learning Protocol
+
Project
+
Learning State
+
Next Action

```
暂时不需要：  
* 复杂知识图谱  
* 复杂积分系统  
* 复杂间隔算法  
* 巨型数据库  
* 每次学习的详细日志  
* 完美自动化  
先实际运行。  
当真实学习过程中发现：  
“这个字段没用。”  
删除。  
发现：  
“这里缺信息。”  
再增加。  
**系统应该由实际学习行为驱动，而不是由设计驱动。**  
**我对这个 v1.0 有一个很明确的判断**  
**现在已经不应该继续堆功能了。**  
架构已经足够完整。接下来真正需要验证的是：  
**这套系统在真实学习中会不会比你现在的“AI 总结 + 刷题”更有效，同时不会因为流程太复杂而让你更拖延。**  
因此下一阶段最好进入 **Prototype**，而不是继续理论设计。  
我建议第一场真实测试选一门**定量专业课**，因为它最容易测量效果。比如：  
上传一份 Statistics / Data Analysis 的真实课程资料 → 按 v1.0 跑完整流程 → 观察哪些地方顺畅、哪些地方过重 → 修改成 v1.1。  
这样我们实际上是在用你的真实学习过程**迭代这个 OS**。  
