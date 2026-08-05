import { defaultScene, findScene, profiles, randomScene, sceneQuestion, toolkitFor } from "./data/profiles.js";
import { addTrainingScore, growth, nextMilestone, renderBadges } from "./modules/growth.js";
import { defaultsFor, normalizeConfiguration, readModelConfiguration, saveModelConfiguration, testModelConnection } from "./modules/model-settings.js";
import { renderReport, requestReport } from "./modules/report.js";
import { createTrainingSession } from "./modules/training.js";
import { createTranscriber } from "./modules/transcription.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { mode: "workplace", goal: "", scene: defaultScene("workplace") };

function profile() { return profiles[state.mode]; }
function screen(id) { $$(".screen").forEach((item) => item.classList.toggle("active", item.id === id)); window.scrollTo({ top: 0, behavior: "smooth" }); }
function updateWordCount() { $("#wordCount").textContent = `${$("#transcript").value.replace(/\s/g, "").length} 字`; }
function setTranscript(value) { $("#transcript").value = value; updateWordCount(); }
function currentScene() { return findScene(state.mode, $("#topic").value.trim()) || state.scene; }

function renderToolkit(scene) {
  const toolkit = toolkitFor(state.mode, scene);
  $("#toolTitle").textContent = toolkit.title;
  $("#toolSummary").textContent = toolkit.summary;
  $("#toolList").replaceChildren(...toolkit.steps.map((step, index) => {
    const item = document.createElement("li");
    const number = document.createElement("b");
    number.textContent = `0${index + 1}`;
    item.append(number, step);
    return item;
  }));
}

function renderGoals() {
  const container = $("#goals");
  container.replaceChildren(...profile().goals.map((goal, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = goal;
    button.classList.toggle("active", state.goal === goal);
    button.addEventListener("click", () => { state.goal = goal; renderGoals(); });
    if (index === 0 && !state.goal) state.goal = goal;
    return button;
  }));
}

function renderProfile() {
  state.scene = defaultScene(state.mode);
  state.goal = profile().goals[0];
  $("#topic").value = sceneQuestion(state.scene);
  renderGoals();
  renderToolkit(state.scene);
}

function renderGrowth() {
  $("#points").textContent = growth.points.toLocaleString("zh-CN");
  const next = nextMilestone();
  $("#nextMilestone").textContent = `距离“${next.name}”还差 ${Math.max(0, next.score - growth.points).toLocaleString("zh-CN")} 分`;
  $("#growthSummary").textContent = `${growth.points.toLocaleString("zh-CN")} 训练分 · 下一阶段：${next.name}`;
  renderBadges($("#growthBadges"));
}

const training = createTrainingSession((seconds) => {
  const minutes = Math.floor(seconds / 60);
  $("#timer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
const transcriber = createTranscriber({
  getText: () => $("#transcript").value,
  onText: setTranscript,
  onState: (message) => { $("#transcriptState").textContent = message; },
  onRecordingChange: (status) => {
    const recording = status === "recording";
    const paused = status === "paused";
    $("#recordStartButton").hidden = recording;
    $("#recordStartButton").textContent = paused ? "继续录制" : "开始录制";
    $("#recordPauseButton").hidden = !recording;
    $("#recordStopButton").hidden = status === "idle";
  }
});

function stopPractice(message) { transcriber.stop(message); training.stop(); }

$("#startButton").addEventListener("click", () => {
  const scene = currentScene();
  $("#modeName").textContent = profile().name;
  $("#question").textContent = $("#topic").value.trim() || sceneQuestion(scene);
  $("#goal").textContent = `本轮只练：${state.goal}`;
  $("#focus").textContent = toolkitFor(state.mode, scene).steps[0];
  $("#transcriptState").textContent = "准备开始转写";
  screen("practiceScreen");
  training.start();
});

$$(".mode-grid button").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  $$(".mode-grid button").forEach((item) => item.classList.toggle("active", item === button));
  renderProfile();
}));

$("#randomButton").addEventListener("click", () => {
  state.scene = randomScene(state.mode, $("#topic").value.trim());
  $("#topic").value = sceneQuestion(state.scene);
  renderToolkit(state.scene);
});

