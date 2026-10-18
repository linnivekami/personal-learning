# Personal Learning

面向大学生的中英双语学习工作台：用知识框架组织讲解，用学习证据调整指导与下一步任务。

React / Vite PWA + Hono / Cloudflare Workers、D1、R2、Queues / Cron。教学规则与原 Personal Learning Skill 共享版本，Mastery 和奖励分别计算。内置概率课程是人工编写的演示内容，没有虚构学习记录。

```sh
npm ci
npm run dev
```

打开 http://localhost:8787 。本地开发身份仅在 `APP_ENV=development` 且 `DEV_AUTH=1` 时启用。代码运行区在 http://localhost:8788 ，无账号接口。首次运行自动应用本地数据库迁移。Node 22.12+；本工程验证环境为 Node 26。

```sh
npm run check
npm run build
npm run validate
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
```

- [部署与密钥](docs/DEPLOYMENT.md)：正式 Cloudflare、独立运行域、阿里云语音、DeepSeek、邮件、Google 和 Cloud Run。
- [维护、费用和恢复](docs/OPERATIONS.md)：预算控制、失败任务、备份恢复和删除。
- [迁移与 Skill](docs/MIGRATION.md)：版本、冲突预览、原始证据和私有资料。
- [当前交付状态](docs/STATUS.md)：本地测试及私有验收地址。
- [验收记录](docs/ACCEPTANCE.md)：已验证与需真实服务配置后验证的项目。
- [教学契约](shared/teaching-contract.md)：累计等级与状态事件。

全部首发模块按完整方案实现和验收，未配置的外部服务会明确报告不可用。公开演示不代表已完成真实账号、付费 API、邮件、推送或生产恢复验收；未通过完整验收前不作为正式上线。
