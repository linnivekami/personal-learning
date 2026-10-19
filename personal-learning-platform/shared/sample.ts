import { emptyState, chooseNext } from "./core";
import type { Course, Lesson } from "./types";
export const sampleCourse: Course = {
  id: "sample-probability",
  title: "概率与决策",
  description: "从不确定性出发，把概率、条件信息与实际决策连成一张知识网。",
  goal: "mastery",
  language: "mixed",
  strategy: "framework",
  examDate: null,
  createdAt: "2026-10-18T00:00:00.000Z",
  concepts: [
    {
      id: "uncertainty",
      title: "用概率描述不确定性",
      purpose: "把直觉里的“可能”转成可检验的表达。",
      summary:
        "概率描述一个事件发生的可能性。样本空间与事件是后续概念的共同语言。",
      prerequisites: [],
      parentId: null,
      applications: ["风险比较", "预测判断"],
      sourceIds: [],
    },
    {
      id: "events",
      title: "样本空间与事件",
      purpose: "明确我们正在讨论哪一组可能结果。",
      summary: "先列出可能结果，再定义关注的事件，避免分母不清。",
      prerequisites: ["uncertainty"],
      parentId: "uncertainty",
      applications: ["抽样", "数据分类"],
      sourceIds: [],
    },
    {
      id: "conditional",
      title: "条件概率",
      purpose: "理解新增信息怎样改变判断的范围。",
      summary:
        "在 B 已发生的范围内，重新计算 A 发生的比例。关键变化是参照范围。",
      prerequisites: ["events"],
      parentId: "uncertainty",
      applications: ["医学筛查", "客户转化", "风险判断"],
      sourceIds: [],
    },
    {
      id: "independence",
      title: "独立性",
      purpose: "判断知道一个事件后，另一个事件的概率是否改变。",
      summary: "独立性意味着条件信息没有改变另一个事件的概率；它与互斥不同。",
      prerequisites: ["conditional"],
      parentId: "uncertainty",
      applications: ["风险共担", "实验设计"],
      sourceIds: [],
    },
    {
      id: "bayes",
      title: "贝叶斯更新",
      purpose: "把观察到的结果连接回可能的原因。",
      summary: "将先验概率与新证据结合，更新对原因的判断。",
      prerequisites: ["conditional"],
      parentId: "uncertainty",
      applications: ["筛查结果解释", "证据判断"],
      sourceIds: [],
    },
    {
      id: "expectation",
      title: "期望与决策",
      purpose: "用结果及其概率比较不同选择。",
      summary: "期望是按概率加权的平均结果；决策还要结合风险和约束。",
      prerequisites: ["events"],
      parentId: "uncertainty",
      applications: ["库存决策", "投资比较"],
      sourceIds: [],
    },
    {
      id: "variance",
      title: "方差与风险",
      purpose: "把平均结果周围的波动表达清楚。",
      summary: "相同期望的方案可能具有不同波动。方差帮助描述分散程度。",
      prerequisites: ["expectation"],
      parentId: "uncertainty",
      applications: ["安全库存", "风险组合"],
      sourceIds: [],
    },
    {
      id: "transfer",
      title: "把概率用到真实问题",
      purpose: "将情境映射到事件、条件、结果与决策。",
      summary: "先说明问题和假设，再选择工具，并解释结论的适用边界。",
      prerequisites: ["bayes", "expectation", "variance"],
      parentId: null,
      applications: ["业务分析", "独立建模"],
      sourceIds: [],
    },
  ],
  state: emptyState(),
};
sampleCourse.state.nextAction = chooseNext(
  sampleCourse.concepts,
  sampleCourse.state,
  sampleCourse.createdAt,
);
export const sampleLesson: Lesson = {
  title: "条件概率：信息怎样改变判断",
  position: "概率与决策 → 描述不确定性 → 条件概率",
  purpose: "面对新信息时，知道应该改变哪个参照范围，而不只是代入公式。",
  connections: [
    "向前连接样本空间：哪些结果仍然可能？",
    "向后连接贝叶斯：怎样从结果更新对原因的判断？",
    "与独立性对比：什么时候新信息不会改变概率？",
  ],
  body: `## 先把这个知识点放回整体

概率帮助我们描述不确定性。**条件概率研究的是：当你多知道一件事，判断会怎样改变。** 它连接了前面的“事件与样本空间”，也是后面贝叶斯更新和独立性的基础。

## 从一个看得见的范围开始

假设一个学习小组有 20 人，其中 8 人学习统计，5 人既学习统计也学习编程。现在你知道随机选中的同学学习统计。

这条信息把我们的范围从 **20 人缩小到 8 人**。在这 8 人中，5 人也学习编程，所以所求概率是 $5/8$。

## 公式只是把这个关系写下来

$$P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)},\\qquad P(B)>0$$

这里，$B$ 是已经知道的条件；$A\\cap B$ 是同时满足两件事的结果。**分母决定你站在哪个范围里观察，分子决定其中有多少结果符合目标。**

## 再连接回知识框架

如果知道 $B$ 后，$A$ 的概率没有改变，我们会进一步讨论“独立性”；如果想从观察结果反推可能原因，就会走向“贝叶斯更新”。它们共享同一个核心：先说清条件的方向。

你可以先操作下面的范围图，再尝试解释自己的判断。`,
  sourceIds: [],
  cards: [
    {
      id: "sample-simulation",
      kind: "simulation",
      conceptId: "conditional",
      ability: "application",
      title: "动手改变条件范围",
      body: "拖动滑块，观察条件范围大小改变时，同一部分结果所占比例怎样变化。",
      difficulty: 1,
      sourceIds: [],
      plot: {
        kind: "linear",
        min: 5,
        max: 20,
        initial: 8,
        label: "满足条件的人数",
      },
    },
    {
      id: "sample-choice",
      kind: "choice",
      conceptId: "conditional",
      ability: "application",
      title: "你的参照范围是哪一组？",
      body: "已知选中的同学学习统计。要判断他也学习编程的概率，分母应该使用哪一组人？",
      difficulty: 2,
      options: [
        { id: "a", text: "学习小组中的全部 20 人" },
        { id: "b", text: "学习统计的 8 人" },
        { id: "c", text: "同时学习两门课的 5 人" },
      ],
      solution: "b",
      rubric: ["条件 B 限定参照范围，因此分母是学习统计的 8 人。"],
      hints: [
        "先找出题目中“已经知道”的条件。",
        "把不满足这个条件的人暂时移出范围。",
      ],
      sourceIds: [],
    },
    {
      id: "sample-free",
      kind: "free",
      conceptId: "conditional",
      ability: "explanation",
      title: "用自己的话，把关系讲清楚",
      body: "为什么条件概率的分母使用 P(B)，而不是整个样本空间？请用自己的例子解释。",
      difficulty: 2,
      solution:
        "条件 B 已知发生，参照范围缩小到 B，分子为 B 中也满足 A 的部分。",
      rubric: ["说清条件限定范围", "区分目标事件与条件事件", "给出一致的例子"],
      hints: ["把条件看成一条筛选规则。"],
      sourceIds: [],
    },
  ],
};