$("#recordStartButton").addEventListener("click", () => transcriber.start());
$("#recordPauseButton").addEventListener("click", () => transcriber.pause());
$("#recordStopButton").addEventListener("click", () => transcriber.stop());
$("#transcript").addEventListener("input", () => { transcriber.sync($("#transcript").value); updateWordCount(); });
$("#analyzeButton").addEventListener("click", async () => {
  const transcript = $("#transcript").value.trim();
  if (transcript.replace(/\s/g, "").length < 12) {
    $("#transcriptState").textContent = "至少保留一句完整原稿后再生成报告。";
    $("#transcript").focus();
    return;
  }
  stopPractice("已提交原稿，正在生成 AI 训练报告…");
  const button = $("#analyzeButton");
  button.disabled = true;
  button.textContent = "正在分析…";
  try {
    const configuration = readModelConfiguration();
    if (!configuration) throw new Error("model_not_configured");
    const report = await requestReport({ transcript, scene: $("#topic").value, goal: state.goal }, configuration);
    renderReport(report, { score: $("#reportScore"), summary: $("#reportSummary"), compass: $("#compass"), rewrite: $("#rewriteText"), reason: $("#rewriteReason") });
    $("#reportWords").textContent = transcript.replace(/\s/g, "").length;
    addTrainingScore(report.score);
    renderGrowth();
    screen("reportScreen");
  } catch (error) {
    const messages = { model_not_configured: "请先在模型设置中保存本次会话的模型配置。", invalid_transcript: "原稿长度不符合分析要求。", analysis_unavailable: "模型暂时不可用，请稍后重试。", provider_analysis_failed: "模型服务拒绝了分析请求，请检查 Key、模型和额度。", provider_browser_unavailable: "当前服务不允许浏览器直接调用，请使用支持浏览器调用的兼容接口。", invalid_model_response: "模型未返回可用报告，原稿已保留。", invalid_model_schema: "模型报告格式不完整，原稿已保留。" };
    $("#transcriptState").textContent = messages[error.message] || "报告生成失败，原稿已保留。";
  } finally {
    button.disabled = false;
    button.textContent = "生成 AI 训练报告";
  }
});

$("#backButton").addEventListener("click", () => { stopPractice(); screen("setupScreen"); });
$("#retryButton").addEventListener("click", () => { screen("practiceScreen"); training.start(); });
$("#reportHome").addEventListener("click", () => screen("setupScreen"));
$("#homeButton").addEventListener("click", () => { stopPractice(); screen("setupScreen"); });

function openDialog(id) { $("#" + id).hidden = false; }
function configurationFromFields() {
  return normalizeConfiguration({ provider: $("#providerSelect").value, apiKey: $("#apiKey").value, model: $("#modelInput").value, baseUrl: $("#baseUrlInput").value });
}
function renderModelSettings() {
  const configuration = readModelConfiguration();
  const provider = configuration?.provider || "DeepSeek";
  const defaults = defaultsFor(provider);
  $("#providerSelect").value = provider;
  $("#modelInput").value = configuration?.model || defaults.model;
  $("#baseUrlInput").value = configuration?.baseUrl || defaults.baseUrl;
  $("#apiKey").value = "";
  $("#settingStatus").textContent = configuration ? "当前浏览器会话已保存模型配置；关闭浏览器后会自动清除。" : "填写后仅保存到当前浏览器会话，不会提交给讲清楚服务器。";
}
$("#settingsButton").addEventListener("click", () => { renderModelSettings(); openDialog("settingsDialog"); });
$("#growthButton").addEventListener("click", () => openDialog("growthDialog"));
$$("[data-close]").forEach((button) => button.addEventListener("click", () => { $("#" + button.dataset.close).hidden = true; }));
$$(".dialog-backdrop").forEach((item) => item.addEventListener("click", (event) => { if (event.target === item) item.hidden = true; }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".dialog-backdrop").forEach((item) => item.hidden = true); });

$("#providerSelect").addEventListener("change", (event) => {
  const defaults = defaultsFor(event.target.value);
  $("#modelInput").value = defaults.model;
  $("#baseUrlInput").value = defaults.baseUrl;
  $("#settingStatus").textContent = "请填写当前服务的 Key，再测试或保存。";
});
$("#saveButton").addEventListener("click", () => {
  try {
    saveModelConfiguration(configurationFromFields());
    $("#apiKey").value = "";
    $("#settingStatus").textContent = "已保存到当前浏览器会话；Key 不会提交给讲清楚服务器。";
  } catch {
    $("#settingStatus").textContent = "请填写 HTTPS Base URL、模型和 API Key。";
  }
});
$("#testButton").addEventListener("click", async () => {
  const button = $("#testButton");
  button.disabled = true;
  $("#settingStatus").textContent = "正在直接测试模型服务…";
  try {
    await testModelConnection(configurationFromFields());
    $("#settingStatus").textContent = "连通性测试成功。保存后可用该模型生成训练报告。";
  } catch (error) {
    $("#settingStatus").textContent = error.message === "provider_browser_unavailable" ? "该服务不允许浏览器直接连接，请使用支持浏览器调用的兼容接口。" : "连接失败，请检查 Key、Base URL 和服务商设置。";
  } finally {
    button.disabled = false;
  }
});

renderProfile();
renderGrowth();
