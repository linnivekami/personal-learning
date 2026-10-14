# 运行时数据目录 (Runtime Data)

此目录保存 Personal Learning OS 的运行时状态，跨会话持久保存。`personal-learning/` 是唯一源目录；根目录的旧文件或 zip 中的文件均不是日常编辑目标。

- `learner-profile.md` — 学习者档案（长期稳定）
- `projects/<project>/state.md` — 各 Project 的 Learning State
- `projects/<project>/knowledge-map.md` — 各 Project 的知识地图
- `projects/<project>/material-index.md` — 各 Project 的资料索引
- `projects/<project>/log.md` — 各 Project 的历史学习日志（只追加）

## 操作规则

- 首次使用某个 Project 时：用 `assets/` 下对应模板创建 `data/projects/<project>/` 下的文件。
- 项目 ID 使用小写 kebab-case，例如 `machine-learning`、`isom3770`。
- 每次重要学习活动后：教学对话增量更新对应的 `state.md` 与 `log.md`；新资料或新结构才更新 `material-index.md` / `knowledge-map.md`。
- Project 划分：一个需要持续积累上下文的知识领域 = 一个 Project。
