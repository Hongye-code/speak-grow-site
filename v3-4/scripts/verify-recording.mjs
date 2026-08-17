import { createAudioRecorder } from "../web/modules/recording.js";

const originals = new Map(["window", "navigator", "document", "URL", "MediaRecorder"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

function replaceGlobal(name, value) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

function restoreGlobals() {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeRecorder {
  static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }

  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.state = "inactive";
    this.listeners = new Map();
  }

  addEventListener(name, listener) { this.listeners.set(name, listener); }
  emit(name, payload = {}) { this.listeners.get(name)?.(payload); }
  start() { this.state = "recording"; }
  pause() { this.state = "paused"; }
  resume() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.emit("dataavailable", { data: new Blob(["audio"], { type: this.mimeType }) });
    this.emit("stop");
  }
}

function recorderWithStates() {
  const states = [];
  return { states, recorder: createAudioRecorder({ onState: (state) => states.push(state) }) };
}

try {
  replaceGlobal("window", {});
  replaceGlobal("MediaRecorder", undefined);
  replaceGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } });
  const unsupported = recorderWithStates();
  await unsupported.recorder.start();
  assert(unsupported.states.at(-1).status === "unavailable", "不支持 WebM 时必须显示 unavailable 状态");

  replaceGlobal("window", { MediaRecorder: FakeRecorder, setTimeout: (callback) => callback() });
  replaceGlobal("MediaRecorder", FakeRecorder);
  replaceGlobal("navigator", { mediaDevices: { getUserMedia: async () => { throw { name: "NotAllowedError" }; } } });
  const denied = recorderWithStates();
  await denied.recorder.start();
  assert(denied.states.at(-1).status === "denied", "拒绝麦克风时必须显示 denied 状态");

  let tracksStopped = 0;
  let downloads = 0;
  replaceGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => { tracksStopped += 1; } }] }) } });
  replaceGlobal("document", { createElement: () => ({ click: () => { downloads += 1; } }) });
  replaceGlobal("URL", { createObjectURL: () => "blob:recording", revokeObjectURL: () => {} });
  const lifecycle = recorderWithStates();
  await lifecycle.recorder.start();
  lifecycle.recorder.pause();
  await lifecycle.recorder.start();
  lifecycle.recorder.stop();
  assert(lifecycle.states.some((state) => state.status === "requesting"), "开始时必须先显示 requesting 状态");
  assert(lifecycle.states.some((state) => state.status === "recording"), "开始和继续时必须显示 recording 状态");
  assert(lifecycle.states.some((state) => state.status === "paused"), "暂停时必须显示 paused 状态");
  assert(lifecycle.states.at(-1).status === "completed", "结束后必须生成 completed 状态");
  assert(lifecycle.recorder.getDownloadFile() instanceof Blob, "结束后必须提供下载文件");
  lifecycle.recorder.download();
  assert(downloads === 1, "下载只应由显式 download 调用触发");
  assert(tracksStopped === 1, "结束后必须清理麦克风轨道");
} finally {
  restoreGlobals();
}

console.log("recording: unavailable, denied, requesting, recording, paused, completed, download, cleanup");
