# Knowledge Map — <Course / Domain>

> **本文件只管知识结构，不标掌握状态。**
> 状态统一记在 `state.md` 的 Mastery 表——避免两处维护导致不同步。

```
<Top-Level Topic>
├── 1 Subtopic
│   ├── Concept `#concept-id`
│   ├── Concept `#concept-id`
│   └── Business Application `#concept-id`
├── 2 Subtopic
│   └── Concept `#concept-id`
└── Prerequisites
    ├── Concept
    └── Concept
```

## 维护规则

- **不写** `[3+]` / `[D]` / `[?]` 等状态标记
- 需要掌握度 → 查 `state.md`
- **结构变化时**更新本文件；**掌握度变化时不更新**本文件
- 节点末尾的 `` `#id` `` 是可选的稳定 ID（小写、连字符），供知识归纳卡片、讲解与练习对齐；不是状态标记。
- 知识归纳模式以本文件为分类骨架，详见 `references/knowledge-summary.md`；页面上的徽章与筛选不写回本文件。

## Prerequisites（先修知识）

这里只列结构上的先修依赖；是否已具备、是否存在缺口及验证日期统一记录在 `state.md`，供 Next Action 优先修补：

```
Prerequisites
├── <先修概念 A> → 支撑 <主题 A>
└── <先修概念 B> → 支撑 <主题 B>
```

## 跨领域连接

```
<Domain A> → <Domain B> → <Domain C>
```

已建立的连接：
- 

待加强的连接：
- 
