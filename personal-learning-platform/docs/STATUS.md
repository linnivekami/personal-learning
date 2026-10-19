# 交付状态 · 2026-10-19 晚

DeepSeek 已接入并部署到 https://personal-learning-kevin.fly.dev 。

- 模型：讲解、出题、作答评估、速查表、网页搜索与读取全部通过 DeepSeek Responses API；服务端常量固定为 `deepseek-flash`，请求数据、环境变量和管理后台都不能改模型，也没有 Pro 回退。
- 可靠性：结构化输出不符合 schema 时用 Flash 自动重试一次，仍失败则不写入学习状态；服务端只记录失败字段路径，不把模型原文或私人作答写进日志。
- 验证：116 个单元/集成测试通过；用真实密钥在本地同版本构建上完成结构化讲解生成和自由作答评估（partial 判定），并单独验证图像输入、JSON schema 与 Search/Fetch 接口可用。
- 线上：`DEEPSEEK_API_KEY` 已写入 Fly secret，`/api/v1/config` 的 `services.model` 为 true；在部署机器内直接调用 Responses API 返回 `HTTP 200 / model deepseek-flash / completed`。完整 30 分钟教学场景和登录后的真实付费调用仍按 ACCEPTANCE.md 验收。

---

# 交付状态 · 2026-10-19 · v2.0.0 平台升级

- 结构：服务端拆分为 `server/routes/*`；新增 Node 运行层（node:sqlite 的 D1 适配器、文件 R2 适配器、进程内队列与分钟级 Cron），Workers 版本保持可用；测试改为使用同一个 D1 适配器。前端拆分为 `src/app`（外壳、路由、语言、数据）、`src/features/*`、`src/ui`、`src/lib`，支持可收藏的路径路由（`/learn/<课程>/<知识点>` 等）。
- 功能：今天页（跨课程唯一下一小步、到期复习、学习线路）；掌握度证据面板（当前等级、下一关清单、最早复测时间、证据记录）；分层布局的知识线路图；“交给我的 AI 助教”交接导出；AI 未配置时的明确降级；用 Pathline 账号登录（PKCE、ES256 校验、就绪探测）；考试速查表（按考试范围生成严格两页 A4、每面三栏、公式/易错点可高亮、打印或存 PDF）。
- 界面：Pathline Transit 视觉（墨黑 + 信号黄、Barlow、站点表示掌握度），深浅色、手机底部导航。
- 验证：114 个单元/集成测试（含 Pathline 登录 3 个、掌握度说明 4 个、速查表 9 个）、6 个浏览器场景通过；速查表已在 Chromium 中实际生成并打印为严格两页 A4；线上 SQL 与 Python（NumPy）在独立运行域执行成功。

Pathline 已于 2026-10-19 发布并登记本站为 OIDC 客户端（`personal-learning`），“用 Pathline 账号登录”在线上已就绪；Pathline「学习提升」页有本站入口。尚未用真实已验证学生账号走完整登录；邮件、语音、Google、文档转换仍待配置密钥；`ADMIN_EMAILS` 需填写你的 Pathline 学校邮箱。DeepSeek 已于当晚接入，见上方最新状态。

---

# 交付状态 · 2026-10-18

平台代码、共享教学核心、Skill v2.0.0、私人迁移工具、部署配置、配置向导、管理员后台和维护文档已落地。原 Skill 的两个本机发布包已同步并逐字节验证；它们包含私人运行资料，仅保存在本机，不属于公开源码。

本次验证：98 个教学、API、媒体、Skill 和恢复测试通过；四项真实浏览器场景通过；根目录结构审计及七项历史审计回归通过；锁定依赖的 npm 漏洞扫描为 0。浏览器实际执行 SQLite OO1、Pyodide、NumPy、pandas 与 Matplotlib，包含图表输出和独立来源隔离。另验证 Better Auth 验证码哈希存储、持久会话与验证码重放拒绝（邮件传输为模拟，不代表真实送达）。恢复测试实际生成加密备份、解密 SQL 并导入新的空数据库。

私有内部验收地址：https://personal-learning-kevin.civilmug3.chatgpt.site 。站点只允许所有者访问；已验证托管身份、后台权限与 D1 数据库。它使用托管平台身份方便本人验收。计划中的正式公开站点仍使用 Better Auth 邮箱验证码及 Google 登录，部署到自有 Cloudflare 账号。

这个地址不是正式发布：DeepSeek、阿里云语音、Resend、Google OAuth、Cloud Run、独立正式运行域，以及正式 Cron/Queues 和供应商恢复演练均等待相应账号配置后验证。界面会明确标注服务未配置；没有用模拟成功替代真实调用，也没有自动导入私人学习记录。完整发布闸门见 ACCEPTANCE.md。
