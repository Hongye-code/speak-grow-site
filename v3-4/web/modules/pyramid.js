const storageKey = "speak-grow-v3-4-pyramid";

export const pyramidLevels = [
  {
    id: 1,
    name: "开口有主线",
    short: "先说结论，再补一个理由。",
    completeLabel: "完成 3 次结论先行",
    challenges: [
      { id: "l1-meeting", profile: "improv", goal: "先说结论", topic: "会议上被点名：请先给出你的判断，再补一个理由。" },
      { id: "l1-change", profile: "improv", goal: "先说结论", topic: "同事问你为什么改方案：请先讲决定，再说明一个依据。" },
      { id: "l1-clarify", profile: "improv", goal: "先说结论", topic: "任务要求不清楚：请先说你需要确认什么，再说明原因。" }
    ]
  },
  {
    id: 2,
    name: "讲得完整清晰",
    short: "让人听见结果、你的动作和证据。",
    completeLabel: "完成 3 张项目证据卡",
    challenges: [
      { id: "l2-intro", confidenceScenario: "intro" },
      { id: "l2-project", confidenceScenario: "project" },
      { id: "l2-ownership", confidenceScenario: "ownership" }
    ]
  },
  {
    id: 3,
    name: "60 秒讲到位",
    short: "按场景压缩，只留下对方需要的信息。",
    completeLabel: "完成 3 次跨场景复练",
    challenges: [
      { id: "l3-report", profile: "workplace", goal: "结果 + 风险 + 下一步", topic: "向负责人说明本周进展：只说结果、一个风险和需要确认的下一步。" },
      { id: "l3-smalltalk", profile: "smalltalk", goal: "观察 + 接住", topic: "午饭时同事说最近项目很赶：先接住对方，再留一个轻量问题。" },
      { id: "l3-story", profile: "story", goal: "变化 + 判断 + 证据", topic: "讲一个推进卡住后重新向前的经历：先说变化，再说你的判断和一个证据。" }
    ]
  },
  { id: 4, name: "推动别人行动", short: "未来：方案说服与分歧推进。", future: true },
  { id: 5, name: "多人沟通控场", short: "未来：会议收拢、回应质疑与明确决定。", future: true },
  { id: 6, name: "统一目标与共识", short: "未来：战略叙事与长期协同。", future: true },
  { id: 7, name: "高压演说与博弈", short: "未来：危机回应、谈判与公开表达。", future: true }
];

function read() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" ? { completed: value.completed || {} } : { completed: {} };
  } catch {
    return { completed: {} };
  }
}

function save(value) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)); } catch {}
}

export function createPyramidProgress() {
  let value = read();
  const completed = (levelId) => Array.isArray(value.completed[levelId]) ? value.completed[levelId] : [];
  const level = (levelId) => pyramidLevels.find((item) => item.id === levelId);

  function count(levelId) { return completed(levelId).length; }
  function isComplete(levelId) {
    const item = level(levelId);
    return Boolean(item && !item.future && count(levelId) >= item.challenges.length);
  }
  function currentLevel() {
    return pyramidLevels.find((item) => !item.future && !isComplete(item.id)) || pyramidLevels[2];
  }
  function nextChallenge(levelId = currentLevel().id) {
    const item = level(levelId) || currentLevel();
    return item.challenges.find((challenge) => !completed(item.id).includes(challenge.id)) || item.challenges[0];
  }
  function record(levelId, challengeId) {
    if (!level(levelId)?.challenges.some((item) => item.id === challengeId)) return false;
    const done = completed(levelId);
    if (done.includes(challengeId)) return false;
    value = { completed: { ...value.completed, [levelId]: [...done, challengeId] } };
    save(value);
    return true;
  }

  return { count, isComplete, currentLevel, nextChallenge, record };
}

export function mountPyramidHome({ progress, startChallenge, showAllProfiles, openTheory }) {
  const $ = (selector) => document.querySelector(selector);
  const root = $("#pyramidHome");
  if (!root) return { refresh: () => {} };
  const map = $("#pyramidMap");

  function renderMap() {
    const list = $("#pyramidLevels");
    list.replaceChildren(...pyramidLevels.map((level) => {
      const item = document.createElement("li");
      const heading = document.createElement("strong");
      heading.textContent = `${level.id} / ${level.name}`;
      const detail = document.createElement("span");
      detail.textContent = level.future ? level.short : `${level.short} ${progress.count(level.id)}/${level.challenges.length}`;
      item.append(heading, detail);
      if (level.future) item.className = "future";
      else if (progress.isComplete(level.id)) item.className = "complete";
      else {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "练这一关";
        button.addEventListener("click", () => startChallenge(progress.nextChallenge(level.id), level.id));
        item.append(button);
      }
      return item;
    }));
  }

  function refresh(message = "") {
    const level = progress.currentLevel();
    const challenge = progress.nextChallenge(level.id);
    $("#pyramidLevel").textContent = `第 ${level.id} 关 / ${level.name}`;
    $("#pyramidQuestion").textContent = challenge.confidenceScenario
      ? "先填三条真实证据，再完成这一轮。"
      : challenge.topic;
    $("#pyramidProgress").textContent = `${level.completeLabel} · ${progress.count(level.id)}/${level.challenges.length}`;
    $("#pyramidStatus").textContent = message || "这是个人训练记录，不是职业能力认证。";
    renderMap();
  }

  $("#pyramidGo").addEventListener("click", () => {
    const level = progress.currentLevel();
    startChallenge(progress.nextChallenge(level.id), level.id);
  });
  $("#pyramidOpen").addEventListener("click", () => {
    const expanded = map.hidden;
    map.hidden = !expanded;
    $("#pyramidOpen").setAttribute("aria-expanded", String(expanded));
    $("#pyramidOpen").textContent = expanded ? "收起能力金字塔" : "查看能力金字塔";
  });
  $("#pyramidAllProfiles").addEventListener("click", showAllProfiles);
  $("#pyramidTheory").addEventListener("click", openTheory);
  refresh();
  return { refresh };
}
