const WEBM_TYPES = ["audio/webm;codecs=opus", "audio/webm"];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function createAudioRecorder({ onState }) {
  let recorder = null;
  let stream = null;
  let chunks = [];
  let audioBlob = null;
  let status = "idle";
  let generation = 0;

  function emit(message) {
    onState({ status, message, canDownload: Boolean(audioBlob) });
  }

  function stopTracks() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function webmOptions() {
    if (typeof window.MediaRecorder === "undefined") return null;
    const mimeType = WEBM_TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type));
    return mimeType ? { mimeType } : null;
  }

  function supported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && webmOptions());
  }

  function complete(activeRecorder, recordingGeneration) {
    if (recordingGeneration !== generation) return;
    const type = activeRecorder.mimeType || "audio/webm";
    audioBlob = chunks.length ? new Blob(chunks, { type }) : null;
    chunks = [];
    recorder = null;
    stopTracks();
    status = audioBlob ? "completed" : "error";
    emit(audioBlob ? "本地音频已生成。下载前不会上传或保存到网站。" : "没有生成可下载的音频，请重新录制或直接编辑原稿。");
  }

  async function start() {
    if (status === "recording" || status === "requesting" || status === "stopping") return;
    if (status === "paused" && recorder) {
      try {
        recorder.resume();
        status = "recording";
        emit("正在本地录音，结束后可主动下载 WebM 文件。");
      } catch {
        status = "error";
        emit("无法继续本地录音；你仍可直接编辑原稿。");
      }
      return;
    }
    if (!supported()) {
      status = "unavailable";
      emit("当前浏览器无法生成可下载的 WebM 音频；你仍可使用浏览器转写或手动原稿。");
      return;
    }

    const recordingGeneration = ++generation;
    status = "requesting";
    emit("正在请求麦克风权限…");
    let capturedStream;
    try {
      capturedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (recordingGeneration !== generation) return;
      status = error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "denied" : "error";
      emit(status === "denied" ? "麦克风权限未授权；你仍可直接输入或使用浏览器转写。" : "无法使用麦克风；你仍可直接编辑原稿。");
      return;
    }
    if (recordingGeneration !== generation) {
      capturedStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = capturedStream;

    try {
      chunks = [];
      audioBlob = null;
      const activeRecorder = new MediaRecorder(stream, webmOptions());
      recorder = activeRecorder;
      activeRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      activeRecorder.addEventListener("stop", () => complete(activeRecorder, recordingGeneration), { once: true });
      activeRecorder.start();
      status = "recording";
      emit("正在本地录音。结束后会在当前浏览器内存中生成 WebM 文件。");
    } catch {
      if (recordingGeneration !== generation) return;
      stopTracks();
      recorder = null;
      status = "error";
      emit("本地录音无法启动；你仍可直接编辑原稿。");
    }
  }

  function pause() {
    if (status !== "recording" || !recorder) return;
    try {
      recorder.pause();
      status = "paused";
      emit("本地录音已暂停，继续或结束均不会影响原稿。");
    } catch {
      status = "error";
      emit("无法暂停本地录音；你仍可结束录音或直接编辑原稿。");
    }
  }

  function stop() {
    if (!recorder || !["recording", "paused"].includes(status)) return;
    status = "stopping";
    emit("正在生成本地 WebM 音频…");
    try {
      recorder.stop();
    } catch {
      stopTracks();
      recorder = null;
      status = "error";
      emit("无法结束本地录音；原稿没有丢失。");
    }
  }

  function getDownloadFile() {
    return audioBlob;
  }

  function download() {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jiangqingchu-improv-${timestamp()}.webm`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function cleanup(message = "本地录音只保留在当前浏览器内存中。") {
    generation += 1;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch {}
    }
    recorder = null;
    stopTracks();
    chunks = [];
    audioBlob = null;
    status = "idle";
    emit(message);
  }

  return { start, pause, stop, download, getDownloadFile, getActiveStream: () => stream, cleanup, isActive: () => ["recording", "paused", "requesting", "stopping"].includes(status) };
}
