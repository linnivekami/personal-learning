# Personal Learning OS v1.0 — Skill 使用指南

> **维护更新（2026-09-10）：**本文件保留为原始使用指南。当前运行源、版本与教学交接以 [`README.md`](README.md) 和 `personal-learning/` 为准；不要再以 zip 或根目录副本作为日常编辑目标。

## 这是什么

你的《Personal Learning OS v1.0》框架已被落实为一份 CodeBuddy **用户级 skill**（`personal-learning`），已安装到 `~/.codebuddy/skills/personal-learning/`，无需额外配置即可在所有工作区使用。

AI 会以 **Tutor + Coach + Examiner + Knowledge Manager** 四重角色工作，严格执行你框架中的协议：
先问再教、提示先于答案、具体先于抽象、输出优于重读、最小启动成本、熟悉≠掌握。

## 安装状态

| 项 | 位置 |
| --- | --- |
| Skill 主目录 | `~/.codebuddy/skills/personal-learning/` |
| 核心协议 | `SKILL.md` |
| 详细协议 | `references/`（流水线、状态、模式、掌握度、Next Action） |
| 模板 | `assets/`（画像、状态、知识地图） |
| 运行时数据 | `data/`（学习者档案 + 各 Project 的 Learning State） |
| 分发备份 | `Personal Learning/dist/personal-learning.zip` |

## 怎么用（四句话入门）

1. **喂资料**：直接说"这是我今天老师发的资料"或拖入 PDF/PPT/笔记，AI 会自动执行 `INGEST → MAP → DIAGNOSE → 开始教学`。
2. **继续学习**：下次打开直接说"继续"，AI 会读取 Learning State，从上次的 **Next Action** 接着教。
3. **复习/备考**：说"帮我复习假设检验"或"下周五考试"，AI 自动切换对应模式（复习 / Exam Mode）。
4. **快速了解**：说"帮我快速了解一下这个 PDF"，AI 走 Quick Mode（只算 Exposure，不会假装你学会了）。

## 常用指令示例

| 你说 | AI 会做 |
| --- | --- |
| "这是我今天老师发的统计资料" | 识别资料 → 建知识地图 → 诊断 → 开始教学 |
| "继续" | 读取状态 → 从 Next Action 继续（先做检索检查） |
| "我忘了学到哪了" | 无零日恢复：诊断 → 找回状态 → 给最小任务 |
| "帮我解释一下 P-value" | 先引导你自己说 → 按 Hint Ladder 逐级提示 |
| "下周五考 GRE" | 切换 Exam Mode，考前强化 |
| "帮我快速了解这个 PDF" | Quick Mode，只加 Exposure |
| "今天只能学 10 分钟" | 给最小练习包：2 个检索题 + 1 个应用 + 1 个更新 |

## 核心机制速查

- **Hint Ladder**：卡住时逐级 L0→L5 提示，不直接给答案（除非你明确要求）。
- **Mastery 0–5**：默认 **Level 3（可独立应用）= 可用**；做对一题 ≠ 掌握。
- **Learning State**：每次重要学习后自动更新 `data/projects/<Project>/state.md`，记录掌握度、薄弱点、错误、信心、复习安排、Next Action。
- **防拖延**：永远只给"现在做什么"，不给"学完 Chapter 4"；5–15 分钟即可启动。
- **项目划分**：一个需要长期积累的领域 = 一个 Project（如 Statistics、Spanish、ML），不按 PDF 拆分。

## 修改与升级

- 想改教学协议：编辑 `SKILL.md` 或 `references/`。
- 想改自己的画像：编辑 `data/learner-profile.md`。
- 想升级后分发：`python3 ".../skill-creator/scripts/package_skill.py" ~/.codebuddy/skills/personal-learning <输出目录>`。
- 按框架 v1.0 精神：先实际运行，发现"这字段没用"就删，发现"这里缺信息"再加。
