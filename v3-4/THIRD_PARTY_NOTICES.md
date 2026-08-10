# 第三方来源与许可

| 组件 | 固定版本 | 许可 | 本期用途与边界 |
| --- | --- | --- | --- |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | `592feef04a1802b18cbeffd0fd0eb5d02570c2ec` | MIT | 仅保存源码和许可证，预留未来本地离线转写；未下载模型、未部署、未上传音频。 |
| [ricky0123/vad](https://github.com/ricky0123/vad) | `8941bbf9116234748934d6b563c1751ce4d43c35` | ISC | 本地录音时提示开始说话和停顿；失败时完全回退原录音状态机。 |
| [@ricky0123/vad-web](https://www.npmjs.com/package/@ricky0123/vad-web) | `0.0.30` | ISC | 浏览器端 VAD 包与工作线程资源。 |
| Silero VAD legacy model | 随 VAD 固定资源 | MIT | 仅在浏览器本机推断，不发送音频。 |
| [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) | `1.27.0` | MIT | 浏览器端 ONNX 运行时。 |

各组件的原始许可证随源码或依赖包保留在 `third_party/`；本项目的 CC BY-NC 4.0 不替代这些第三方许可证。
