import { interviewScenes } from "./interview-scenes.js";
import { improvScenes } from "./improv-scenes.js";
import { moves } from "./moves.js";
import { speechScenes } from "./speech-scenes.js";
import { topicScenes } from "./topic-scenes.js";
import { workplaceScenes } from "./workplace-scenes.js";

const moveById = new Map(moves.map((move) => [move.id, move]));

export const defaultProfileId = "workplace";

export const profileRegistry = [
  { id: "interview", order: 1, code: "CAREER", name: "求职面试", icon: "◎", shortSummary: "结果 + 证据", title: "把价值讲具体", summary: "先给出结果，再用你的选择和证据证明价值。", goals: ["先讲结果", "说清自己的作用", "给出可验证证据"], steps: ["先说最后创造的变化。", "说明你的关键判断。", "留下一个可核验细节。"], scenes: interviewScenes, capabilities: { audioDownload: false } },
  { id: "workplace", order: 2, code: "DEFAULT", name: "职场表达", icon: "↗", shortSummary: "范围 + 优先级", title: "尊重自己的时间", summary: "先讲清你已承诺的事，再给出你能支持的范围，让优先级回到该决定的人手里。", goals: ["先说可支持范围", "讲清已有承诺", "把优先级交回去"], steps: ["先说你能支持什么。", "说明完整接手会影响什么。", "请对方确认优先级。"], scenes: workplaceScenes, capabilities: { audioDownload: false } },
  { id: "speech", order: 3, code: "IDEA", name: "深度演讲", icon: "✦", shortSummary: "观点 + 例子", title: "让观点站得住", summary: "用一个明确判断开场，再用熟悉例子把观点落到现实。", goals: ["先抛出观点", "用一个证据支撑", "留下可行动的结尾"], steps: ["第一句说判断。", "只选一个有力例子。", "留下今天能做的一步。"], scenes: speechScenes, capabilities: { audioDownload: false } },
  { id: "topic", order: 4, code: "CLARITY", name: "主题表达", icon: "▣", shortSummary: "抽象 → 具体", title: "把复杂想法说简单", summary: "先把抽象概念换成身边场景，再给听众一句可复述结论。", goals: ["把主题说简单", "举一个具体例子", "形成清楚收束"], steps: ["先用真实小事起头。", "一次只说一个逻辑台阶。", "用一句可复述的话结尾。"], scenes: topicScenes, capabilities: { audioDownload: false } },
  { id: "improv", order: 5, code: "IMPROV", name: "即兴表达", icon: "⚡", shortSummary: "结构 + 接话", title: "用结构接住临场表达", summary: "先说是什么，再说为什么，最后说怎么做；每次只改一个最影响清楚度的问题。", goals: ["讲出结构", "减少一个口头禅", "接住对方"], steps: ["先说它是什么。", "再解释为什么重要。", "最后给出怎么做。"], scenes: improvScenes, capabilities: { audioDownload: true } }
].sort((left, right) => left.order - right.order);

export const profiles = Object.fromEntries(profileRegistry.map((profile) => [profile.id, profile]));

for (const profile of Object.values(profiles)) {
  const questions = profile.scenes.map((scene) => typeof scene === "string" ? scene : scene.question);
  if (questions.length !== 100 || new Set(questions).size !== 100) throw new Error(`${profile.name} 场景库必须有 100 个不重复场景`);
}

export function sceneQuestion(scene) { return typeof scene === "string" ? scene : scene.question; }
export function defaultScene(mode) { return profiles[mode].scenes[0]; }
export function findScene(mode, question) { return profiles[mode].scenes.find((scene) => sceneQuestion(scene) === question); }
export function randomScene(mode, currentQuestion) {
  const choices = profiles[mode].scenes.filter((scene) => sceneQuestion(scene) !== currentQuestion);
  return (choices.length ? choices : profiles[mode].scenes)[Math.floor(Math.random() * (choices.length || profiles[mode].scenes.length))];
}
export function toolkitFor(mode, scene) {
  const profile = profiles[mode];
  const move = mode === "workplace" && scene && typeof scene !== "string" ? moveById.get(scene.move) : null;
  return move ? { title: move.name, summary: move.hint, steps: [move.prompt, move.challenge, "完成后只复练一句更清楚的表达。"] } : profile;
}
