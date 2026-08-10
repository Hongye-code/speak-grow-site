const variant = "e";
const home = document.querySelector("#pyramidHome");
const title = home?.querySelector("h1");
const current = document.querySelector(".pyramid-current");
const status = document.querySelector("#pyramidStatus");
const map = document.querySelector("#pyramidMap");
const mapToggle = document.querySelector("#pyramidOpen");

document.body.dataset.candidateVariant = variant;
const copy = {
  a: ["A / 今日闯关", "今天，只练一件能马上用上的事。", "打开就能练，其他选择先收起来。"],
  b: ["B / 证据先行", "不是没能力，是证据还没排好。", "先把结果、作用和证据排清楚，再开口。"],
  c: ["C / 三路训练", "你今天要练价值、推进，还是回应？", "先看三条职场开口路径，再进入同一套真实训练。"],
  d: ["D / 单句复练", "每次只改一句，下一次就会更稳。", "把注意力留给上一次最值得加强的那句话。"],
  e: ["E / 连续闯关", "每一次开口，都在下一层留下证据。", "看见完整路径，再完成今天这一关。"]
}[variant];

home?.querySelector(".speak-eyebrow")?.replaceChildren(copy[0]);
if (title) title.textContent = copy[1];
if (status) status.textContent = copy[2];
document.title = `讲清楚 V3-4 ${copy[0].replace(" / ", " | ")}`;

if (variant === "b" && current) current.insertAdjacentHTML("beforeend", '<div class="candidate-proof"><b>结果</b><b>我的作用</b><b>一个证据</b></div>');
if (variant === "c" && current) current.insertAdjacentHTML("beforeend", '<div class="candidate-routes"><span>01 讲清价值</span><span>02 推进工作</span><span>03 自然回应</span></div>');
if (variant === "d" && current) {
  let rewrite = "先说结论，再补一个理由。";
  try { rewrite = localStorage.getItem("speak-last-rewrite") || rewrite; } catch {}
  current.insertAdjacentHTML("beforeend", `<blockquote class="candidate-rewrite">上次要练的一句：${rewrite}</blockquote>`);
}
if (variant === "e" && map && mapToggle) {
  map.hidden = false;
  mapToggle.setAttribute("aria-expanded", "true");
  mapToggle.textContent = "收起能力金字塔";
}
