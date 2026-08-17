# 讲清楚 / SPEAK BETTER

一个面向大众的中文口语表达训练网页项目。从 1.0 到 4.1，持续迭代中。

## 版本导航

| 版本 | 名称 | 在线预览 | 代码位置 | 说明 |
|------|------|---------|----------|------|
| v1 | 1.0 独立体验 | [预览](https://hongye-code.github.io/speak-grow-site/v1/) | [`v1/`](v1/) | 首个公开体验 |
| v2 | 2.0 独立体验 | [预览](https://hongye-code.github.io/speak-grow-site/v2/) | [`v2/`](v2/) | 以练习为中心 |
| v3 | 职场力量练习 | [预览](https://hongye-code.github.io/speak-grow-site/v3/) | [`v3/`](v3/) | 60秒沟通，表达导师 |
| v3-1 | 3.1 样式快照 | - | [`v3-1/`](v3-1/) | Cloudflare Worker 版本 |
| v3-4 | 60秒表达挑战 | [预览](https://hongye-code.github.io/speak-grow-site/v3-4/web/) | [`v3-4/`](v3-4/) | 职场表达能力金字塔，最新版本 |
| 4.1 | 读完有话说 | [预览](https://hongye-code.github.io/speak-grow-site/read-then-speak-4-1/) | [`read-then-speak-4-1/`](read-then-speak-4-1/) | 粉红编辑室，资料→表达 |

## 快速访问

- **主站入口**：https://hongye-code.github.io/speak-grow-site/
- **v3-4 预览**：https://hongye-code.github.io/speak-grow-site/v3-4/web/
- **正式版（Cloudflare）**：https://read-then-speak-4-1.pages.dev/
- **开发仓库**：[`speak-grow`](https://github.com/Hongye-code/speak-grow)（Private）— 面向大众的三分钟口语表达训练网页

## 技术说明

所有版本均为静态网页（除 v3-1 为 Cloudflare Worker 外），无构建步骤，无需后端，直接由浏览器运行。

```bash
# 本地预览
python3 -m http.server 4173
```

访问 `http://127.0.0.1:4173`。

## 隐私边界

- 不上传、不保存音频；记录仅保存在当前浏览器。
- 反馈只检查逐字稿可见信号，明确标注为本地规则反馈，不伪装成 AI 评价。
- 不包含外部讲座的逐字稿、书籍原文或其他受版权保护的资料。

## 文档

- [表达导师方案与来源调研](docs/表达导师方案与来源调研.md)
- [CHANGELOG](CHANGELOG.md)
