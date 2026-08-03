# 讲清楚 3.1.0 正式安全版

Cloudflare Pages 项目：`speak-grow-v3-1`。它与 1.0、2.0、3.0 独立发布，不覆盖历史入口。

## 模块地图

| 位置 | 职责 |
| --- | --- |
| `web/data/` | 四个独立场景库：职场面试、职场表达、深度演讲、主题表达，各 100 条。 |
| `web/data/profiles.js` | 板块顺序、目标、随机题和力量动作映射。 |
| `web/modules/` | 训练计时、浏览器实时转写、报告渲染、成长体系。 |
| `web/app.js` | 页面事件与模块编排，不保存题库或模型逻辑。 |
| `shared/report.mjs` | 本机与 Cloudflare 共用的报告提示词和 JSON 校验。 |
| `functions/api/` | Cloudflare Pages 的同源模型状态与报告代理。 |
| `server.mjs` | 本机开发服务器；不参与 Cloudflare 运行时。 |

## 本地运行

1. 在终端进入本文件夹。
2. 临时设置服务器环境变量，不要把真实值写入网页或提交到文件：`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`。
3. 运行 `node server.mjs`。
4. 打开终端显示的本地地址。

## Cloudflare Pages 发布

1. 创建 Pages 项目 `speak-grow-v3-1`，GitHub 根目录选择本项目目录，发布目录设置为 `web`。
2. 在 Cloudflare 的生产环境变量中添加 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`；它们是 Secret，不写入 GitHub。
3. 为 `/api/analyze` 配置每 IP 限流后再打开模型报告。没有限流规则时，只发布训练与转写界面，不配置 `LLM_API_KEY`。
4. 发布后检查 `/api/health`、四个题库、手动输入、浏览器转写兜底和无模型保稿提示。

## 安全边界

| 能力 | 处理方式 |
| --- | --- |
| 实时转写 | 使用浏览器语音识别；本网页不接收或保存音频，浏览器会按其识别服务处理音频与麦克风权限。 |
| AI 报告 | 前端只发送用户提交的文字原稿到同源 `/api/analyze`。 |
| 模型 Key | 仅从服务器环境变量读取；不发送给浏览器、不写入日志、不存到页面。 |
| 部署 | 必须使用 HTTPS，才能稳定使用浏览器麦克风能力。 |
