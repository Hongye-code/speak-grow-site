const levels = [
  ["开口新手", "职场新人", "结论先行", "被点名、澄清、简短判断、日常回应"],
  ["可靠执行者", "专员", "结果、动作、证据", "交付、复盘、面试、协作说明"],
  ["核心骨干", "项目骨干", "60 秒讲到位", "汇报、闲聊、故事、风险推进"],
  ["项目主导者", "主管", "说服与分歧推进", "方案、资源取舍、反对意见、协作承诺"],
  ["协同统筹者", "团队负责人、总监", "多人会议控场", "议程、收拢分歧、回应质疑、明确决策"],
  ["共识引领者", "部门负责人、高管", "战略叙事与目标统一", "战略沟通、跨部门、变革、优先级"],
  ["战略发声者", "创始人、高阶谈判者", "高压表达与博弈", "危机回应、谈判、公开问答、关键演说"]
];

const categories = ["判断", "协作", "复盘", "推进", "回应"];
const contexts = [
  "周会临时被点名说明进度", "同事要求你立刻确认方案", "负责人追问你刚才的判断", "跨部门协作出现等待", "项目结果没有达到预期", "资源只够支持一件事", "客户提出新的临时要求", "团队对优先级理解不同", "你需要说明一个风险", "会议讨论开始偏离主题", "有人反对你的建议", "需要解释一个关键取舍", "交付前发现一个不确定性", "要把复杂信息压缩给负责人", "你需要接住对方的质疑", "推进事项连续两天没有反馈", "合作方希望改变原先约定", "要说明一个数据和直觉相反的结论", "你要把一段经历讲成一个可理解的故事", "你需要把讨论收束为下一步", "要在有限时间内给出建议", "你发现团队正在重复劳动", "上级要求你做出明确选择", "需要回应一个公开场合的问题", "项目遇到突发变化"
];

function prompt(level, category, context, index) {
  const action = [
    "先给出你的结论，再补一个依据。",
    "先接住相关方，再说清你的主张、边界和下一步。",
    "先说明结果或变化，再给一个真实证据和复盘判断。",
    "先明确要推进的决定，再说明谁在何时做什么。"
  ][index % 4];
  return `${context}。作为${levels[level - 1][1]}，请围绕“${levels[level - 1][2]}”完成 60 秒${category}表达：${action}`;
}

export const ladderLevels = levels.map(([label, role, focus, composition], index) => ({
  id: index + 1,
  label,
  role,
  focus,
  composition,
  threshold: [60, 65, 70, 72, 75, 78, 82][index]
}));

export const ladderScenes = Object.fromEntries(ladderLevels.map((level) => [level.id, categories.flatMap((category, categoryIndex) => contexts.slice(0, 20).map((context, index) => ({
  id: `l${level.id}-${categoryIndex + 1}-${String(index + 1).padStart(2, "0")}`,
  level: level.id,
  category,
  profileId: level.id === 1 ? "improv" : level.id === 2 ? "interview" : level.id === 3 ? ["workplace", "smalltalk", "story", "workplace"][categoryIndex] : level.id === 4 ? "workplace" : level.id === 5 ? "workplace" : level.id === 6 ? "speech" : "speech",
  question: prompt(level.id, category, context, index)
})))]));

export function findLadderScene(level, id) {
  return ladderScenes[Number(level)]?.find((scene) => scene.id === id) || null;
}

export function randomLadderScene(level, random = Math.random) {
  const scenes = ladderScenes[Number(level)] || [];
  return scenes[Math.floor(random() * scenes.length)] || null;
}
