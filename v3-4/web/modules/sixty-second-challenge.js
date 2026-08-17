import { ladderLevels } from "../data/ladder-scenes.js";
import { scoreLadderTranscript } from "./ladder-rubric.js";

export const CHALLENGE_QUESTION = "领导突然问：你最近在忙什么？请用 60 秒说明。";

const storageKey = "speak-grow-v3-4-60-second-challenge";
const actionByDimension = {
  "结论": "第一句直接说：我最近的重点是……，不要从背景讲起。",
  "理由": "结论后只补一个最能说明价值的依据。",
  "回应": "先回答领导的问题，再补一个必要细节。",
  "结构": "按“重点、依据、下一步”各说一句。",
  "下一步": "最后明确：下一步由谁在什么时候完成什么。",
  "结果": "先交代已经带来的结果，再说自己做了什么。",
  "动作": "用一个具体动作替换“我一直在跟进”。",
  "证据": "给一个可核验的事实、数据或交付物。",
  "岗位关系": "补一句这件事对团队或项目的影响。",
  "重点": "删掉背景，只保留负责人现在最需要知道的重点。"
};

function read() {
  try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; }
}
function save(value) { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {} }
function levelFor(score) { return [...ladderLevels].reverse().find((item) => score >= item.threshold) || ladderLevels[0]; }
function firstAction(result) {
  const weakest = [...result.dimensions].sort((a, b) => a.score - b.score)[0];
  return actionByDimension[weakest?.name] || "第一句先给结论，第二句给一个依据，最后一句说下一步。";
}
function candidateCopy(variant, level, gap, first, current, action) {
  if (variant === "b") return {
    title: `第 ${level.id} 级已解锁：${level.label}`,
    lead: `下一层要练的是“${ladderLevels[Math.min(level.id, 6)].focus}”。先留下这一次真实训练，再用同题验证。`,
    metric: `离下一层还差 ${gap} 分`,
    comparison: first ? `你的第一轮是 ${first.score} 分。` : "这是一份初步训练起点，不是职业认证。"
  };
  if (variant === "c") return {
    title: first ? "这次只看你有没有讲得更清楚。" : `你的初步训练起点：第 ${level.id} 级`,
    lead: "不承诺涨分。改完这一句后，仍用同一道题复练。",
    metric: first ? `本轮 ${current.score} 分 / 上轮 ${first.score} 分` : `距离下一层还差 ${gap} 分`,
    comparison: first ? `真实变化：${current.score - first.score >= 0 ? "+" : ""}${current.score - first.score} 分。` : `这轮先改：${action}`
  };
  return {
    title: `你的初步训练起点：第 ${level.id} 级「${level.label}」`,
    lead: "不是气场测试，只看这一次原稿能不能把重点、依据和下一步讲清楚。",
    metric: `距离下一层还差 ${gap} 分`,
    comparison: first ? `同题复练真实变化：${current.score - first.score >= 0 ? "+" : ""}${current.score - first.score} 分。` : "现在只改一个动作，再用同题验证。"
  };
}

