const variant = "v3-4-60-a";
const home = document.querySelector("#pyramidHome");
const title = home?.querySelector("h1");
const status = document.querySelector("#pyramidStatus");
const map = document.querySelector("#pyramidMap");
const mapToggle = document.querySelector("#pyramidOpen");

document.body.dataset.candidateVariant = variant;
document.body.dataset.challengeVariant = "a";
if (home?.querySelector(".speak-eyebrow")) home.querySelector(".speak-eyebrow").textContent = "职场表达能力金字塔 / 60 秒挑战";
if (title) title.textContent = "今天，离下一段位只差一条真实证据。";
if (status) status.textContent = "不虚构对手，只记录你主动提交的有效训练证据。";
document.title = "讲清楚 V3-4 | 职场表达能力金字塔";

if (map && mapToggle) {
  map.hidden = false;
  mapToggle.setAttribute("aria-expanded", "true");
  mapToggle.textContent = "收起能力金字塔";
}
