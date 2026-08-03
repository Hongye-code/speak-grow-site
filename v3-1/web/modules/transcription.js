export function createTranscriber({ getText, onText, onState, onRecordingChange }) {
  let recognition = null;
  let finalText = "";
  let interimText = "";
  let recording = false;

  function stop(message = "转写已结束，可继续编辑原稿") {
    recording = false;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    onRecordingChange(false);
    onState(message);
  }

  function start() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return onState("当前浏览器不支持语音识别，请直接输入或使用 Chrome。");
    recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    finalText = getText().trim();
    interimText = "";
    recording = true;
    recognition.onstart = () => { onRecordingChange(true); onState("正在通过浏览器实时转写…"); };
    recognition.onresult = (event) => {
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
    recognition.onerror = (event) => stop(`转写暂不可用：${event.error}。你仍可直接编辑原稿。`);
    recognition.onend = () => { if (recording) { try { recognition.start(); } catch { stop(); } } };
    recognition.start();
  }

  return { stop, toggle() { if (recording) stop(); else start(); }, sync(value) { finalText = value; interimText = ""; } };
}
