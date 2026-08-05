# 讲清楚 3.1.0 公开体验版

Cloudflare Pages 项目：`speak-grow-v3-1`。本目录是 3.1 的唯一公开工作副本；1.0、2.0、3.0 保持在各自目录，不会被覆盖。

## 模块地图

| 位置 | 职责 |
| --- | --- |
| `web/data/` | 职场面试、职场表达、深度演讲、主题表达四个独立题库，各 100 条。 |
| `web/data/profiles.js` | 固定板块顺序、训练目标、随机题与力量动作映射。 |
| `web/modules/transcription.js` | 浏览器实时转写和开始、暂停、结束录制控制；不保存音频。 |
| `web/modules/model-settings.js` | 当前浏览器会话内的 DeepSeek、OpenAI 或兼容模型配置。 |
| `web/modules/report.js` | 用户确认后直连所选模型服务，校验并渲染训练报告。 |
| `web/modules/training.js`、`growth.js` | 60 秒训练计时与个人训练分、徽章记录。 |
| `web/styles/` | 当前“表达档案”视觉令牌、通用组件与页面规则。 |
| `web/app.js` | 页面事件与各模块编排。 |

## 本地预览

在 `v3-1/web/` 目录启动任意静态 HTTPS 或本地静态服务，再打开 `index.html`。浏览器实时转写需要用户主动点击并授予麦克风权限；不支持时可直接输入原稿。

## Cloudflare Pages 发布

`wrangler.toml` 只包含项目名称、静态输出目录和兼容日期，没有密钥或 Token。发布目录是 `web/`，目标项目为 `speak-grow-v3-1`。

本版本不配置 Cloudflare 模型代理：用户的 API Key 仅保存在浏览器 `sessionStorage`，原稿在用户点击“生成 AI 训练报告”后直接发送到用户自行选择的模型服务。

## 安全边界

| 项目 | 处理方式 |
| --- | --- |
| 实时转写 | 使用浏览器语音识别；网站不接收或保存音频。 |
| API Key | 只保留在当前浏览器会话，不提交 GitHub、Cloudflare、日志或持久存储。 |
| AI 报告 | 用户主动确认后，浏览器直连其选定的 DeepSeek、OpenAI 或兼容 HTTPS 服务。 |
| 部署 | 使用 HTTPS；不承诺所有浏览器均支持语音识别。 |
