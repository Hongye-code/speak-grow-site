import { defaultScene, findScene, profiles, randomScene, sceneQuestion, toolkitFor } from "./data/profiles.js";
import { addTrainingScore, growth, nextMilestone, renderBadges } from "./modules/growth.js";
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
  onRecordingChange: (recording) => { $("#recordButton").textContent = recording ? "结束实时转写" : "开始实时转写"; }
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

$("#recordButton").addEventListener("click", () => transcriber.toggle());
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
    const report = await requestReport({ transcript, scene: $("#topic").value, goal: state.goal });
    renderReport(report, { score: $("#reportScore"), summary: $("#reportSummary"), compass: $("#compass"), rewrite: $("#rewriteText"), reason: $("#rewriteReason") });
    addTrainingScore(report.score);
    renderGrowth();
    screen("reportScreen");
  } catch (error) {
    const messages = { model_not_configured: "服务器尚未配置模型，原稿已保留。", invalid_transcript: "原稿长度不符合分析要求。", analysis_unavailable: "模型暂时不可用，请稍后重试。" };
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
$("#settingsButton").addEventListener("click", () => openDialog("settingsDialog"));
$("#growthButton").addEventListener("click", () => openDialog("growthDialog"));
$$("[data-close]").forEach((button) => button.addEventListener("click", () => { $("#" + button.dataset.close).hidden = true; }));
$$(".dialog-backdrop").forEach((item) => item.addEventListener("click", (event) => { if (event.target === item) item.hidden = true; }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".dialog-backdrop").forEach((item) => item.hidden = true); });

async function health() {
  try {
    const response = await fetch("./api/health");
    const status = await response.json();
    $("#modelStatus").textContent = status.configured ? `已配置：${status.model}` : "未配置模型";
  } catch { $("#modelStatus").textContent = "服务未连接"; }
}

renderProfile();
renderGrowth();
health();
