import { ladderLevels, randomLadderScene } from "../data/ladder-scenes.js";
import { scoreLadderTranscript } from "./ladder-rubric.js";

const profileKey = "speak-grow-v3-4-1-ladder-profile";
const assessmentKey = "speak-grow-v3-4-1-ladder-assessment";

function profileId() {
  try {
    let id = localStorage.getItem(profileKey);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(profileKey, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
function readAssessment() {
  try {
    const value = JSON.parse(localStorage.getItem(assessmentKey) || "null");
    return value && Number.isInteger(value.level) ? value : null;
  } catch { return null; }
}
function saveAssessment(value) { try { localStorage.setItem(assessmentKey, JSON.stringify(value)); } catch {} }
function startingLevel(scores) {
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return { average, level: [...ladderLevels].reverse().find((item) => average >= item.threshold)?.id || 1 };
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "X-Ladder-Profile": profileId(), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "ladder_unavailable");
  return body;
}

export function mountLadder({ startPractice }) {
  const root = document.querySelector("#ladderScreen");
  if (!root) return { open() {}, ready() {}, needsAssessment: () => false, startAssessment() {} };
  const $ = (selector) => root.querySelector(selector);
  const assessmentPanel = $("#ladderAssessment");
  const livePanel = $("#ladderLive");
  const submitButton = document.querySelector("#ladderSubmit");
  const status = $("#ladderStatus");
  let challenge = null;
  let readyTranscript = "";
  let scenes = [];
  let index = 0;
  let scores = [];
  let timer = null;
  let seconds = 60;

  function showRoot() { document.querySelectorAll(".screen").forEach((item) => item.classList.toggle("active", item === root)); }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function renderQuestion() {
    const scene = scenes[index];
    seconds = 60;
    $("#assessmentStep").textContent = `第 ${index + 1} / 7 题 · 第 ${scene.level} 级随机场景`;
    $("#assessmentQuestion").textContent = scene.question;
    $("#assessmentTimer").textContent = "01:00";
    $("#assessmentTranscript").value = "";
    $("#assessmentStatus").textContent = "点击开始后用 60 秒作答；也可以直接输入原稿。";
    $("#assessmentStart").disabled = false;
    $("#assessmentNext").disabled = true;
  }
  function finishAssessment() {
    stopTimer();
    const result = startingLevel(scores);
    const level = ladderLevels.find((item) => item.id === result.level);
    saveAssessment({ ...result, completedAt: new Date().toISOString() });
    $("#assessmentStep").textContent = `${result.average} / 100 本地测级均分`;
    $("#assessmentQuestion").textContent = `你的当前训练起点：第 ${level.id} 级「${level.label}」`;
    $("#assessmentTimer").textContent = "完成";
    $("#assessmentTranscript").hidden = true;
    $("#assessmentStart").hidden = true;
    $("#assessmentNext").hidden = true;
    $("#assessmentEnter").hidden = false;
    $("#assessmentStatus").textContent = `这只是当前训练起点，不是职位、职业资格或社会地位判断。接下来从第 ${level.id} 级开始，用 5 条不同类别的证据逐级练习。`;
  }
  function submitAssessment() {
    stopTimer();
    const result = scoreLadderTranscript({ level: scenes[index].level, transcript: $("#assessmentTranscript").value.trim() });
    if (!result.valid) {
      $("#assessmentStatus").textContent = "至少保留一句完整回答后再进入下一题。";
      $("#assessmentStart").disabled = false;
      $("#assessmentNext").disabled = true;
      return;
    }
    scores.push(result.score);
    index += 1;
    if (index >= scenes.length) finishAssessment();
    else renderQuestion();
  }
  function startTimer() {
    if (timer) return;
    $("#assessmentStart").disabled = true;
    $("#assessmentNext").disabled = false;
    $("#assessmentStatus").textContent = "计时中。先说结论，再用真实细节支撑。";
    timer = setInterval(() => {
      seconds -= 1;
      $("#assessmentTimer").textContent = `00:${String(Math.max(0, seconds)).padStart(2, "0")}`;
      if (seconds <= 0) submitAssessment();
    }, 1000);
  }
  function startAssessment() {
    const completed = readAssessment();
    showRoot(); assessmentPanel.hidden = false; livePanel.hidden = true; stopTimer();
    if (completed) {
      const level = ladderLevels.find((item) => item.id === completed.level) || ladderLevels[0];
      $("#assessmentStep").textContent = `${completed.average} / 100 本地测级均分`;
      $("#assessmentQuestion").textContent = `你的当前训练起点：第 ${level.id} 级「${level.label}」`;
      $("#assessmentTimer").textContent = "已完成";
      $("#assessmentTranscript").hidden = true;
      $("#assessmentStart").hidden = true;
      $("#assessmentNext").hidden = true;
      $("#assessmentEnter").hidden = false;
      $("#assessmentStatus").textContent = "测级只用于决定训练起点，不计入周榜。";
      return;
    }
    scenes = ladderLevels.map((level) => randomLadderScene(level.id));
    index = 0; scores = [];
    $("#assessmentTranscript").hidden = false;
    $("#assessmentStart").hidden = false;
    $("#assessmentNext").hidden = false;
    $("#assessmentEnter").hidden = true;
    renderQuestion();
  }
  async function renderBoard() {
    try {
      const data = await api("/api/ladder/board");
      const list = $("#ladderBoard");
      list.replaceChildren(...(data.board || []).map((item, rank) => Object.assign(document.createElement("li"), { textContent: `${rank + 1}. ${item.nickname} · 第 ${item.level} 级 · ${item.score} 分` })));
      $("#ladderBoardEmpty").hidden = (data.board || []).length > 0;
      $("#ladderBoardEmpty").textContent = data.participants < 20 ? "本周参与者不足 20 人，暂不显示百分位或虚构对手。" : "本周还没有可展示的有效记录。";
    } catch { status.textContent = "周榜暂时不可读取；原有训练不受影响。"; }
  }
  function open() {
    const assessment = readAssessment();
    if (!assessment) return startAssessment();
    showRoot(); assessmentPanel.hidden = true; livePanel.hidden = false;
    $("#ladderLevelSelect").value = String(assessment.level);
    status.textContent = `当前训练起点：第 ${assessment.level} 级。完成 5 条不同类别的合格证据后，再进入下一段位。`;
    void renderBoard();
  }
  async function requestChallenge() {
    status.textContent = "正在领取一次性题签…";
    const level = Number($("#ladderLevelSelect").value || 1);
    try {
      challenge = await api(`/api/ladder/challenge?level=${level}`);
      $("#ladderChallenge").textContent = challenge.question;
      $("#ladderChallengeMeta").textContent = `第 ${challenge.level} 级 · ${challenge.category} · 题签 15 分钟内有效`;
      $("#ladderStart").disabled = false;
      status.textContent = "题签已领取。完成训练报告后，才可选择提交上榜校验。";
    } catch {
      const localScene = randomLadderScene(level);
      challenge = { ...localScene, localOnly: true };
      $("#ladderChallenge").textContent = localScene.question;
      $("#ladderChallengeMeta").textContent = `第 ${localScene.level} 级 · ${localScene.category} · 本地练习题`;
      $("#ladderStart").disabled = false;
      status.textContent = "已发放本地随机题。本轮不进入匿名榜单，但可正常完成训练、报告和复练。";
    }
  }
  $("#assessmentStart").addEventListener("click", startTimer);
  $("#assessmentNext").addEventListener("click", submitAssessment);
  $("#assessmentEnter").addEventListener("click", open);
  $("#ladderGetChallenge").addEventListener("click", requestChallenge);
  $("#ladderStart").addEventListener("click", () => { if (challenge) startPractice(challenge); });
  $("#ladderBoardRefresh").addEventListener("click", renderBoard);
  $("#ladderDelete").addEventListener("click", async () => {
    try { await api("/api/ladder/profile", { method: "DELETE" }); status.textContent = "已删除你的上榜记录；本地训练记录不受影响。"; await renderBoard(); } catch { status.textContent = "删除请求未完成，请稍后再试。"; }
  });
  submitButton.addEventListener("click", async () => {
    if (!challenge || !readyTranscript) return;
    const nickname = window.prompt("输入匿名昵称（2 至 16 个字符）", "")?.trim();
    if (!nickname) return;
    submitButton.disabled = true;
    try {
      const result = await api("/api/ladder/verify", { method: "POST", body: JSON.stringify({ challengeId: challenge.challengeId, token: challenge.token, nickname, transcript: readyTranscript }) });
      const percentile = result.rankInsight?.exceededPercent === null || result.rankInsight?.exceededPercent === undefined
        ? "本周真实上榜样本不足 20 人，暂不显示百分位。"
        : `本周 ${result.rankInsight.participants} 位匿名有效训练者中，你当前超过了 ${result.rankInsight.exceededPercent}% 的人。`;
      status.textContent = result.qualified ? `已校验：${result.score} 分，${result.progressText} ${percentile}` : `本轮 ${result.score} 分，未达到第 ${challenge.level} 级门槛 ${result.threshold} 分；可用报告中的一句改进后复练。`;
      submitButton.hidden = true; challenge = null; await renderBoard();
    } catch (error) { status.textContent = error.message === "duplicate_submission" ? "相同原稿不能重复上榜。请完成一次真实复练后再提交。" : "上榜校验未完成；原稿和本地报告仍保留在浏览器。"; }
    finally { submitButton.disabled = false; }
  });
  return { open, ready(transcript) { readyTranscript = transcript; submitButton.hidden = !challenge || challenge.localOnly; }, needsAssessment: () => !readAssessment(), startAssessment };
}
