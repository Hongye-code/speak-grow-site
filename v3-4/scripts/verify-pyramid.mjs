import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pyramidLevels } from "../web/modules/pyramid.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const index = await readFile(new URL("web/index.html", `file://${root}`), "utf8");
const app = await readFile(new URL("web/app.js", `file://${root}`), "utf8");

if (pyramidLevels.length !== 7 || pyramidLevels.slice(0, 3).some((level) => level.challenges.length !== 3) || pyramidLevels.slice(3).some((level) => !level.ladder)) {
  throw new Error("职场表达能力金字塔必须包含前三层原有真实训练和四层匿名天梯训练入口");
}
if (!pyramidLevels.slice(0, 3).flatMap((level) => level.challenges).every((challenge) => challenge.profile || challenge.confidenceScenario)) {
  throw new Error("前三层关卡必须连接到真实训练，不得使用静态演示");
}
for (const role of ["职场新人", "专员", "项目骨干", "主管", "团队负责人、总监", "部门负责人、高管", "创始人、高阶谈判者"]) {
  if (!pyramidLevels.some((level) => level.role === role)) throw new Error(`七级地图缺少常见承担角色：${role}`);
}
if (!["pyramidHome", "pyramidGo", "pyramidMap", "pyramidLevels", "pyramidAllProfiles", "pyramidTheory", "ladderHomeButton", "ladderScreen", "allProfiles", "practiceSetup", "匿名表达天梯", "训练引用与历代资料索引", "天梯第 4 至 7 级可选资料", "vendor/vad/vad.bundle.min.js"].every((token) => index.includes(token))) {
  throw new Error("V3-4 首页、资料索引或 VAD 资源不完整");
}
if (!["createPyramidProgress", "mountPyramidHome", "startPyramidChallenge", "startLadderChallenge", "mountLadder", "state.pyramid", "createVadIndicator", "getActiveStream", "showAllProfiles", "openTheory"].every((token) => app.includes(token))) {
  throw new Error("V3-4 训练闭环、旧训练入口或 VAD 降级接入不完整");
}
await Promise.all([
  "web/vendor/vad/vad.bundle.min.js",
  "web/vendor/vad/vad.worklet.bundle.min.js",
  "web/vendor/vad/silero_vad_legacy.onnx",
  "third_party/whisper.cpp/LICENSE",
  "third_party/vad-source/LICENSE"
].map((path) => stat(new URL(path, `file://${root}`))));
console.log("v3-4: seven-level local training map, prior-version materials, VAD fallback assets, and source licenses verified");
