# 运行时数据目录 (Runtime Data)

此目录保存 Personal Learning OS 的运行时状态，跨会话持久保存。公开仓库只包含本说明；其余文件均为私人数据，已由 `.gitignore` 排除。

- `learner-profile.md` — 学习者档案（长期稳定）
- `handoff-status.md` — 各课程助教分工与历史核验要点（维护者维护）
- `projects/<project>/state.md` — 各 Project 的 Learning State（热数据）
- `projects/<project>/knowledge-map.md` — 知识地图（只管结构，可带节点 `#id`）
- `projects/<project>/material-index.md` — 资料索引与覆盖缺口
- `projects/<project>/log.md` — 历史学习日志（只追加）
- `projects/<project>/summaries/` — 知识归纳 JSON 与生成的 HTML（只读视图）

## 操作规则

- 首次使用某个 Project 时：用 `assets/` 下对应模板创建 `data/projects/<project>/` 下的四个文件。
- 项目 ID 使用小写 kebab-case，例如 `statistics-101`、`spanish`。
- 每次重要学习活动后：负责该项目的教学对话增量更新 `state.md` 与 `log.md`；新资料或新结构才更新 `material-index.md` / `knowledge-map.md`。
- Project 划分：一个需要持续积累上下文的知识领域 = 一个 Project。
