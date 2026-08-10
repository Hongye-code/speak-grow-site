import { defaultProfileId, profileRegistry, profiles, sceneQuestion } from "../web/data/profiles.js";

const expectedIds = ["improv", "smalltalk", "workplace", "interview", "story", "topic", "speech"];
if (defaultProfileId !== "workplace") throw new Error("默认板块必须是职场表达");
if (profileRegistry.map((profile) => profile.id).join(",") !== expectedIds.join(",")) throw new Error("板块注册表顺序不正确");

for (const profile of profileRegistry) {
  const required = ["id", "order", "code", "name", "summary", "goals", "steps", "scenes", "capabilities"];
  if (required.some((field) => profile[field] === undefined)) throw new Error(`${profile.id} 缺少注册字段`);
  const questions = profile.scenes.map(sceneQuestion);
  if (questions.length !== 100 || new Set(questions).size !== 100) throw new Error(`${profile.name} 场景库必须有 100 个不重复场景`);
  if (profile.capabilities.audioDownload !== true) throw new Error(`${profile.name} 必须提供本地 WebM 录音下载`);
}

if (Object.keys(profiles).length !== expectedIds.length) throw new Error("板块索引不完整");
console.log("profiles: 7 boards x 100 unique scenes; every training supports local WebM download");
