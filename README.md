# Personal Learning OS

当前主系统版本为 **v2.0.0**。当前系统源目录是 [`personal-learning/`](personal-learning/)；教学对话与维护对话均应从此目录读取和写入。

## 软件平台

[Personal Learning 平台源码与启动说明](personal-learning-platform/README.md) · [部署与安全配置](personal-learning-platform/docs/DEPLOYMENT.md) · [完整验收状态](personal-learning-platform/docs/ACCEPTANCE.md)

软件与 Skill 共享教学状态引擎；个人记录不包含在公开源码或演示数据中。当前提供完整功能代码与内部验收环境，真实模型、语音、邮件、Google 登录及生产恢复仍需服务配置和验收后正式上线。

## 快速入口

- 教学对话：[TEACHING-HANDOFF.md](personal-learning/TEACHING-HANDOFF.md)
- 维护与版本：[VERSION.md](personal-learning/VERSION.md)
- 核心协议：[SKILL.md](personal-learning/SKILL.md)
- 运行数据：[data/](personal-learning/data/)
- 发布包：`personal-learning-skill.zip`、`dist/personal-learning.zip`

根目录的 `archive/` 保存早期只读快照及升级前回退快照，不能作为运行数据来源。

## 思维导图模式

直接说“用思维导图浏览 ISOM3540 知识点”或“给我条件概率的知识点总览”。系统先展示简洁结构，再按需深入：

| 你说 | 系统会做 |
| --- | --- |
| 展开 3 / 展开条件概率 | 查看该分支的知识点与一句核心含义 |
| 返回上一级 / 返回总览 | 回到原结构，保留分支编号 |
| 查看关联 | 展示先修、对比或应用关系 |
| 显示掌握度 / 只看薄弱点 | 从当前 state 临时标注或筛选，保留待核验说明 |
| 解释贝叶斯 / 给我一道练习 | 从所选节点进入讲解或练习 |

仅浏览不会增加掌握度或覆盖原 Next Action。规则见 [mind-map.md](personal-learning/references/mind-map.md)，验证记录见 [REVIEW.md](tests/mind-map-v1.3.0/REVIEW.md)。已有教学对话使用新模式前，重新读取最新 VERSION、SKILL 与 TEACHING-HANDOFF。

## v1.2.0 优化与验证

- [实施报告](tests/tutor-v1.2.0/REPORT.md)
- [历史待核验清单](tests/tutor-v1.2.0/historical-review.md)
- 行为原始回复与评分保存在 `tests/tutor-v1.2.0/`；教学对话继续前重新读取最新版本与交接卡。
