import { defaultProfileId, defaultScene, findScene, profileRegistry, profiles, randomScene, sceneQuestion, toolkitFor } from "./data/profiles.js";
import { addTrainingScore, growth, nextMilestone, renderBadges } from "./modules/growth.js";
import { defaultsFor, fetchProviderStatus, normalizeConfiguration, readModelConfiguration, saveModelConfiguration, testModelConnection } from "./modules/model-settings.js";
import { renderReport, requestReport } from "./modules/report.js";
import { createTrainingSession } from "./modules/training.js";
import { createTranscriber } from "./modules/transcription.js";
import { createAudioRecorder } from "./modules/recording.js";
import { mountCandidateHome } from "./candidate-home.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const publicProviderIds = ["auto", "qwen", "doubao", "deepseek"];
const state = { mode: defaultProfileId, goal: "", scene: defaultScene(defaultProfileId) };
let syncCandidateHome = () => {};

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

function selectProfile(mode) {
  state.mode = mode;
  renderModeGrid();
  renderProfile();
  syncCandidateHome(mode);
}

function renderModeGrid() {
  const container = $("#modeGrid");
  container.replaceChildren(...profileRegistry.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mode = item.id;
    button.title = item.summary;
    button.classList.toggle("active", item.id === state.mode);
    const code = document.createElement("span");
    code.textContent = `${String(item.order).padStart(2, "0")} / ${item.code}`;
    const icon = document.createElement("i");
    icon.className = "mode-icon";
    icon.textContent = item.icon || "•";
    icon.setAttribute("aria-hidden", "true");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const summary = document.createElement("small");
    summary.textContent = item.shortSummary || item.summary;
    button.append(code, icon, name, summary);
    button.addEventListener("click", () => selectProfile(item.id));
    return button;
  }));
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
    $("#recordStartButton").textContent = paused ? "继续浏览器转写" : "开始浏览器转写";
    $("#recordPauseButton").hidden = !recording;
    $("#recordStopButton").hidden = status === "idle";
  }
});

function renderAudioRecorder({ status, message, canDownload }) {
  const enabled = profile().capabilities.audioDownload;
  $("#audioRecorder").hidden = !enabled;
  if (!enabled) return;
  const recording = status === "recording";
  const paused = status === "paused";
  const busy = status === "requesting" || status === "stopping";
  $("#audioStartButton").hidden = recording || busy;
  $("#audioStartButton").disabled = busy;
  $("#audioStartButton").textContent = paused ? "继续录音" : canDownload ? "重新录音" : "开始本地录音";
  $("#audioPauseButton").hidden = !recording;
  $("#audioStopButton").hidden = !recording && !paused;
  $("#audioDownloadButton").hidden = !canDownload;
  $("#audioState").textContent = message;
}

const audioRecorder = createAudioRecorder({ onState: renderAudioRecorder });

function stopPractice(message) { transcriber.stop(message); training.stop(); }
function leavePractice(message) { stopPractice(message); audioRecorder.cleanup(); }
function prepareAudioRecorder() {
  audioRecorder.cleanup(profile().capabilities.audioDownload ? "点击后才请求麦克风权限；音频仅保留在当前浏览器内存中。" : "");
}

$("#startButton").addEventListener("click", () => {
  const scene = currentScene();
  prepareAudioRecorder();
  $("#modeName").textContent = profile().name;
  $("#question").textContent = $("#topic").value.trim() || sceneQuestion(scene);
  $("#goal").textContent = `本轮只练：${state.goal}`;
  $("#focus").textContent = toolkitFor(state.mode, scene).steps[0];
  $("#transcriptState").textContent = "准备开始浏览器转写或直接编辑原稿";
  screen("practiceScreen");
  training.start();
});

$("#randomButton").addEventListener("click", () => {
  state.scene = randomScene(state.mode, $("#topic").value.trim());
  $("#topic").value = sceneQuestion(state.scene);
  renderToolkit(state.scene);
});

