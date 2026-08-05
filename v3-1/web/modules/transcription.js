export function createTranscriber({ getText, onText, onState, onRecordingChange }) {
  let recognition = null;
  let finalText = "";
  let interimText = "";
  let status = "idle";

  function stop(message = "转写已结束，可继续编辑原稿") {
    status = "idle";
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    onRecordingChange(status);
    onState(message);
  }

  function start() {
    if (status === "recording") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return onState("当前浏览器不支持语音识别，请直接输入或使用 Chrome。");
    recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    if (status !== "paused") finalText = getText().trim();
    interimText = "";
    status = "recording";
    onRecordingChange(status);
    const activeRecognition = recognition;
    activeRecognition.onstart = () => { onRecordingChange(status); onState("正在录制并通过浏览器实时转写…"); };
    activeRecognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk) finalText += finalChunk;
      interimText = interimChunk;
      onText(`${finalText}${interimText}`);
    };
    activeRecognition.onerror = (event) => stop(`转写暂不可用：${event.error}。你仍可直接编辑原稿。`);
    activeRecognition.onend = () => {
      if (recognition !== activeRecognition) return;
      if (status === "recording") {
        try { activeRecognition.start(); } catch { stop(); }
      } else {
        recognition = null;
      }
    };
    try { activeRecognition.start(); } catch { stop("转写暂不可用，请直接输入或稍后重试。"); }
  }

  function pause() {
    if (status !== "recording") return;
    status = "paused";
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    onRecordingChange(status);
    onState("录制已暂停，已有文字已保留；可继续录制或结束。");
  }

  return { start, pause, stop, sync(value) { finalText = value; interimText = ""; } };
}
