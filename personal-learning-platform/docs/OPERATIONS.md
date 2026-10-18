# 维护、费用与恢复

## 预算

默认每月 ¥300：基础设施 ¥70、教学与搜索 ¥130、语音 ¥60、余量 ¥40。模型和语音请求先事务预占，完成后按返回使用量结算；不确定的超时按预占额保守记账，重试重新预占。并发预占同时检查个人日/月额度、分项和全站可调用预算。预算耗尽停止新增付费调用，保留资料、笔记及本地练习。

后台显示实际结算、待结算及失败任务，配置所有个人额度、存储额度和预算分项，并保存审计。分项之和不能超过月总额，月总额不能超过 ¥300。基础设施和存储账单不由模型预占控制；分别配置 Cloudflare、Google Cloud 和邮件供应商账单告警与资源限制。供应商账单有延迟，应用控制不是绝对账单硬封顶。

DeepSeek 文字默认额度在 20 人、30 天每天全用满时，按输入 ¥2/百万、输出 ¥8/百万约 ¥76.8；图片、整理和搜索另计。模型输入预估、图片令牌计费与返回使用量存在差异，以实际账单复核。不要把 30 分钟阅读与思考误写成 30 分钟模型持续输出。[官方定价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)

## 任务与错误

Queues 至少一次投递；任务用数据库 lease 领取，过期任务由 Cron 接回。最多三次尝试，指数退避；配置缺失、额度不足和非法资料不自动付费重试。原始文件保留，解析失败明确标记；后台可在修复配置后重试。图像公式和图表始终标明自动识别待核对，保留原页位置。

超过一天仍在预占的模型任务需核对供应商记录后结算；不能把“未收到响应”自动认定免费。留意后台 uncertain 任务与账单差异，不记录密钥、完整私人答题内容到日志。

## 数据保护与删除

R2 无公开桶，所有读取经过认证并按 user_id 过滤。代码运行域无登录态、没有账号 API，不传学习档案，只传所选代码与数据文件；运行库版本固定，限制来源、80 秒执行和输出量。主要教学界面只渲染校验后的组件数据。

用户可删除课程、资料或账号，可下载 JSON 与含文件 ZIP。朗读缓存 30 天自动清理。账号删除清理活跃库与该用户的 R2 对象；已存在的加密备份按保留周期淘汰，供应商 Time Travel 仍可能保留历史至其窗口结束。恢复后必须重放删除记录或核对恢复日期后收到的删除申请，避免恢复已删除资料。

## 备份与恢复

生产主恢复机制为 D1 Time Travel：付费计划保留 30 天，免费计划 7 天，不依赖试用额度。它自动保存数据库历史。[官方文档](https://developers.cloudflare.com/d1/reference/time-travel/)

```sh
npx wrangler d1 time-travel info personal-learning
npx wrangler d1 export personal-learning --remote --output private/pre-recovery.sql
```

记录当前 bookmark，先在新建的 recovery 数据库验证 SQL 导入、账号权限、课程数量、事件与状态一致、资料对象可读取、Next Action 和重复作答。确定目标恢复时刻和影响范围后，暂停写入并执行供应商恢复；它会覆盖该时刻之后的数据库变动，因此须在实际故障处置中取得具体恢复时点的确认：

```sh
npx wrangler d1 time-travel restore personal-learning --bookmark=VERIFIED_BOOKMARK
```

后台“创建备份”生成按表分页 AES-GCM 加密的补充数据档案，存入 R2 `backups/JOB_ID/`，不包含二进制文件副本。它不是跨表一致的在线快照，不能替代 Time Travel。恢复补充档案前停止写入并核对事件/状态一致性。通过 Cloudflare Dashboard 下载 manifest.json 与对应 .enc 文件到私有文件夹；安全设置环境中的 BETTER_AUTH_SECRET，然后运行：

```sh
node scripts/restore-backup.mjs private/downloaded-backup private/recovery.sql
npx wrangler d1 migrations apply RECOVERY_DATABASE --remote
npx wrangler d1 execute RECOVERY_DATABASE --remote --file private/recovery.sql
```

工具只解密到私有 SQL，不连接或覆盖生产。认证密钥变更前保留旧备份解密密钥；不要将它写入命令行或提交仓库。恢复 API 列表、全文索引、Last Verified 与历史 pending 标记，确认登录会话是否需要撤销。R2 原始文件用私有 ZIP 或独立桶备份另行保留；为 backups/ 配置 30 天生命周期，与数据删除保留策略一致。

## 常规检查

每天检查失败任务、预占余额、供应商预算和退订投诉。每次发布运行 typecheck、教学/API 测试、浏览器测试、数据库迁移与恢复演练；只增加新迁移，不改已应用 SQL。依赖扫描不等于完整安全审计。生产恢复演练、邮件与推送送达、真实模型输出质量必须有对应服务的实际证据，不能由模拟测试替代。