$("#recordStartButton").addEventListener("click", () => transcriber.start());
$("#recordPauseButton").addEventListener("click", () => transcriber.pause());
$("#recordStopButton").addEventListener("click", () => transcriber.stop());
$("#audioStartButton").addEventListener("click", () => audioRecorder.start());
$("#audioPauseButton").addEventListener("click", () => audioRecorder.pause());
$("#audioStopButton").addEventListener("click", () => audioRecorder.stop());
$("#audioDownloadButton").addEventListener("click", () => audioRecorder.download());
$("#reportAudioDownload").addEventListener("click", () => audioRecorder.download());
$("#detailsToggle").addEventListener("click", () => {
  const details = $("#reportDetails");
  const expanded = details.hidden;
  details.hidden = !expanded;
  $("#detailsToggle").setAttribute("aria-expanded", String(expanded));
  $("#detailsToggle").textContent = expanded ? "收起完整五维分析" : "展开完整五维分析";
});
$("#transcript").addEventListener("input", () => { transcriber.sync($("#transcript").value); updateWordCount(); });
$("#analyzeButton").addEventListener("click", async () => {
  if (audioRecorder.isActive()) {
    $("#transcriptState").textContent = "请先结束本地录音，并按需下载后再生成报告。";
    return;
  }
  const transcript = $("#transcript").value.trim();
  if (transcript.replace(/\s/g, "").length < 12) {
    $("#transcriptState").textContent = "至少保留一句完整原稿后再生成报告。";
    $("#transcript").focus();
    return;
  }
  stopPractice("已提交原稿，正在生成训练报告…");
  const button = $("#analyzeButton");
  button.disabled = true;
  button.textContent = "正在分析…";
  try {
    const configuration = readModelConfiguration();
    const report = await requestReport({ transcript, scene: $("#topic").value, goal: state.goal, focus: $("#focus").textContent, profileId: state.mode, detailLevel: configuration?.mode === "byok" ? "advanced" : "standard" }, configuration);
    renderReport(report, { scorePanel: $("#reportScorePanel"), score: $("#reportScore"), summary: $("#reportSummary"), source: $("#reportSource"), fillers: $("#reportFillers"), priorityHeading: $("#priorityHeading"), priorityLabel: $("#priorityLabel"), priorityQuote: $("#priorityQuote"), priorityImpact: $("#priorityImpact"), priorityAction: $("#priorityAction"), compass: $("#compass"), detailsToggle: $("#detailsToggle"), details: $("#reportDetails"), deepCoach: $("#deepCoach"), deepCoachQuote: $("#deepCoachQuote"), deepCoachAnalysis: $("#deepCoachAnalysis"), deepCoachSecondRound: $("#deepCoachSecondRound"), deepCoachChecklist: $("#deepCoachChecklist"), rewrite: $("#rewriteText"), reason: $("#rewriteReason") });
    $("#reportWords").textContent = transcript.replace(/\s/g, "").length;
    $("#reportAudioDownload").hidden = !profile().capabilities.audioDownload || !audioRecorder.getDownloadFile();
    addTrainingScore(report.trainingPoints);
    renderGrowth();
    screen("reportScreen");
  } catch (error) {
    const messages = { model_not_configured: "当前还没有可用的 AI 服务，请在设置中选择公共服务或填写自己的模型。", provider_unavailable: "这个模型暂时不可用，请切换“自动选择”或稍后重试。", quota_exhausted: "今天的免费报告次数已用完，明天再来练习。", invalid_transcript: "原稿长度不符合分析要求。", analysis_unavailable: "模型暂时不可用，原稿已保留，请稍后重试。", provider_analysis_failed: "模型服务暂时拒绝了分析请求，原稿已保留。", provider_browser_unavailable: "报告服务暂时无法连接，原稿已保留。", invalid_model_configuration: "模型配置不完整，请检查 API Key、模型和 HTTPS Base URL。", invalid_model_response: "模型未返回可用报告，原稿已保留。", invalid_model_schema: "模型报告格式不完整，原稿已保留。" };
    $("#transcriptState").textContent = messages[error.message] || "报告生成失败，原稿已保留。";
  } finally {
    button.disabled = false;
    button.textContent = "生成训练报告";
  }
});

$("#backButton").addEventListener("click", () => { leavePractice(); screen("setupScreen"); });
$("#retryButton").addEventListener("click", () => { prepareAudioRecorder(); screen("practiceScreen"); training.start(); });
$("#reportHome").addEventListener("click", () => { leavePractice(); screen("setupScreen"); });
$("#homeButton").addEventListener("click", () => { leavePractice(); screen("setupScreen"); });

