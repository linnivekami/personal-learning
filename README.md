# Personal Learning OS

**一个让 AI 当你的私人助教、但不替你学习的个人自学系统。** 它是一套纯 Markdown 的教学协议与状态文件：AI 按协议诊断、讲解、出题和安排复习，并把**有证据的**学习进度写进普通文件，下次任何 AI 都能接着教。

当前版本：**v2.1.0**（见 [VERSION.md](personal-learning/VERSION.md)）

## 特点

- **证据驱动的掌握度**：0–5 级累积门槛——首次无提示做对才到 2，≥2 天后无提示复测才到 3。看过、听懂、浏览复习页都不算掌握。
- **跨会话记忆**：每门课一个 `state.md`（薄弱点、错误、信心、复习时间、下一步），换对话、换 AI 都能无缝继续。
- **知识归纳 HTML**：一句话生成单文件复习页——薄弱点优先、知识分类树、每个知识点的核心 / 详解 / 结构判据 / 例子 / 易错点 / 关联 / 自测；离线可用、可搜索筛选、深浅色、可打印。[看演示](personal-learning/examples/knowledge-summary-demo/)
- **四种模式**：Normal（长期掌握）、Exam（考前冲刺）、Quick（对话内概括）、Knowledge Summary（知识归纳）。
- **防拖延**：永远只给一个 5–15 分钟可开始的下一步；中断几天直接说“继续”。
- **多助教协作**：每门课可以有自己的助教 bot，只写自己的课程数据；协议由一个维护者统一管理和审计。
- **适配任何 agent**：不依赖特定平台。只要 AI 能读写本地文件（Claude Code、Codex、Cursor、各类桌面 / 云端 agent 等），把 `SKILL.md` 交给它即可。

## 安装到你的 AI 工具

先下载：`git clone https://github.com/linnivekami/personal-learning.git`（或在 GitHub 页面点 Code → Download ZIP）。技能本体就是 `personal-learning/` 文件夹，核心是其中的 `SKILL.md`。

| 工具 | 安装方式 |
| --- | --- |
| Claude Code | 复制到个人技能目录：`cp -r personal-learning ~/.claude/skills/`（只想在某个项目里用，就放到项目的 `.claude/skills/`）。之后说“继续学习”或“帮我快速了解这门课”即可触发。 |
| Claude.ai / Claude 桌面版 | 运行 `scripts/release.sh` 生成 `personal-learning-skill.zip`，或自己把 `personal-learning/` 压缩成 zip，在设置的 Skills 里上传。注意：网页版不能长期保存你的 `data/`，每次结束前让它输出更新后的 `state.md` 自行保存。 |
| Codex / Cursor / 其他能读写文件的 agent | 把仓库放进工作区，在对话开头说：“请读取 `personal-learning/SKILL.md` 并严格按它工作。”也可以把这句话写进 `AGENTS.md` 或项目规则文件。 |
| 只能上传文件的聊天 AI | 上传 `SKILL.md`、你的 `learner-profile.md` 和目标课程的 `state.md`，结束前让它输出更新后的 `state.md` 全文。 |

你的学习数据会写在 `personal-learning/data/` 下，这个目录已加入 `.gitignore`，不会被提交。

## 快速开始

1. 克隆仓库，把 `personal-learning/` 作为技能目录交给你的 AI agent（或在对话开头让它读取 `personal-learning/SKILL.md`）。
2. 复制 `personal-learning/assets/learner-profile.md` 到 `personal-learning/data/learner-profile.md` 并填写。
3. 对 AI 说：“这是我这门课的资料，我想扎实掌握”——它会建立资料索引、知识地图和学习状态。
4. 之后只需说：“继续”“帮我快速了解这门课”“下周三考试”“今天只有 10 分钟”。

更多说法见 [使用指南](docs/USER-GUIDE.md)。

### 试一下知识归纳构建器

```bash
cd personal-learning
python3 scripts/build_summary.py examples/knowledge-summary-demo/cards.json \
  --state examples/knowledge-summary-demo/state.md \
  --map examples/knowledge-summary-demo/knowledge-map.md \
  --out /tmp/stats-overview.html
```

只需 Python 3 标准库；生成的 HTML 不引用任何外部脚本、字体或样式。

## 软件平台与考试工具

仓库里还有两个可直接使用的实现，和上面的技能协议分开维护：

- **`personal-learning-platform/`**：React/Vite + Hono 学习工作台，可运行在 Node 或 Cloudflare Workers。AI 讲解、练习评估和**考试速查表**：按考试范围与知识点生成严格两页 A4（正面、反面各三栏），公式与易错点可高亮，可打印或存 PDF。开发和部署见 [`personal-learning-platform/README.md`](personal-learning-platform/README.md)。
- **`isom3770-gapcheck/`**：ISOM 3770 考前**查缺补漏练习**。单文件、离线可用；10–100 题，全英文 A–E 单选（E = 不知道），交卷后按 Session、题型和 69 个知识点诊断，可导出 JSON。直接打开根目录的 [`ISOM3770_Midterm_GapCheck.html`](ISOM3770_Midterm_GapCheck.html) 即可，说明见 [`isom3770-gapcheck/README.md`](isom3770-gapcheck/README.md)。

## 目录结构

```
personal-learning/            唯一源目录（技能本体）
├── SKILL.md                  核心教学协议
├── TEACHING-HANDOFF.md       课程助教启动卡
├── VERSION.md                版本与变更记录
├── references/               细则：流水线、状态字段、掌握度、模式、知识归纳、Next Action、教学契约
├── assets/                   模板：画像、state、知识地图、日志、资料索引、知识归纳 HTML 与卡片 JSON
├── scripts/                  build_summary.py（知识归纳构建）、state.mjs（可选结构化证据）
├── shared/                   与软件平台共享的教学引擎与策略（生成副本）
├── examples/                 公开演示数据
└── data/                     你的私人数据（不进仓库，只有 README）
personal-learning-platform/   软件平台（React/Vite + Hono；含考试速查表生成）
isom3770-gapcheck/            ISOM 3770 查缺补漏练习源码（根目录另有构建好的单文件）
docs/                         架构说明、使用指南、历史文档
scripts/                      维护工具：audit.sh、audit_state.py、release.sh、verify_release.py
ielts-learning-os/            独立维护的 IELTS 子系统
SYSTEM-MAINTENANCE.md         维护者手册
```

架构与学习闭环图见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 隐私

学习者画像、各课程状态与日志、知识归纳成品、测试记录和发布包都在 `.gitignore` 中排除，公开仓库只包含协议、模板、脚本、演示与文档。`scripts/audit.sh` 会检查公开文件里是否出现私有课程 ID。课程资料通常受版权保护，请勿提交。

## 维护者

修改协议、模板或脚本后：更新 `VERSION.md` → `scripts/audit.sh` → `scripts/release.sh` → 提交。详见 [SYSTEM-MAINTENANCE.md](SYSTEM-MAINTENANCE.md)。软件平台在 `personal-learning-platform/`，`personal-learning/shared/` 是其共享教学引擎的生成副本。

## 许可证

[MIT](LICENSE)。可以自由使用、修改和分发，保留版权声明即可。课程资料与个人学习数据不在许可范围内。
