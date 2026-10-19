# 记录、Skill 与迁移

原 Skill 仍在上级目录 `personal-learning/`，当前版本 2.0.0。平台共享核心位于 shared/；`npm run skill:sync` 把同一状态引擎、策略参数和教学契约打包进 Skill。改变教学规则后同步、运行核心用例和独立教学场景，再更新版本。不要直接手改生成的 Skill 引擎。

## 私人历史迁移

```sh
npm run migrate:legacy
```

默认只读取上级 Personal Learning 的 data/learner-profile.md 及 data/projects/，输出 `private/legacy-import.json`。可以指定源和输出路径：`node scripts/import-legacy.mjs SOURCE OUTPUT`。程序按实际目录与表头遍历，不硬编码课程数量。当前六门课程、85 条历史掌握行原样保留原始日期、Evidence、提示和待核验信息；只知道日期的记录不伪造时刻。日志、地图、资料索引和原 Next Action 全文保存在 legacy_data。

先在正式站点登录你自己的账号，再在学习设置选择文件、预览课程与冲突，确认后导入。不要将该文件作为演示数据上传到公共项目或共享账号。导入发生在当前认证用户下，重新分配数据库 ID，不能覆盖其他人的课程。全部校验完成后才事务提交；同名课程需先解决冲突。

历史分数显示为历史分数并待核验；当缺口影响当前任务时做最小复测。不会给所有历史记录统一补考，不因导入赠送新 XP 或直接升级。原始 Markdown 文件保留；软件没有静默写回。

## 交换与导出

学习设置提供版本 2 JSON 导出，以及含原始文件、规范化 PDF、页面图像、朗读缓存的私有 ZIP 归档。ZIP 内 `personal-learning-export.json` 是可预览导入的记录；files/ 是二进制附件。二进制文件不会从导入文件给出的 object_key 直接读取，以防跨账号引用；在新环境恢复附件时使用自己归档中的文件重新上传。

原始导入档案可经 `/api/v1/courses/:id/archive` 读取，仅所有者有权访问。导入历史 events 保留时间、辅助程度和原始证据，source 标为 legacy；原 source 标签保留在归档中。日期不明或过程缺失的文本停留在历史档案，不伪造结构化“已验证”事件。

## Skill 状态工具

新证据用 `node personal-learning/scripts/state.mjs apply --state state.json --concepts concepts.json --event event.json --revision N` 预览；确认实际证据后加 `--commit`。工具输出等级、复习安排和 Next Action，检查 revision 并写入备份，不重复提交同一 attemptId。`audit` 从事件重放；`grade --events ...` 返回累计等级。

根目录审计保留冻结的升级前文本基线，表示历史兼容而非证据真伪认证。新独立等级或修改后的独立等级要求结构化 events，不能通过写几个中文关键词骗过审计。根目录 `scripts/audit.sh` 与平台测试都要运行。