export function mountSixtySecondChallenge({ startPractice, showScreen }) {
  const root = document.querySelector("#sixtyChallengeScreen");
  const resultScreen = document.querySelector("#challengeResultScreen");
  if (!root || !resultScreen) return { open() {}, needsAssessment: () => false, complete: () => ({ valid: false }), retest() {} };
  const $ = (selector) => document.querySelector(selector);
  const variant = document.body.dataset.challengeVariant || "a";
  let round = 1;
  let first = null;
  let last = null;

  function open() { showScreen("sixtyChallengeScreen"); }
  function begin(draft = "") {
    startPractice({ question: CHALLENGE_QUESTION, draft, round });
  }
  function render(result) {
    const level = levelFor(result.score);
    const next = ladderLevels[Math.min(level.id, ladderLevels.length - 1)];
    const gap = Math.max(0, (next?.threshold || level.threshold) - result.score);
    const action = firstAction(result);
    const prior = round === 2 ? first : null;
    const copy = candidateCopy(variant, level, gap, prior, result, action);
    $("#challengeResultEyebrow").textContent = round === 2 ? "同题复练 / 实际结果" : "初步训练段位 / 本地评分";
    $("#challengeResultTitle").textContent = copy.title;
    $("#challengeResultLead").textContent = copy.lead;
    $("#challengeScore").textContent = result.score;
    $("#challengeRank").textContent = `第 ${level.id} 级 · ${level.label}`;
    $("#challengeGap").textContent = copy.metric;
    $("#challengeAction").textContent = action;
    $("#challengeComparison").textContent = copy.comparison;
    $("#challengeRetry").hidden = round === 2;
    $("#challengePoster").hidden = round !== 2;
    $("#challengeResultNote").textContent = "分数仅由本轮实际原稿计算，只用于当前训练起点，不代表职位、职业资格或社会地位。";
    showScreen("challengeResultScreen");
  }
  function complete(transcript) {
    const result = scoreLadderTranscript({ level: 1, transcript });
    if (!result.valid) return result;
    last = { ...result, transcript, completedAt: new Date().toISOString() };
    if (round === 1) {
      first = last;
      save({ first, current: last, level: levelFor(last.score).id });
      try { localStorage.setItem("speak-grow-v3-4-1-ladder-assessment", JSON.stringify({ average: last.score, level: levelFor(last.score).id, completedAt: last.completedAt, source: "60_second_challenge" })); } catch {}
    } else {
      const prior = read()?.first || first;
      first = prior;
      save({ first, current: last, level: levelFor(last.score).id });
      try { localStorage.setItem("speak-grow-v3-4-1-ladder-assessment", JSON.stringify({ average: last.score, level: levelFor(last.score).id, completedAt: last.completedAt, source: "60_second_challenge" })); } catch {}
    }
    render(last);
    return result;
  }
  function retry() { round = 2; begin(""); }
  function retest() { round = 1; first = null; last = null; open(); }
  function poster() {
    if (!last || !first) return;
    const level = levelFor(last.score);
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#101510"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c8ff45"; ctx.fillRect(72, 92, 14, 1160);
    ctx.fillStyle = "#f4f6f1"; ctx.font = "700 76px sans-serif"; ctx.fillText("你敢测第几级吗", 124, 220);
    ctx.fillStyle = "#8c988d"; ctx.font = "36px sans-serif"; ctx.fillText("60 秒表达挑战 · 本地训练记录", 124, 286);
    ctx.fillStyle = "#c8ff45"; ctx.font = "700 240px sans-serif"; ctx.fillText(String(last.score), 124, 560);
    ctx.fillStyle = "#f4f6f1"; ctx.font = "46px sans-serif"; ctx.fillText(`初步训练段位：第 ${level.id} 级 ${level.label}`, 124, 660);
    ctx.fillStyle = "#ff846d"; ctx.font = "44px sans-serif"; ctx.fillText(`同题复练：${first.score} → ${last.score} 分`, 124, 760);
    ctx.fillStyle = "#f4f6f1"; ctx.font = "42px sans-serif"; ctx.fillText("下一层动作：", 124, 910);
    ctx.font = "38px sans-serif";
    const action = firstAction(last); const chunks = action.match(/.{1,16}/g) || [action];
    chunks.slice(0, 3).forEach((line, index) => ctx.fillText(line, 124, 980 + index * 58));
    ctx.fillStyle = "#8c988d"; ctx.font = "28px sans-serif"; ctx.fillText("不是职业认证，分数仅来自本轮实际原稿。", 124, 1210);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png"); link.download = "jiangqingchu-60-second-challenge.png"; link.click();
  }
  $("#challengeStart").addEventListener("click", () => { round = 1; first = null; begin(); });
  $("#challengeRetry").addEventListener("click", retry);
  $("#challengePoster").addEventListener("click", poster);
  $("#challengeBackHome").addEventListener("click", () => showScreen("setupScreen"));
  return { open, retest, needsAssessment: () => !read(), complete, getLast: () => last };
}
