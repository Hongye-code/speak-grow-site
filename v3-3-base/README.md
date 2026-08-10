# 讲清楚 V3-3：职场讲故事（V3-4 的基础材料）

> 归档说明：此包保留为当前正式 V3-3 的基础材料；对外正式入口已迁移到包含职场闲聊与自信专训的版本。

父版本：V3-2。陈红叶已选定第四轮候选 D 作为 V3-3 的源码父本。本目录是正式发布包：首页保留“职场开口 / 讲清想法”双大入口；五类题库、60 秒训练、手动原稿、浏览器转写、即兴本地录音下载、本地报告、BYOK、成长、设置和隐私边界全部继承。

候选入口：[打开候选 D](https://speak-grow-v3-3-r4-d.dgd931373-a0b.workers.dev/)。正式稳定入口、GitHub 同步与 tag 将在部署权限可用后创建。源码继承、自动检查、公开页面、服务端本地完整报告和桌面/390px 布局已验证；真实麦克风/下载与用户 BYOK 调用仍需陈红叶在真实设备上单独确认，完成前不将这两项写为已验证。

## 从 V3-2 继承的运行说明

3.2 同时保留两条报告路线：普通用户可以不申请 API Key，页面通过同源 `server.mjs` 请求 `/api/report`；需要自带模型的用户仍可在设置中填写 3.1 的 API Key、模型名和 Base URL，浏览器只在当前会话内直连所选模型。两条路线共用同一份教练标准、完整报告和复练页面；BYOK 额外返回专属深度教练区。

不得未经用户明确允许删除、隐藏、替换或禁用 3.1 已有功能；新增功能只能叠加或改进。

## 本地运行

    node server.mjs

默认地址是 http://127.0.0.1:4184/。所有用户都会得到本地完整训练报告：训练分、五维罗盘、首屏关键改进和五段各至少 300 个中文字符的分析，且不调用外部 AI 或 API。配置自己的模型后，才额外获得专属深度教练。需要 mock 检查时运行：

    MODEL_MOCK=1 DEEPSEEK_API_KEY=test-only node server.mjs

## 服务端环境变量

复制 .env.example 的字段到部署平台环境变量中。Node 不会自动读取 .env，部署平台或启动命令负责注入这些值。豆包的 DOUBAO_MODEL 填火山方舟 Endpoint ID。若部署在反向代理后并希望按真实访客限额，额外设置 TRUST_PROXY=1；否则服务端只使用直接连接地址。

服务端只公开 /api/providers 的可用状态、/api/health 的健康状态和 /api/report 的报告结果，不返回 Key、Base URL、完整原稿或模型响应原文。匿名用户默认每天 5 次报告。`PUBLIC_PRIMARY_PROVIDER` 决定“自动选择”的首选服务商，未配置或不可用时才尝试其他已配置服务商。

## Cloudflare 发布规则

对外网站默认部署到 Cloudflare Workers 或 Pages；本目录的 `web/` 与报告 API 必须作为同一公开入口部署。Cloudflare 部署、公开 URL、真实模型调用和真实设备验证分别记录，当前本地检查通过不代表已经完成公开部署或真实模型接入。若 Cloudflare 因账号或技术原因无法使用，先说明阻塞并征得用户同意后再改用其他平台。

## 当前 Cloudflare 状态

| 项目 | 状态 |
| --- | --- |
| Worker | `speak-grow-v3-3-r4-d` 已部署。 |
| 候选入口 | [打开候选 D](https://speak-grow-v3-3-r4-d.dgd931373-a0b.workers.dev/) |
| 报告 API | 已部署；默认返回 `source: local` 的本地完整训练报告，原稿不离开浏览器。 |
| 真实模型调用 | 非必需；用户主动配置自己的 API Key 后才会调用其选择的模型并显示专属深度教练。 |
| 公开回读 | 首页、`/api/health` 和报告路线已通过；真实设备与 BYOK 另行记录。 |

配置 Secret 的命令（在你自己的终端执行，真实值不会写入本仓库）：

    pnpm dlx --package wrangler wrangler secret put QWEN_API_KEY
    pnpm dlx --package wrangler wrangler secret put DOUBAO_API_KEY
    pnpm dlx --package wrangler wrangler secret put DEEPSEEK_API_KEY

## 验证

    node scripts/verify-profiles.mjs
    node scripts/verify-recording.mjs
    node scripts/verify-report-contract.mjs
    node scripts/verify-server.mjs

三家真实模型的质量对比只在环境变量已经安全配置时手动运行：

    pnpm run benchmark:reports

本地完整训练报告不消耗公共模型额度、不使用平台 API Key。用户自带模型的真实调用、费用与设备行为仍需单独验证；Cloudflare 页面可访问不等于用户的模型已接入。
