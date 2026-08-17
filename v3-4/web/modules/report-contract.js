export const compassLabels = ["主张", "证据", "边界", "关系", "下一步"];
export const detailedSectionTitles = ["场景判断", "主张与结构", "证据与具体性", "边界与听众关系", "下一轮行动"];

const profileRubrics = {
  interview: { name: "求职面试", focus: "岗位价值、项目结果、个人作用和可核验的证据。" },
  workplace: { name: "职场表达", focus: "明确判断、支持范围、优先级影响和可执行的下一步。" },
  speech: { name: "深度演讲", focus: "清楚观点、理由、一个有力例子和能够收束的结尾。" },
  topic: { name: "主题表达", focus: "把抽象想法落到具体事例，并让听众复述你的结论。" },
  improv: { name: "即兴表达", focus: "先说是什么、为什么、怎么做；回应场景先接住对方再表达判断。" },
  smalltalk: { name: "闲聊训练", focus: "一个具体观察、对对方原话的回应，以及留白的轻量问题。" },
  story: { name: "讲故事", focus: "前后变化、关键判断、一个真实细节和这段经历的当前价值。" }
};

function clean(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function quoteFromTranscript(quote, transcript) {
  const compactQuote = clean(quote, 80).replace(/\s/g, "");
  const compactTranscript = clean(transcript, 8000).replace(/\s/g, "");
  return compactQuote.length >= 4 && compactTranscript.includes(compactQuote);
}

function visibleLength(value) {
  return clean(value, 2000).replace(/\s/g, "").length;
}

function parseJson(content) {
  const match = String(content).match(/\{[\s\S]*\}/);
  if (!match) throw new Error("invalid_model_response");
  try { return JSON.parse(match[0]); } catch { throw new Error("invalid_model_response"); }
}

export function buildReportContext(input = {}) {
  const profileId = Object.hasOwn(profileRubrics, input.profileId) ? input.profileId : "workplace";
  const profile = profileRubrics[profileId];
  return {
    profileId,
    profileName: profile.name,
    rubric: profile.focus,
    scene: clean(input.scene, 160),
    goal: clean(input.goal, 80),
    focus: clean(input.focus, 120),
    detailLevel: input.detailLevel === "advanced" ? "advanced" : "standard",
    transcript: clean(input.transcript, 8000)
  };
}

export function buildReportPrompt(input) {
  const context = buildReportContext(input);
  return [
    "你是严谨的中文表达教练。只依据原稿，不虚构经历、数据或事实，也不做职业能力认证。",
    "当前训练板块：" + context.profileName,
    "板块判断重点：" + context.rubric,
    "具体场景：" + context.scene,
    "本轮唯一目标：" + context.goal,
    "当前力量动作：" + context.focus,
    "原稿：",
    context.transcript,
    "评分锚点：每个维度 0-5 为未出现或妨碍理解，6-11 为隐约出现但模糊，12-16 为足以推进当前场景，17-20 为具体、可信且能帮助听众行动。",
    "反馈规则：先从原稿选出一个最影响本轮目标的问题。priority.quote 必须逐字引用原稿中至少四个字的连续片段；impact 必须说明这会让当前听众哪里听不懂、犹豫或无法行动；action 只给下一轮最小动作。五维 evidence 必须引用原稿事实或明确说明缺口。rewrite 不得添加原稿没有的事实、数字或承诺。",
    "完整报告规则：detailedSections 必须严格按“场景判断、主张与结构、证据与具体性、边界与听众关系、下一轮行动”顺序返回五段。每段 analysis 至少 300 个中文字符，必须围绕当前板块、场景、目标和力量动作分析，不能把泛泛模板换词重复。每段 quote 必须逐字引用原稿中的连续片段；可以重复引用同一句，但解释必须不同。",
    context.detailLevel === "advanced" ? "这是用户自带 API 的专属深度教练模式：额外返回 deepCoach。它必须给出至少 300 个中文字符的个性化迁移分析、一段 160 至 360 个中文字符的第二轮 60 秒示范，以及 3 条可检查的复练清单；只可使用原稿已有事实。" : "这是公共完整报告模式：不要返回 deepCoach。",
    "只返回合法 JSON：",
    context.detailLevel === "advanced"
      ? '{"score":0到100整数,"summary":"一句具体判断","priority":{"label":"主张/证据/边界/关系/下一步之一","quote":"原稿中的连续原话","impact":"当前场景中的具体影响","action":"下一轮只做的一步"},"compass":[{"label":"主张","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"证据","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"边界","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"关系","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"下一步","score":0到20整数,"evidence":"原稿依据或具体缺口"}],"detailedSections":[{"title":"场景判断","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"主张与结构","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"证据与具体性","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"边界与听众关系","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"下一轮行动","quote":"原稿连续原话","analysis":"至少300个中文字符"}],"rewrite":{"original":"原稿中要改的一句","improved":"保留原意的加强句","reason":"为什么更能推进当前场景"},"deepCoach":{"quote":"原稿连续原话","analysis":"至少300个中文字符的个性化迁移分析","secondRound":"160至360个中文字符的第二轮60秒示范","checklist":["可检查动作一","可检查动作二","可检查动作三"]}}'
      : '{"score":0到100整数,"summary":"一句具体判断","priority":{"label":"主张/证据/边界/关系/下一步之一","quote":"原稿中的连续原话","impact":"当前场景中的具体影响","action":"下一轮只做的一步"},"compass":[{"label":"主张","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"证据","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"边界","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"关系","score":0到20整数,"evidence":"原稿依据或具体缺口"},{"label":"下一步","score":0到20整数,"evidence":"原稿依据或具体缺口"}],"detailedSections":[{"title":"场景判断","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"主张与结构","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"证据与具体性","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"边界与听众关系","quote":"原稿连续原话","analysis":"至少300个中文字符"},{"title":"下一轮行动","quote":"原稿连续原话","analysis":"至少300个中文字符"}],"rewrite":{"original":"原稿中要改的一句","improved":"保留原意的加强句","reason":"为什么更能推进当前场景"}}'
  ].join("\n\n");
}

export function parseModelReport(content, input) {
  const context = buildReportContext(input);
  const report = parseJson(content);
  const validCompass = Array.isArray(report.compass) && report.compass.length === compassLabels.length && report.compass.every((item, index) =>
    item?.label === compassLabels[index] && Number.isInteger(item.score) && item.score >= 0 && item.score <= 20 && clean(item.evidence, 180).length > 0
  );
  const priority = report.priority;
  const validPriority = priority && compassLabels.includes(priority.label) && quoteFromTranscript(priority.quote, context.transcript) && clean(priority.impact, 180).length > 0 && clean(priority.action, 120).length > 0;
  const rewrite = report.rewrite;
  const validRewrite = rewrite && quoteFromTranscript(rewrite.original, context.transcript) && clean(rewrite.improved, 180).length > 0 && clean(rewrite.reason, 180).length > 0;
  const validDetails = Array.isArray(report.detailedSections) && report.detailedSections.length === detailedSectionTitles.length && report.detailedSections.every((section, index) =>
    section?.title === detailedSectionTitles[index] && quoteFromTranscript(section.quote, context.transcript) && visibleLength(section.analysis) >= 300
  );
  const coach = report.deepCoach;
  const validCoach = context.detailLevel !== "advanced" || (coach && quoteFromTranscript(coach.quote, context.transcript) && visibleLength(coach.analysis) >= 300 && visibleLength(coach.secondRound) >= 160 && visibleLength(coach.secondRound) <= 360 && Array.isArray(coach.checklist) && coach.checklist.length === 3 && coach.checklist.every((item) => clean(item, 100).length >= 4));
  if (!Number.isInteger(report.score) || report.score < 0 || report.score > 100 || clean(report.summary, 140).length < 4 || !validPriority || !validCompass || !validDetails || !validRewrite || !validCoach) {
    throw new Error("invalid_model_schema");
  }
  return {
    score: report.score,
    trainingPoints: report.score,
    summary: clean(report.summary, 140),
    priority: { label: priority.label, quote: clean(priority.quote, 80), impact: clean(priority.impact, 180), action: clean(priority.action, 120) },
    compass: report.compass.map((item) => ({ label: item.label, score: item.score, evidence: clean(item.evidence, 180) })),
    detailedSections: report.detailedSections.map((section) => ({ title: section.title, quote: clean(section.quote, 80), analysis: clean(section.analysis, 1800) })),
    rewrite: { original: clean(rewrite.original, 80), improved: clean(rewrite.improved, 180), reason: clean(rewrite.reason, 180) },
    ...(context.detailLevel === "advanced" ? { deepCoach: { quote: clean(coach.quote, 80), analysis: clean(coach.analysis, 1800), secondRound: clean(coach.secondRound, 420), checklist: coach.checklist.map((item) => clean(item, 100)) } } : {}),
    source: "model"
  };
}
