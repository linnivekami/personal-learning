# Personal Learning OS — 维护手册

当前版本与唯一源目录：[`personal-learning/VERSION.md`](personal-learning/VERSION.md)。架构与文件角色见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 维护职责

- 维护者（维护对话）是 `SKILL.md`、`references/`、`assets/`、`scripts/`、`TEACHING-HANDOFF.md`、版本号、项目结构和发布包的唯一修改者；也维护私有的 `data/handoff-status.md`（课程分工与历史核验要点）。
- 课程助教只负责本课程可验证的学习证据，并增量更新 `data/projects/<p>/`；详见 [`TEACHING-HANDOFF.md`](personal-learning/TEACHING-HANDOFF.md)。
- **维护不是学习活动**：不改 Mastery、Confidence、Last Verified、Memory、日志与 Next Action；只在交接要求时为历史等级补“待按 v1.2 核验：<缺口>”标记，不补造证据。
- 审计发现课程数据问题（如新等级缺 `累积证据：`）时，记录到 `data/handoff-status.md` 并通知对应助教处理，不代改分数。

## 变更流程

1. 改动前把将要修改的协议文件快照到本地 `archive/<日期>-pre-<版本>/`（不公开）。
2. 修改协议 / 模板 / 脚本；在 `VERSION.md` 追加版本记录（公开文件不写具体课程与进度）。
3. 运行 `scripts/audit.sh`：结构、知识地图无状态标记、Mastery 证据（`累积证据：`、结构化 events 或待核验标记）、知识归纳文件与模板离线性、示例与 summaries JSON 校验、公开文件隐私、过时规则。
4. 运行 `scripts/release.sh`：审计 → 重建 `personal-learning-skill.zip` 与 `dist/personal-learning.zip` → `verify_release.py` 逐字节校验。
5. 提交前确认 `git ls-files` 不含 `data/learner-profile.md`、`data/projects/`、`data/handoff-status.md`、`tests/`、`archive/`、zip。
6. 通知各课程助教重新读取 `VERSION.md`、`SKILL.md`、`TEACHING-HANDOFF.md`。

## 发布检查

1. `scripts/audit.sh` 通过。
2. `unzip -t personal-learning-skill.zip`。
3. 包内含最新 `VERSION.md`、`TEACHING-HANDOFF.md`、全部 references / assets / scripts、Learner Profile 与全部项目。
4. 两个发布包逐字节一致（`verify_release.py`）。

## 长期规则

1. 各项目保留原学习目标；历史缺证据的等级按 state 中“待按 v1.2 核验”处理，不批量补测。
2. Confidence 关键任务按需采集，未采集原因可合法记录；校准依据同题表现。
3. 旧模式只留跳转说明（如 `references/mind-map.md` → 知识归纳），完整旧文快照在本地 `archive/`。
4. IELTS 子系统（`ielts-learning-os/`）独立维护，不随主系统重构。

## 软件平台（可选）

若本地存在配套平台项目 `personal-learning-platform/`：教学引擎源在其 `shared/`，`npm run skill:sync` 会把 `engine.mjs`、`policy.json`、`state.mjs` 与 `teaching-contract.md` 同步进 `personal-learning/`。修改这些文件时先改平台源再同步，否则会被覆盖。平台验证运行 `npm run check`、`npm run build`、`npm run validate`、`npm run test:browser`；私人迁移文件在平台 `private/`，不得发布。
