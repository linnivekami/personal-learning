# 部署

使用你自己的 Cloudflare 账号作为生产环境，以便直接管理 D1 Time Travel、Cron、Queues、R2 和账单。保留一个独立、无登录态的代码运行域。源码不包含第三方密钥或个人学习记录。

## 1. 本地配置

运行 `npm run configure`，在终端安全输入已有账号的配置；密钥不回显，保存于 `.dev.vars`（权限 0600，Git 忽略）。重复运行保留认证与推送密钥。生产配置不包含 DEV_AUTH。不要在聊天里发送密钥。

普通配置：APP_ENV、IDENTITY_MODE、APP_ORIGIN、SANDBOX_ORIGIN、ADMIN_EMAILS、DASHSCOPE_BASE_URL、MAIL_FROM、CONVERTER_URL、VAPID_PUBLIC_KEY、VAPID_SUBJECT、MONTHLY_BUDGET_FEN。敏感配置：BETTER_AUTH_SECRET、DEEPSEEK_API_KEY、DASHSCOPE_API_KEY、RESEND_API_KEY、GOOGLE_CLIENT_SECRET、CONVERTER_TOKEN、VAPID_PRIVATE_KEY。Google Client ID 可以是普通配置。

## 2. Cloudflare

在已登录的终端运行：

```sh
npx wrangler login
npx wrangler d1 create personal-learning --location apac
npx wrangler r2 bucket create personal-learning-files
npx wrangler queues create personal-learning-tasks
npx wrangler queues create personal-learning-failed
```

把返回的 D1 UUID 写入 `wrangler.jsonc` 的 database_id。该文件目前使用明确的本地占位数据库 ID，不能直接当成生产资源。将 vars 中 APP_ORIGIN 改为正式 HTTPS 地址，并补上其余普通配置。通过 Cloudflare Dashboard 或 `npx wrangler secret put NAME` 写入密钥；命令交互输入，不把值放进命令行历史。启用 Workers Paid 常规计划；原始文件桶保持私有。

```sh
npm run db:generate
npx wrangler d1 migrations apply DB --remote
npm run build
npx wrangler deploy
```

为 Worker 绑定正式学习域名。配置中的 Cron 每分钟执行到期任务和提醒，Queues 处理解析；死信队列独立存在。通过 Dashboard 确认 Cron 已启用、队列消费已绑定，不能仅凭部署命令成功判定提醒可用。

## 3. 独立运行域

运行 `npm run build:runner`，再使用 `npx wrangler deploy --config wrangler.runner.jsonc` 部署运行区 Worker，绑定 `runner.example.com`。它只提供 `/sandbox/` 静态文件，其他路径返回 404，没有数据库、登录或文件绑定。将主应用 SANDBOX_ORIGIN 指向它，并重新部署。两个来源必须不同。运行库版本固定；仅加载指定版本目录。学习页面不执行模型生成的脚本。

## 4. DeepSeek 与阿里云

DeepSeek 设置 DEEPSEEK_API_KEY。适配层使用 `deepseek-flash` Responses API 和 Search / Fetch 接口；不自动切换更贵模型。先用测试账号验证结构化讲解、图像页识别、应用评估、超时和格式错误，再开放付费调用。

阿里云使用新加坡地域工作空间；DASHSCOPE_BASE_URL 为工作空间控制台给出的 `/compatible-mode/v1` 地址，不能混用中国区密钥。语音模型为 qwen3-asr-flash、qwen3-tts-flash。录音编码为 PCM WAV，服务端校验真实时长；转写可修改后才提交证据。TTS 按段缓存，中文按两个计费字符核算。

官方接口：[DeepSeek Responses](https://api-docs.deepseek.com/api/create-response/)、[Search / Fetch](https://api-docs.deepseek.com/guides/search/)、[阿里云 ASR](https://www.alibabacloud.com/help/en/model-studio/qwen-asr-api-reference)。

## 5. 登录与邮件

Resend 验证发件域名和 DNS；MAIL_FROM 使用已验证地址。Google OAuth Web Client 添加应用正式来源，回调地址为 `https://learning.example.com/api/auth/callback/google`。公开注册由 Better Auth 邮箱验证码及 Google 登录完成。ADMIN_EMAILS 仅在服务端授予后台权限。认证密钥至少 32 字符，升级时保留它。

邮件提醒默认关闭，用户自行订阅；每封提醒包含取消订阅链接。平台邮件发送每天保守限制 90 封，为常规免费额度留余量。iPhone 推送要求主屏幕安装和用户授权；拒绝通知仍可使用站内任务。[WebKit 要求](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 6. Cloud Run 文档转换

在 Google Cloud 控制台启用 Cloud Run、Cloud Build、Artifact Registry，使用新加坡 asia-southeast1。通过 Secret Manager 创建 CONVERTER_TOKEN 并授予服务账号只读该密钥权限。服务不拥有模型、数据库或 R2 凭据。

```sh
gcloud run deploy personal-learning-converter --source converter --region asia-southeast1 --min-instances 0 --max-instances 1 --concurrency 1 --cpu 1 --memory 2Gi --timeout 240 --no-cpu-boost --allow-unauthenticated --set-env-vars APP_ORIGIN=https://learning.example.com --set-secrets CONVERTER_TOKEN=personal-learning-converter-token:latest
```

服务使用应用层共享密钥验证请求，回调再使用单任务、短期授权；虽然 Cloud Run 接受入口请求，未携带有效令牌不能转换。按请求计费、最小实例 0。设置 Google Cloud 账单提醒；账单提醒本身不会硬停机。Office 外部关系、宏、嵌入对象、压缩炸弹和超大文件拒绝处理，原始文件保留并显示失败原因。

## 发布闸门

完成 docs/ACCEPTANCE.md 的真实服务场景、手机与电脑检查、两用户隔离和恢复演练，再开放正式注册。域名和服务未配置时只进行内部验收，不将它称为完整正式上线。