function openDialog(id) { $("#" + id).hidden = false; }
function configurationFromFields() {
  if ($("#reportMode").value === "byok") {
    return normalizeConfiguration({
      provider: $("#byokProviderSelect").value,
      apiKey: $("#apiKey").value,
      model: $("#modelInput").value,
      baseUrl: $("#baseUrlInput").value
    });
  }
  return normalizeConfiguration({ provider: $("#providerSelect").value });
}
function renderSettingsMode() {
  const byok = $("#reportMode").value === "byok";
  $("#publicSettings").hidden = byok;
  $("#byokSettings").hidden = !byok;
  $("#testButton").textContent = byok ? "测试连通性" : "刷新服务状态";
  $("#saveButton").textContent = byok ? "保存本次会话" : "保存本次偏好";
}
function renderProviderStatuses(data) {
  const list = $("#providerStatus");
  if (!list) return;
  const labels = { auto: "自动选择", qwen: "通义千问", doubao: "豆包", deepseek: "DeepSeek" };
  list.replaceChildren(...(data.providers || []).map((provider) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = labels[provider.id] || provider.label;
    const status = document.createElement("b");
    status.textContent = provider.available ? "可用" : "暂不可用";
    status.className = provider.available ? "provider-online" : "provider-offline";
    item.append(name, status);
    return item;
  }));
  $("#quotaStatus").textContent = `今日还可生成 ${data.remaining ?? data.dailyLimit ?? 0} 份报告（匿名用户每日限额 ${data.dailyLimit ?? 5} 次）`;
}
async function renderModelSettings() {
  const configuration = readModelConfiguration();
  const mode = configuration?.mode === "byok" ? "byok" : "public";
  $("#reportMode").value = mode;
  $("#providerSelect").value = publicProviderIds.includes(configuration?.provider) ? configuration.provider : "auto";
  const byokProvider = configuration?.provider && ["DeepSeek", "OpenAI", "Custom"].includes(configuration.provider) ? configuration.provider : "DeepSeek";
  $("#byokProviderSelect").value = byokProvider;
  const defaults = defaultsFor(byokProvider);
  $("#modelInput").value = configuration?.mode === "byok" ? configuration.model : defaults.model;
  $("#baseUrlInput").value = configuration?.mode === "byok" ? configuration.baseUrl : defaults.baseUrl;
  $("#apiKey").value = "";
  renderSettingsMode();
  $("#settingStatus").textContent = "正在读取当前服务状态…";
  try {
    const data = await fetchProviderStatus();
    renderProviderStatuses(data);
    $("#settingStatus").textContent = mode === "byok"
      ? "当前使用浏览器直连模型；API Key 只保留在本次浏览器会话。"
      : "默认报告只在当前浏览器内生成，不调用外部 AI 或 API。";
  } catch {
    $("#settingStatus").textContent = mode === "byok" ? "公共服务状态暂时不可用；你仍可测试或使用自己的模型。" : "暂时无法读取服务状态，原稿输入和手动练习仍可用。";
    $("#quotaStatus").textContent = "额度状态暂时不可用";
  }
}
$("#settingsButton").addEventListener("click", () => { openDialog("settingsDialog"); renderModelSettings(); });
$("#growthButton").addEventListener("click", () => openDialog("growthDialog"));
$$("[data-close]").forEach((button) => button.addEventListener("click", () => { $("#" + button.dataset.close).hidden = true; }));
$$(".dialog-backdrop").forEach((item) => item.addEventListener("click", (event) => { if (event.target === item) item.hidden = true; }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".dialog-backdrop").forEach((item) => item.hidden = true); });

$("#reportMode").addEventListener("change", () => {
  renderSettingsMode();
    $("#settingStatus").textContent = $("#reportMode").value === "byok" ? "请填写自己的 API Key、模型和 HTTPS Base URL。" : "普通用户无需 API Key，报告将只在当前浏览器内生成。";
});
$("#providerSelect").addEventListener("change", (event) => {
    $("#settingStatus").textContent = `已保留${event.target.options[event.target.selectedIndex].text}偏好；默认报告不调用公共模型。`;
});
$("#byokProviderSelect").addEventListener("change", (event) => {
  const defaults = defaultsFor(event.target.value);
  $("#modelInput").value = defaults.model;
  $("#baseUrlInput").value = defaults.baseUrl;
  $("#settingStatus").textContent = "请填写当前服务的 API Key，再测试或保存。";
});
$("#saveButton").addEventListener("click", () => {
  try {
    saveModelConfiguration(configurationFromFields());
    if ($("#reportMode").value === "byok") $("#apiKey").value = "";
    $("#settingStatus").textContent = $("#reportMode").value === "byok"
      ? "已保存到当前浏览器会话；Key 不会提交给讲清楚服务器。"
      : "已保存本地评估偏好；浏览器无需保存 API Key。";
  } catch {
    $("#settingStatus").textContent = $("#reportMode").value === "byok" ? "请填写 HTTPS Base URL、模型和 API Key。" : "公共服务选择无效，请重新选择。";
  }
});
$("#testButton").addEventListener("click", async () => {
  const button = $("#testButton");
  button.disabled = true;
  const byok = $("#reportMode").value === "byok";
    $("#settingStatus").textContent = byok ? "正在直接测试模型服务…" : "本地完整训练评估无需连接外部服务。";
  try {
    const health = await testModelConnection(configurationFromFields());
    $("#settingStatus").textContent = byok ? "连通性测试成功。保存后可用该模型生成训练报告。" : "本地完整训练评估已可用，不会连接外部模型。";
    if (!byok) {
      const data = await fetchProviderStatus();
      renderProviderStatuses(data);
    }
  } catch (error) {
    $("#settingStatus").textContent = error.message === "invalid_model_configuration" ? "请检查 API Key、模型和 HTTPS Base URL。" : error.message === "provider_browser_unavailable" ? "该服务暂时无法从浏览器连接。" : byok ? "连接失败，请检查 API Key、模型和 Base URL。" : "服务状态检查失败，请稍后重试。";
  } finally {
    button.disabled = false;
  }
});

renderModeGrid();
renderProfile();
renderGrowth();
const candidateHome = mountCandidateHome({
  selectProfile,
  setTopic: (value) => { $("#topic").value = value; },
  showAllProfiles: renderModeGrid
});
syncCandidateHome = candidateHome.syncWithProfile;
syncCandidateHome(state.mode);
