import { defaultProfileId, defaultScene, findScene, profileRegistry, profiles, randomScene, sceneQuestion, toolkitFor } from "./data/profiles.js";
import { addTrainingScore, growth, nextMilestone, renderBadges } from "./modules/growth.js";
import { defaultsFor, fetchProviderStatus, normalizeConfiguration, readModelConfiguration, saveModelConfiguration, testModelConnection } from "./modules/model-settings.js";
import { renderReport, requestReport } from "./modules/report.js";
import { createTrainingSession } from "./modules/training.js";
import { createTranscriber } from "./modules/transcription.js";
import { createAudioRecorder } from "./modules/recording.js";
import { createPyramidProgress, mountPyramidHome } from "./modules/pyramid.js";
import { createVadIndicator } from "./modules/vad.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const publicProviderIds = ["auto", "qwen", "doubao", "deepseek"];
const state = { mode: defaultProfileId, goal: "", scene: defaultScene(defaultProfileId), confidence: { active: false, phase: "opening", evidence: null }, pyramid: null };
let syncPyramidHome = () => {};
let pyramidProgress;
let pyramidHome = { refresh: () => {} };

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
  state.confidence.active = false;
  $("#confidenceWorkbench").hidden = true;
  $("#interviewWorkbench").hidden = true;
  state.mode = mode;
  renderModeGrid();
  renderProfile();
  syncPyramidHome(mode);
}

