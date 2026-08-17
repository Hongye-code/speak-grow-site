import { ladderLevels } from "../data/ladder-scenes.js";

const dimensions = [
  ["结论", ["我建议", "结论", "判断", "应该", "优先", "核心"]],
  ["证据", ["因为", "数据", "结果", "事实", "例如", "具体", "用户", "项目"]],
  ["边界", ["风险", "范围", "条件", "影响", "不能", "取舍", "优先级"]],
  ["关系", ["我们", "对方", "团队", "同事", "理解", "确认", "一起"]],
  ["下一步", ["下一步", "今天", "确认", "负责", "完成", "安排", "决定"]]
];

const levelDimensionNames = [
  ["结论", "理由", "回应", "结构", "下一步"],
  ["结果", "动作", "证据", "岗位关系", "下一步"],
  ["重点", "取舍", "证据", "听者", "收束"],
  ["主张", "利弊", "反对意见", "协作承诺", "推进"],
  ["议程", "观点收拢", "质疑回应", "决定", "责任"],
  ["目标", "战略叙事", "跨部门关系", "优先级", "共识行动"],
  ["立场", "压力回应", "利益边界", "公众关系", "关键行动"]
];

function clean(text) { return String(text || "").trim(); }
function hits(text, words) { return words.reduce((count, word) => count + (text.split(word).length - 1), 0); }
function sentenceCount(text) { return text.split(/[。！？!?；;\n]/u).map((item) => item.trim()).filter((item) => item.length >= 5).length; }

export function scoreLadderTranscript({ level, transcript }) {
  const current = ladderLevels[Number(level) - 1];
  const text = clean(transcript);
  if (!current || text.length < 12 || text.length > 3000) return { valid: false, error: "invalid_transcript" };
  const sentences = sentenceCount(text);
  const scores = dimensions.map(([fallback, words], index) => {
    const name = levelDimensionNames[current.id - 1][index] || fallback;
    const base = 7 + Math.min(8, hits(text, words) * 3) + (sentences >= index + 1 ? 2 : 0) + (text.length >= 90 ? 2 : 0);
    const score = Math.max(0, Math.min(20, base));
    return { name, score, evidence: words.filter((word) => text.includes(word)).slice(0, 3) };
  });
  const score = scores.reduce((sum, item) => sum + item.score, 0);
  return {
    valid: true,
    score,
    dimensions: scores,
    qualified: score >= current.threshold && scores.every((item) => item.score >= 9),
    threshold: current.threshold,
    reason: score >= current.threshold && scores.every((item) => item.score >= 9) ? "qualified" : "below_threshold"
  };
}
