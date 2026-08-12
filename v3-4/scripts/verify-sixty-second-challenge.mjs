import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHALLENGE_QUESTION } from "../web/modules/sixty-second-challenge.js";
import { scoreLadderTranscript } from "../web/modules/ladder-rubric.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = await readFile(new URL("web/index.html", `file://${root}`), "utf8");
const app = await readFile(new URL("web/app.js", `file://${root}`), "utf8");
const training = await readFile(new URL("web/modules/training.js", `file://${root}`), "utf8");
if (CHALLENGE_QUESTION !== "领导突然问：你最近在忙什么？请用 60 秒说明。") throw new Error("固定挑战题不正确");
for (const token of ["sixtyChallengeScreen", "challengeResultScreen", "challengeStart", "challengeRetry", "challengePoster", "growthRetest", "不是职位、职业资格或社会地位判断"]) {
  if (!index.includes(token)) throw new Error(`缺少挑战界面或真实性提示：${token}`);
}
for (const token of ["clearTranscriptButton", "准备期不扣练习时间"]) if (!`${index}\n${app}`.includes(token)) throw new Error(`缺少练习准备或清空原稿：${token}`);
if (!training.includes("preparationSeconds = 5") || !training.includes("phase: preparation > 0 ? \"preparing\" : \"training\"")) throw new Error("训练准备期未接入真实计时状态机");
const invalid = scoreLadderTranscript({ level: 1, transcript: "太短" });
const first = scoreLadderTranscript({ level: 1, transcript: "我最近的重点是推进项目关键内容按期交付。目前核心内容已完成，我负责梳理需求并确认交付细节。周四前我会完成最后确认，并同步风险与需要支持的事项。" });
const second = scoreLadderTranscript({ level: 1, transcript: "我最近的重点是推进项目关键内容按期交付。目前核心内容已完成，我负责梳理需求并确认交付细节。周四前我会完成最后确认，并同步风险与需要支持的事项。现在需要团队确认资源优先级，避免影响后续交付。" });
if (invalid.valid || !first.valid || !second.valid || !Number.isInteger(first.score) || !Number.isInteger(second.score)) throw new Error("单题评分与手动原稿降级不完整");
console.log("60-second-challenge: fixed one-question assessment, real transcript scoring, same-question retry, poster, manual fallback and non-certification copy verified");