function openInterview() {
  selectProfile("interview");
  $("#interviewWorkbench").hidden = false;
  $("#interviewWorkbench").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openStandardInterview() {
  selectProfile("interview");
  $("#topic").focus();
  $("#topic").scrollIntoView({ behavior: "smooth", block: "center" });
}

function confidenceTopic(evidence) {
  const prompts = {
    intro: "60 秒自我介绍：结果、动作、细节。",
    roleFit: "60 秒说明岗位匹配：需求、经历、价值。",
    careerChange: "60 秒解释职业选择：方向、准备、贡献。",
    strength: "60 秒说明核心优势：能力、证据、适用场景。",
    project: "60 秒讲项目：结果、动作、细节。",
    ownership: "60 秒讲清个人作用：任务、判断、影响。",
    collaboration: "60 秒讲跨团队协作：分歧、推进、结果。",
    conflict: "60 秒讲分歧处理：目标、沟通、结果。",
    failure: "60 秒讲失败复盘：责任、修正、变化。",
    setback: "60 秒讲清压力下的处理：情境、动作、变化。",
    deadline: "60 秒讲紧急交付：取舍、行动、结果。",
    judgment: "60 秒解释关键判断：背景、依据、结果。",
    dataDecision: "60 秒解释数据判断：信号、取舍、验证。",
    leadership: "60 秒讲带动他人：动作、影响、证据。",
    ambiguity: "60 秒讲模糊目标：澄清、推进、结果。",
    priority: "60 秒讲优先级：判断、沟通、结果。",
    feedback: "60 秒讲反馈改进：听见、调整、变化。",
    motivation: "60 秒讲职业动机：方向、匹配、投入。",
    gap: "60 秒说明经历空档：准备、能力、现在能做什么。",
    followup: "60 秒接住追问：结论、依据、下一步。"
  };
  return prompts[evidence.scenario] || "60 秒讲清价值：结果、动作、细节。";
}

function openConfidence() {
  selectProfile("interview");
  state.confidence.active = true;
  state.confidence.phase = "opening";
  $("#confidenceWorkbench").hidden = false;
  renderConfidenceSolution();
  setConfidencePanel("theory");
  setConfidenceTheoryPanel("prep");
  $("#confidenceStatus").textContent = "证据卡只保存在当前浏览器；不会自动上传。";
  $("#confidenceWorkbench").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setConfidencePanel(panel) {
  $$('[data-confidence-panel]').forEach((item) => { item.hidden = item.dataset.confidencePanel !== panel; });
  $$('[data-confidence-tab]').forEach((button) => { const selected = button.dataset.confidenceTab === panel; button.setAttribute("aria-selected", String(selected)); button.classList.toggle("active", selected); });
}

function setConfidenceTheoryPanel(panel) {
  $$('[data-confidence-theory-panel]').forEach((item) => { item.hidden = item.dataset.confidenceTheoryPanel !== panel; });
  $$('[data-confidence-theory-tab]').forEach((button) => { const selected = button.dataset.confidenceTheoryTab === panel; button.setAttribute("aria-selected", String(selected)); button.classList.toggle("active", selected); });
}

function showAllProfiles() {
  const index = $("#allProfiles");
  index.hidden = false;
  $("#practiceSetup").hidden = false;
  renderModeGrid();
  index.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openTheory() {
  openConfidence();
  setConfidencePanel("theory");
  setConfidenceTheoryPanel("prep");
}

function startPyramidChallenge(challenge, levelId) {
  state.pyramid = { levelId, challengeId: challenge.id };
  if (challenge.confidenceScenario) {
    openConfidence();
    setConfidencePanel("practice");
    $("#confidenceScenario").value = challenge.confidenceScenario;
    renderConfidenceSolution();
    $("#evidenceResult").focus();
    return;
  }
  selectProfile(challenge.profile);
  state.goal = challenge.goal;
  $("#topic").value = challenge.topic;
  startPractice();
}

const confidenceSolutions = {
  intro: { framework: "PREP", blocker: "自我介绍", firstLine: "我是做什么的，最近解决过什么问题。", route: "身份与方向 → 最相关结果 → 你的动作 → 和岗位连接" },
  roleFit: { framework: "PREP", blocker: "岗位匹配", firstLine: "这个岗位最需要的是……，我在……里已经做过相近的事。", route: "岗位需求 → 对应经历 → 已有结果 → 能贡献什么" },
  careerChange: { framework: "PREP", blocker: "转行解释", firstLine: "我转向这个方向，是因为在……中确认自己更擅长解决……", route: "主动选择 → 已做准备 → 可迁移能力 → 当前价值" },
  strength: { framework: "PREP", blocker: "讲优势", firstLine: "我最稳定的一项能力是……，它在……时带来了……", route: "能力判断 → 真实情境 → 个人动作 → 证据结果" },
  project: { framework: "STAR", blocker: "讲项目", firstLine: "这个项目最后带来的变化是……，我负责的是……", route: "情境压成一句 → 任务和判断 → 你的行动 → 结果与细节" },
  ownership: { framework: "STAR", blocker: "个人作用", firstLine: "项目里我负责……，我做的关键决定是……", route: "明确边界 → 关键动作 → 协作对象 → 可核验影响" },
  collaboration: { framework: "STAR", blocker: "跨团队协作", firstLine: "当时不同团队对……理解不一，我先把……对齐。", route: "共同目标 → 分歧所在 → 推进动作 → 协作结果" },
  conflict: { framework: "STAR", blocker: "意见冲突", firstLine: "我们当时对……有不同判断，我先回到共同目标和事实。", route: "分歧不回避 → 事实与目标 → 沟通动作 → 最终决定" },
  failure: { framework: "STAR", blocker: "失败复盘", firstLine: "那次结果没有达到预期，我先承担我该负责的部分。", route: "结果偏差 → 责任范围 → 修正动作 → 后续变化" },
  setback: { framework: "STAR", blocker: "高压开场", firstLine: "在时间和资源都紧的时候，我先做了……的取舍。", route: "压力情境 → 判断与行动 → 协作安排 → 交付变化" },
  deadline: { framework: "STAR", blocker: "紧急交付", firstLine: "面对这个截止时间，我没有平均用力，而是先保住……", route: "约束条件 → 优先级判断 → 推进行动 → 交付证据" },
  judgment: { framework: "WSWN", blocker: "关键判断", firstLine: "当时我没有直接做 A，而是先判断……", route: "发生什么 → 判断为什么重要 → 做了什么 → 结果证明" },
  dataDecision: { framework: "WSWN", blocker: "数据判断", firstLine: "数据和直觉不一致时，我先确认……这个信号。", route: "冲突信号 → 验证依据 → 选择行动 → 后续结果" },
  leadership: { framework: "STAR", blocker: "带动他人", firstLine: "我没有只分配任务，而是先让大家看见……", route: "团队目标 → 影响动作 → 他人如何行动 → 共同结果" },
  ambiguity: { framework: "STAR", blocker: "目标不清", firstLine: "目标还不够清楚时，我先确认……而不是直接开工。", route: "模糊点 → 澄清动作 → 推进机制 → 结果变化" },
  priority: { framework: "PREP", blocker: "优先级冲突", firstLine: "这几件事不能同时做好，我建议先保住……", route: "明确取舍 → 给出依据 → 沟通范围 → 确认下一步" },
  feedback: { framework: "STAR", blocker: "负面反馈", firstLine: "我当时先确认对方具体看到的问题，再决定怎样调整。", route: "反馈内容 → 不防御地核实 → 调整动作 → 后续改变" },
  motivation: { framework: "PREP", blocker: "职业动机", firstLine: "我现在寻找的是……，这个岗位能让我持续解决……", route: "未来方向 → 岗位连接 → 已有准备 → 双方匹配" },
  gap: { framework: "PREP", blocker: "经历空档", firstLine: "这段时间我没有在全职岗位，但持续在……上完成了……", route: "如实交代 → 说明主动准备 → 可迁移能力 → 当前贡献" },
  followup: { framework: "WSWN", blocker: "被追问", firstLine: "这个问题我先说结论，然后补一个具体依据。", route: "先接住问题 → 给出判断 → 用细节证明 → 说明下一步" }
};

function renderConfidenceSolution() {
  const solution = confidenceSolutions[$("#confidenceScenario").value];
  $("#confidenceSolution").replaceChildren(Object.assign(document.createElement("p"), { className: "speak-eyebrow", textContent: "本场景解决路线" }), Object.assign(document.createElement("strong"), { textContent: `第一句：${solution.firstLine}` }), Object.assign(document.createElement("p"), { textContent: solution.route }));
}

function startPractice() {
  const scene = currentScene();
  prepareAudioRecorder();
  $("#modeName").textContent = state.confidence.active ? "自信专训" : profile().name;
  $("#question").textContent = $("#topic").value.trim() || sceneQuestion(scene);
  $("#goal").textContent = state.confidence.active && state.confidence.phase === "followup"
    ? "本轮只练：先回答，再补一个细节。"
    : state.confidence.active
      ? "本轮只练：先讲结果，再讲动作和细节。"
      : `本轮只练：${state.goal}`;
  $("#focus").textContent = state.confidence.active && state.confidence.phase === "followup"
    ? "先给出一个具体细节，再说明它和岗位价值的关系。"
    : state.confidence.active
      ? `先说结果“${state.confidence.evidence.result}”，再补动作和细节。`
      : toolkitFor(state.mode, scene).steps[0];
  $("#transcriptState").textContent = "准备开始浏览器转写或直接编辑原稿";
  screen("practiceScreen");
  training.start();
}

function applyConfidenceFeedback(report, transcript) {
  if (!state.confidence.active || !state.confidence.evidence) return report;
  const { result, role, proof } = state.confidence.evidence;
  const firstSentence = transcript.split(/[。！？!?]/u).map((item) => item.trim()).find(Boolean) || transcript.slice(0, 60);
  const followup = state.confidence.phase === "followup";
  const hasResult = transcript.includes(result);
  const hasRole = transcript.includes(role);
  const hasProof = transcript.includes(proof);
  const action = followup
    ? "先用一句话直接回答追问，再补一个可核验细节，最后说明它如何支持你的判断。"
    : !hasResult ? `第一句先说结果“${result}”，不要从很长的背景开始。`
    : !hasRole ? `紧接着说明你的关键动作“${role}”，让面试官听见你的作用。`
    : !hasProof ? `补上可核验细节“${proof}”，让结果不只是形容词。`
    : "把第一句缩短成结果，第二句保留你的关键动作，第三句只给一个证据。";
  const label = followup ? "追问回答" : "价值开场";
  return {
    ...report,
    summary: `自信专训本地复盘：你正在用 ${state.confidence.evidence.framework} 回答“${state.confidence.evidence.blocker}”。这轮只检查结果、个人作用和证据，不给“气场”打分。`,
    priority: { label, quote: firstSentence, impact: followup ? "追问时先让面试官听见直接回答，再决定要补多少背景。" : "面试开场先交付价值，面试官才更容易把后面的经历理解为证据。", action },
    rewrite: { original: firstSentence, improved: action, reason: "这是基于你刚填写的项目证据做的本地结构检查，不调用外部模型。" }
  };
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
const vadIndicator = createVadIndicator({
  onState: (message) => {
    if (audioRecorder.isActive()) $("#audioState").textContent = message;
  }
});

function stopPractice(message) { transcriber.stop(message); training.stop(); }
function leavePractice(message) { stopPractice(message); void vadIndicator.stop(); audioRecorder.cleanup(); }
function prepareAudioRecorder() {
  void vadIndicator.stop();
  audioRecorder.cleanup(profile().capabilities.audioDownload ? "点击后才请求麦克风权限；音频仅保留在当前浏览器内存中。" : "");
}

$("#startButton").addEventListener("click", startPractice);

$("#confidenceStart").addEventListener("click", () => {
  const solution = confidenceSolutions[$("#confidenceScenario").value];
  const evidence = {
    scenario: $("#confidenceScenario").value,
    blocker: solution.blocker,
    reaction: "紧张",
    framework: solution.framework,
    result: $("#evidenceResult").value.trim(),
    role: $("#evidenceRole").value.trim(),
    proof: $("#evidenceProof").value.trim()
  };
  if (Object.values(evidence).some((value) => !value)) {
  $("#confidenceStatus").textContent = "补齐结果、你的动作和一个具体细节，再开始练习。";
    return;
  }
  state.confidence = { active: true, phase: "opening", evidence };
  state.mode = "interview";
  state.goal = `${evidence.reaction}反应出现时，仍按 ${evidence.framework} 路线说清结果与依据`;
  $("#topic").value = confidenceTopic(evidence);
  try { localStorage.setItem("speak-confidence-evidence", JSON.stringify(evidence)); } catch {}
  startPractice();
});

$("#confidenceScenario").addEventListener("change", renderConfidenceSolution);
$$('[data-open-interview-panel]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.openInterviewPanel === "confidence") openConfidence();
  else openStandardInterview();
}));
$$('[data-confidence-tab]').forEach((button) => button.addEventListener("click", () => setConfidencePanel(button.dataset.confidenceTab)));
$$('[data-confidence-theory-tab]').forEach((button) => button.addEventListener("click", () => setConfidenceTheoryPanel(button.dataset.confidenceTheoryTab)));
$$('[data-open-confidence-panel]').forEach((button) => button.addEventListener("click", () => setConfidencePanel(button.dataset.openConfidencePanel)));

$("#randomButton").addEventListener("click", () => {
  state.scene = randomScene(state.mode, $("#topic").value.trim());
  $("#topic").value = sceneQuestion(state.scene);
  renderToolkit(state.scene);
});

$("#recordStartButton").addEventListener("click", () => transcriber.start());
$("#recordPauseButton").addEventListener("click", () => transcriber.pause());
$("#recordStopButton").addEventListener("click", () => transcriber.stop());
$("#audioStartButton").addEventListener("click", async () => {
  await audioRecorder.start();
  void vadIndicator.start(audioRecorder.getActiveStream());
});
$("#audioPauseButton").addEventListener("click", () => { void vadIndicator.stop(); audioRecorder.pause(); });
$("#audioStopButton").addEventListener("click", () => { void vadIndicator.stop(); audioRecorder.stop(); });
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
  void vadIndicator.stop();
  const button = $("#analyzeButton");
  button.disabled = true;
  button.textContent = "正在分析…";
  try {
    const configuration = readModelConfiguration();
    const rawReport = await requestReport({ transcript, scene: $("#topic").value, goal: state.goal, focus: $("#focus").textContent, profileId: state.mode, detailLevel: configuration?.mode === "byok" ? "advanced" : "standard" }, configuration);
    const report = applyConfidenceFeedback(rawReport, transcript);
    renderReport(report, { scorePanel: $("#reportScorePanel"), score: $("#reportScore"), summary: $("#reportSummary"), source: $("#reportSource"), fillers: $("#reportFillers"), priorityHeading: $("#priorityHeading"), priorityLabel: $("#priorityLabel"), priorityQuote: $("#priorityQuote"), priorityImpact: $("#priorityImpact"), priorityAction: $("#priorityAction"), compass: $("#compass"), detailsToggle: $("#detailsToggle"), details: $("#reportDetails"), deepCoach: $("#deepCoach"), deepCoachQuote: $("#deepCoachQuote"), deepCoachAnalysis: $("#deepCoachAnalysis"), deepCoachSecondRound: $("#deepCoachSecondRound"), deepCoachChecklist: $("#deepCoachChecklist"), rewrite: $("#rewriteText"), reason: $("#rewriteReason") });
    try { localStorage.setItem("speak-last-rewrite", report.rewrite.improved); } catch {}
    $("#reportWords").textContent = transcript.replace(/\s/g, "").length;
    $("#reportAudioDownload").hidden = !profile().capabilities.audioDownload || !audioRecorder.getDownloadFile();
    addTrainingScore(report.trainingPoints);
    if (state.pyramid) {
      const saved = pyramidProgress.record(state.pyramid.levelId, state.pyramid.challengeId);
      if (saved) pyramidHome.refresh("这一关已留下练习证据。");
      state.pyramid = null;
    }
    renderGrowth();
    $("#retryButton").textContent = state.confidence.active && state.confidence.phase === "opening" ? "进入项目追问，再练 60 秒" : "用加强句再练 60 秒";
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
$("#retryButton").addEventListener("click", () => {
  if (state.confidence.active && state.confidence.phase === "opening") {
    state.confidence.phase = "followup";
    const { result, role, proof } = state.confidence.evidence;
    $("#topic").value = `追问：请具体说明你如何做出“${role}”这个判断，它怎样带来了“${result}”？请用“${proof}”作为证据。`;
    setTranscript("");
  }
  prepareAudioRecorder();
  startPractice();
});
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
pyramidProgress = createPyramidProgress();
pyramidHome = mountPyramidHome({
  progress: pyramidProgress,
  startChallenge: startPyramidChallenge,
  showAllProfiles,
  openTheory
});
syncPyramidHome = () => pyramidHome.refresh();
