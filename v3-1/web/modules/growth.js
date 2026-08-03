const milestones = [
  { name: "敢于开口", score: 500 },
  { name: "清晰表达", score: 1000 },
  { name: "稳住边界", score: 2000 },
  { name: "推进共识", score: 5000 },
  { name: "职场表达影响力", score: 10000 }
];

const storageKey = "speak-grow-v3-1-growth";
const defaultPoints = 1240;

function savedPoints() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(storageKey), 10);
    return Number.isFinite(value) && value >= 0 ? value : defaultPoints;
  } catch {
    return defaultPoints;
  }
}

export const growth = { points: savedPoints(), milestones };

export function addTrainingScore(score) {
  const points = Number.parseInt(score, 10);
  if (!Number.isInteger(points) || points < 0 || points > 100) return growth.points;
  growth.points += points;
  try { window.localStorage.setItem(storageKey, String(growth.points)); } catch {}
  return growth.points;
}

export function nextMilestone(points = growth.points) { return milestones.find((item) => item.score > points) || milestones[milestones.length - 1]; }
export function renderBadges(container, points = growth.points) {
  container.replaceChildren(...milestones.map((item) => {
    const badge = document.createElement("span");
    const unlocked = points >= item.score;
    badge.innerHTML = `${unlocked ? "✦" : "◇"}<b>${item.name}</b><small>${item.score.toLocaleString("zh-CN")} 分</small>`;
    return badge;
  }));
}
