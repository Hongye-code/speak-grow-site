import { buildReportPrompt, detailedSectionTitles, parseModelReport } from "../web/modules/report-contract.js";
import { buildLocalReport } from "../web/modules/local-report.js";
import { reportFixtures } from "./report-fixtures.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteFor(transcript) {
  return transcript.replace(/\s/g, "").slice(0, 16);
}

function longAnalysis(title, quote) {
  return `${title}不是通过某一个关键词就能判断的。原稿中的“${quote}”是本轮可以核对的真实证据，它说明说话者已经开始建立自己的表达路径，但还需要把它和具体场景、听众关心的问题、本轮训练目标连接起来。先不要为了显得专业而添加原稿里没有的经历、数字或承诺；更有效的做法是保留这层真实意思，明确它解决的到底是什么问题。接着检查听众在听到这句话后，是否能说出你的判断、知道你依据了什么，以及明白下一步由谁做什么。如果其中任一项仍然模糊，就只补一个细节，不要把一轮六十秒练习扩写成完整演讲。这样才能让复练聚焦、可验证，也让表达保持自己的语气。`.repeat(2);
}

function modelJson(input, advanced = false) {
  const quote = quoteFor(input.transcript);
  return {
    score: 78,
    summary: "你已经说出了核心判断，下一轮优先让听众知道具体怎么推进。",
    priority: { label: "下一步", quote, impact: "听众无法据此确认后续安排。", action: "补一句负责人、时间和最小动作。" },
    compass: ["主张", "证据", "边界", "关系", "下一步"].map((label, index) => ({ label, score: 14 + index, evidence: `原稿中的“${quote}”提供了本轮判断依据。` })),
    detailedSections: detailedSectionTitles.map((title) => ({ title, quote, analysis: longAnalysis(title, quote) })),
    rewrite: { original: quote, improved: `${quote}，所以我建议先确认负责人和完成时间。`, reason: "把判断落到听众可以确认的下一步。" },
    ...(advanced ? { deepCoach: { quote, analysis: longAnalysis("专属深度教练", quote), secondRound: `我先说结论：${quote}。接着我只补一个真实理由，说明这件事为什么影响当前场景。最后我会明确提出一个最小下一步：请相关的人确认负责人和完成时间。这样既保留原稿想表达的重点，也让听众知道现在可以如何行动。复练时请控制在六十秒内，不补充原稿没有出现的事实；说完后停半秒，再检查对方是否已经听见你的结论、理由和下一步。`, checklist: ["第一句先说判断，不从背景开始。", "只补一个原稿已经出现的理由或细节。", "结尾明确负责人、时间或确认动作。"] } } : {})
  };
}

assert(reportFixtures.length === 20, "测试原稿必须为 20 条");
for (const profileId of ["interview", "workplace", "speech", "topic", "improv"]) assert(reportFixtures.filter((item) => item.profileId === profileId).length === 4, `${profileId} 必须覆盖四条原稿`);

for (const fixture of reportFixtures) {
  const prompt = buildReportPrompt(fixture);
  assert(prompt.includes("当前训练板块：") && prompt.includes("完整报告规则"), "提示词必须包含训练上下文和完整报告规则");
  const report = parseModelReport(JSON.stringify(modelJson(fixture)), fixture);
  assert(report.source === "model" && report.detailedSections.length === 5, "模型报告必须有五段完整分析");
  assert(report.detailedSections.every((section) => section.analysis.replace(/\s/g, "").length >= 300 && fixture.transcript.replace(/\s/g, "").includes(section.quote.replace(/\s/g, ""))), "详细分析必须足量且引用原稿");
}

const advancedFixture = { ...reportFixtures[0], detailLevel: "advanced" };
const advanced = parseModelReport(JSON.stringify(modelJson(advancedFixture, true)), advancedFixture);
assert(advanced.deepCoach?.checklist?.length === 3, "BYOK 必须返回专属深度教练");

const invented = modelJson(reportFixtures[0]);
invented.detailedSections[0].quote = "这句不在原稿中";
let rejected = false;
try { parseModelReport(JSON.stringify(invented), reportFixtures[0]); } catch { rejected = true; }
assert(rejected, "虚构引用必须被拒绝");

const local = buildLocalReport(reportFixtures[0]);
assert(local.source === "local" && Number.isInteger(local.score) && local.score >= 0 && local.score <= 100 && local.trainingPoints === local.score, "本地完整训练评估必须生成可解释训练分");
assert(local.detailedSections?.length === 5 && local.detailedSections.every((section) => section.analysis.replace(/\s/g, "").length >= 300), "本地完整训练评估必须有五段长分析");
console.log("report-contract: 20 fixtures, evidence, detailed sections, BYOK coach, local complete report");
