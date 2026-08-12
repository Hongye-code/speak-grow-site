import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ladderLevels, ladderScenes } from "../web/data/ladder-scenes.js";
import { scoreLadderTranscript } from "../web/modules/ladder-rubric.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const worker = await readFile(new URL("worker.mjs", `file://${root}`), "utf8");
const index = await readFile(new URL("web/index.html", `file://${root}`), "utf8");
const ladder = await readFile(new URL("web/modules/ladder.js", `file://${root}`), "utf8");
if (ladderLevels.length !== 7 || ladderLevels.map((item) => item.threshold).join(",") !== "60,65,70,72,75,78,82") throw new Error("七级门槛不完整");
for (const level of ladderLevels) {
  const scenes = ladderScenes[level.id] || [];
  if (scenes.length !== 100 || new Set(scenes.map((scene) => scene.id)).size !== 100 || new Set(scenes.map((scene) => scene.question)).size !== 100) throw new Error(`第 ${level.id} 级必须有 100 道不重复题目`);
  const categoryCounts = [...new Set(scenes.map((scene) => scene.category))].map((category) => scenes.filter((scene) => scene.category === category).length);
  if (categoryCounts.length !== 5 || categoryCounts.some((count) => count !== 20)) throw new Error(`第 ${level.id} 级必须为 5 类各 20 题，以支持五条不同类别证据晋级`);
}
const sample = "我的判断是先完成关键交付，因为数据和用户反馈显示风险最高。我们需要确认范围和优先级，今天由我负责安排下一步并同步团队。";
const result = scoreLadderTranscript({ level: 1, transcript: sample });
if (!result.valid || result.dimensions.length !== 5 || !Number.isInteger(result.score)) throw new Error("服务端可复算的五维量表不完整");
for (const endpoint of ["/api/ladder/challenge", "/api/ladder/verify", "/api/ladder/board", "/api/ladder/profile", "LADDER_HMAC_SECRET", "transcript_hash", "expires_at", "used_at", "duplicate_submission", "rankInsight", "exceededPercent", "showPercentile"]) if (!worker.includes(endpoint)) throw new Error(`匿名天梯服务端缺少 ${endpoint}`);
for (const token of ["ladderScreen", "ladderAssessment", "assessmentStart", "assessmentNext", "assessmentEnter", "ladderGetChallenge", "ladderSubmit", "ladderDelete", "首次进入 / 7 分钟测级", "匿名表达天梯", "音频永不上传"]) if (!index.includes(token)) throw new Error(`匿名天梯界面缺少 ${token}`);
for (const token of ["randomLadderScene(level)", "localOnly: true", "本轮不进入匿名榜单"]) if (!ladder.includes(token)) throw new Error(`题签降级路径缺少 ${token}`);
console.log("ladder: 7 x 100 unique scenes, five-category promotion, server recompute, one-time challenge, privacy and deletion routes verified");
