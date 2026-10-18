# Personal Learning OS — 维护控制台

当前版本与唯一源目录：[`personal-learning/VERSION.md`](personal-learning/VERSION.md)。

## 维护职责

- 维护对话是 `SKILL.md`、`references/`、`assets/`、版本号、项目结构和发布包的唯一修改者。
- 教学对话负责本轮可验证学习证据，并增量更新目标项目数据；详见 [`TEACHING-HANDOFF.md`](personal-learning/TEACHING-HANDOFF.md)。
- 修改完成后，维护对话负责审计：状态/地图不重复、Mastery 有对应证据或历史待核验标记、Confidence 有真实自评或未采集说明、Next Action 可在 5–15 分钟启动，以及发布包与源目录一致。

## 平台与共享核心（2026-10-18）

- 教学规则源为 `personal-learning-platform/shared/`；`npm run skill:sync` 同步到 Skill 和可发布副本。
- 平台验证运行 `npm run check`、`npm run build`、`npm run validate`、`npm run test:browser`；历史状态继续运行根目录审计。
- 新高等级使用结构化 events 及 Skill CLI 审计，不依赖中文关键词或固定课程/行数。
- 私人迁移文件在 `personal-learning-platform/private/`，不要发布；公开源与源码快照均排除密钥、日志和用户资料。
- 软件生产配置、账单、恢复与完整验收分别见平台 docs/。私有验收站点不代表完成正式上线。

## 既有维护队列（2026-10-08）

1. 各项目保留原学习目标；历史缺证据的等级按 state 中“待按 v1.2 核验”处理，不批量补测。
2. 维护更新不是学习活动，不改 Last Verified、不补造信心、不覆盖历史日志。
3. Confidence 关键任务按需采集，未采集原因可合法记录；校准依据同题表现。
4. 协议/模板/目录变更后：更新版本 → 审计 → 行为案例验证 → 重建两个主系统 zip → 对照源目录校验。
5. 思维导图模式的回退快照与验证记录见 `archive/2026-10-08-pre-v1.3.0/`、`tests/mind-map-v1.3.0/REVIEW.md`；v1.2 教学升级记录保留在原目录。IELTS 独立维护。

## 发布检查

1. `scripts/audit.sh`
2. `unzip -t personal-learning-skill.zip`
3. 确认包内含最新 `VERSION.md`、`TEACHING-HANDOFF.md`、全部 assets、Learner Profile 与全部项目。
4. 确认两个发布包内容一致。
