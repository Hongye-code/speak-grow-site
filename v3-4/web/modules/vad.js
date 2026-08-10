const assets = "./vendor/vad/";

export function createVadIndicator({ onState }) {
  let detector = null;
  let unavailable = false;

  async function start(stream) {
    if (unavailable || detector || !stream || !window.vad?.MicVAD) return;
    try {
      detector = await window.vad.MicVAD.new({
        startOnLoad: false,
        baseAssetPath: assets,
        onnxWASMBasePath: assets,
        getStream: async () => stream,
        resumeStream: async () => stream,
        pauseStream: async () => {},
        onSpeechStart: () => onState("VAD：已检测到你开始说话。"),
        onSpeechEnd: () => onState("VAD：检测到一句结束或停顿。")
      });
      await detector.start();
    } catch {
      unavailable = true;
      detector = null;
    }
  }

  async function stop() {
    const current = detector;
    detector = null;
    try { await current?.destroy(); } catch {}
  }

  return { start, stop };
}
