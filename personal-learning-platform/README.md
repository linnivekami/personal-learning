# Personal Learning

面向大学生的中英双语学习工作台：用知识框架组织讲解，用学习证据调整指导与下一步任务。

React / Vite PWA + Hono。同一份服务端代码可运行在 Cloudflare Workers（D1、R2、Queues、Cron），或运行在 Node（`server/node.ts`：node:sqlite、文件存储、进程内任务，正式环境部署在 Fly.io）。界面采用 Pathline 的 Transit 视觉语言，可用 Pathline 账号登录（OIDC）。

AI 讲解、出题、作答评估、速查表和网页读取统一接入 DeepSeek Responses API。服务端把模型名固定为 `deepseek-flash`，请求数据和环境变量都不能切换模型；Flash 调用失败时直接报错，不自动降级到更贵的 Pro 模型。

线上地址：https://personal-learning-kevin.fly.dev （代码运行区：https://personal-learning-runner-kevin.fly.dev）。

主要页面：今天（跨课程唯一的下一小步、到期复习、学习线路）· 学习工作台（知识线路、讲解与练习、掌握度证据面板、线路图、交给我的 AI 助教）· 复习 · 速查表（按考试范围生成严格两页 A4，每面三栏；公式/易错点可高亮；打印或存 PDF）· 课程 · 笔记 · 资料 · 代码实验室 · 成长 · 设置。教学规则与原 Personal Learning Skill 共享版本，Mastery 和奖励分别计算。内置概率课程是人工编写的演示内容，没有虚构学习记录。

```sh
npm ci
npm run dev
```

打开 http://localhost:8787 。本地开发身份仅在 `APP_ENV=development` 且 `DEV_AUTH=1` 时启用。代码运行区在 http://localhost:8788 ，无账号接口。首次运行自动应用本地数据库迁移。Node 22.12+；本工程验证环境为 Node 26。

Node 运行方式（与 Fly.io 相同）：`npm run dev:node`。

```sh
npm run check
npm run build
npm run validate
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
```

- [部署与密钥](docs/DEPLOYMENT.md)：Fly.io（当前线上）、Cloudflare、独立运行域、Pathline 登录、阿里云语音、DeepSeek、邮件、Google 和 Cloud Run。
- [维护、费用和恢复](docs/OPERATIONS.md)：预算控制、失败任务、备份恢复和删除。
- [迁移与 Skill](docs/MIGRATION.md)：版本、冲突预览、原始证据和私有资料。
- [当前交付状态](docs/STATUS.md)：本地测试及私有验收地址。
- [验收记录](docs/ACCEPTANCE.md)：已验证与需真实服务配置后验证的项目。
- [教学契约](shared/teaching-contract.md)：累计等级与状态事件。

全部首发模块按完整方案实现和验收，未配置的外部服务会明确报告不可用。公开演示不代表已完成真实账号、付费 API、邮件、推送或生产恢复验收；未通过完整验收前不作为正式上线。
