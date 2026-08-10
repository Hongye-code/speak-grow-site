const compassLabels = ["主张", "证据", "边界", "关系", "下一步"];
const fillerWords = ["嗯", "那个", "然后", "就是", "其实", "可能", "我觉得"];
const markerGroups = {
  claim: ["我认为", "我的判断", "我建议", "结论", "应该", "需要", "核心", "关键", "是"],
  evidence: ["因为", "比如", "例如", "数据", "事实", "案例", "结果", "具体", "一次", "用户", "项目"],
  boundary: ["范围", "优先级", "影响", "不能", "可以", "条件", "如果", "负责", "风险", "限制"],
  relation: ["你", "您", "我们", "对方", "团队", "同事", "听到", "理解", "确认", "谢谢"],
  next: ["下一步", "先", "今天", "明天", "安排", "确认", "完成", "验证", "负责", "再"],
  structure: ["第一", "第二", "第三", "先", "再", "最后", "因为", "所以", "但是", "同时"]
};
const profileGuidance = {
  interview: { audience: "面试官", standard: "岗位价值、个人作用、项目结果和可核验的事实", firstAction: "先说结果，再补一句你亲自做了什么。" },
  workplace: { audience: "正在协作的同事或负责人", standard: "判断、支持范围、优先级影响和明确下一步", firstAction: "先说可支持范围，再请对方确认优先级。" },
  speech: { audience: "正在听分享的人", standard: "明确观点、理由、一个例子和收束", firstAction: "第一句先下判断，再只保留一个例子。" },
  topic: { audience: "不熟悉这个主题的听众", standard: "抽象观点、具体事例和可复述结论", firstAction: "把一个抽象词换成身边正在发生的小事。" },
  improv: { audience: "正在等待你回应的对方", standard: "是什么、为什么、怎么做；回应时先接住对方", firstAction: "第一句先说结论，再按是什么、为什么、怎么做表达。" }
};

function clamp(value, minimum = 0, maximum = 20) {
  return Math.max(minimum, Math.min(maximum, value));
}

function compact(value) {
  return String(value || "").replace(/\s/g, "");
}

function sentences(text) {
  return String(text || "").split(/[。！？!?；;\n]/u).map((item) => item.trim()).filter((item) => item.length >= 4);
}

function countFillers(text) {
  return fillerWords.reduce((count, word) => count + (String(text).split(word).length - 1), 0);
}

function markerHits(text, markers) {
  return markers.filter((marker) => text.includes(marker));
}

function quoteFor(text, markers) {
  const source = sentences(text);
  return source.find((sentence) => markers.some((marker) => sentence.includes(marker))) || source[0] || String(text).trim().slice(0, 60);
}

function ensureLong(text, suffix) {
  let result = text;
  while (compact(result).length < 320) result += suffix;
  return result;
}

function indicatorSentence(name, hits, missing) {
  return hits.length ? `原稿里出现了“${hits.slice(0, 3).join("、")}”等信号，这说明“${name}”已经有可继续放大的基础。` : `原稿目前没有出现能稳定指向“${name}”的明确文字信号，这不是表达失败，而是下一轮最值得补足的空位。`;
}

export function buildLocalReport({ transcript, scene = "", goal = "", focus = "", profileId = "workplace" } = {}) {
  const text = String(transcript || "").trim();
  const normalized = compact(text);
  const guidance = profileGuidance[profileId] || profileGuidance.workplace;
  const fillers = countFillers(text);
  const claimHits = markerHits(text, markerGroups.claim);
  const evidenceHits = markerHits(text, markerGroups.evidence);
  const boundaryHits = markerHits(text, markerGroups.boundary);
  const relationHits = markerHits(text, markerGroups.relation);
  const nextHits = markerHits(text, markerGroups.next);
  const structureHits = markerHits(text, markerGroups.structure);
  const sentenceCount = sentences(text).length;
  const scores = {
    "主张": clamp(6 + (claimHits.length ? 7 : 0) + (sentenceCount >= 2 ? 2 : 0) + (normalized.length >= 80 ? 2 : 0)),
    "证据": clamp(5 + Math.min(9, evidenceHits.length * 3) + (/\d/u.test(text) ? 2 : 0)),
    "边界": clamp(5 + Math.min(10, boundaryHits.length * 3) + (profileId === "workplace" && text.includes("影响") ? 2 : 0)),
    "关系": clamp(5 + Math.min(9, relationHits.length * 3) + (profileId === "improv" && /理解|听到/u.test(text) ? 2 : 0)),
    "下一步": clamp(5 + Math.min(10, nextHits.length * 3) + (text.includes("确认") ? 2 : 0))
  };
  const compass = compassLabels.map((label) => ({
    label,
    score: scores[label],
    evidence: indicatorSentence(label, label === "主张" ? claimHits : label === "证据" ? evidenceHits : label === "边界" ? boundaryHits : label === "关系" ? relationHits : nextHits, "")
  }));
  const priority = compass.reduce((lowest, item) => item.score < lowest.score ? item : lowest, compass[0]);
  const quotes = {
    scene: quoteFor(text, markerGroups.claim),
    claim: quoteFor(text, markerGroups.claim),
    evidence: quoteFor(text, markerGroups.evidence),
    boundary: quoteFor(text, markerGroups.boundary),
    next: quoteFor(text, markerGroups.next)
  };
  const currentScene = scene || "本轮练习场景";
  const currentGoal = goal || "把重点说清楚";
  const currentFocus = focus || guidance.firstAction;
  const detailedSections = [
    {
      title: "场景判断",
      quote: quotes.scene,
      analysis: ensureLong(`这轮的场景是“${currentScene}”，目标是“${currentGoal}”。在这个场景里，${guidance.audience}不需要一段漂亮但泛泛的说明，而是需要快速知道你的判断与这件事的关系。原稿引用“${quotes.scene}”说明你已经给出了可以继续工作的真实表达材料；本地评估不会补造你没有说过的项目、数据或关系背景，只会检查这段原话是否足以让人接住重点。${indicatorSentence("主张", claimHits)} 从字数看，本轮共有 ${normalized.length} 个字、约 ${sentenceCount} 个完整句子，${fillers ? `并检测到 ${fillers} 个填充词。` : "没有检测到常见填充词。"} 下一轮先沿用当前原意，不必推翻全文；把“${currentFocus}”放在前两句完成，让对方在十秒内知道你要说明什么，再决定是否需要听更多背景。`, "复练时请把场景、判断和本轮目标连成一句完整的话；这能让后面的理由和行动有明确落点。")
    },
    {
      title: "主张与结构",
      quote: quotes.claim,
      analysis: ensureLong(`主张维度当前是 ${scores["主张"]}/20。${indicatorSentence("主张", claimHits)} 被引用的原话“${quotes.claim}”是听众最先会抓住的部分；如果这句话先讲结论，后面的内容就会被理解成理由、边界或行动，而不是零散的背景。结构上，本轮检测到“${structureHits.length ? structureHits.slice(0, 4).join("、") : "没有明显的顺序连接词"}”，这意味着${structureHits.length ? "你已经在使用部分连接关系，但还可以让顺序更稳定。" : "听众可能需要自己猜测先后关系。"} 对于${guidance.audience}来说，最实用的结构不是堆更多信息，而是用“我的判断是……，因为……，所以接下来……”把三层关系讲完整。下一轮请先把结论缩短到一句，再只补一个最相关的理由；如果仍有时间，最后补一句行动。这样练习的重点是让原稿的逻辑更容易被听见，而不是把语气变得不像你自己。`, "复练后检查第一句能否独立成立；若删掉后文，听众仍应知道你的立场或请求。")
    },
    {
      title: "证据与具体性",
      quote: quotes.evidence,
      analysis: ensureLong(`证据维度当前是 ${scores["证据"]}/20。${indicatorSentence("证据", evidenceHits)} 本轮引用“${quotes.evidence}”${evidenceHits.length ? "包含了可继续展开的具体线索。" : "目前主要承担了表达起点的作用，还没有形成可核验的支撑。"} 在“${currentScene}”里，具体不等于一定要报数字，也不等于临时编一个成功案例；更可靠的具体性来自你原稿已经提到的一个动作、一次观察、一个前后变化，或者一个明确限制。${/\d/u.test(text) ? "原稿中出现了数字，这是可检查的线索；下一轮要说明它代表什么。" : "原稿中没有数字也没有关系；你可以补一个真实的场景细节，而不是硬塞数据。"} 建议第二轮只选择一个证据，不要连续列举多个例子。先说发生了什么，再说你从中如何判断，最后回到当前的结论。这样听众能看见你的思路，也能区分事实、解释和建议，报告给出的评分才有可以回看的依据。`, "复练时问自己：这段内容中是否有一个别人能复述的真实细节；没有就补一个，不再扩写第二个。")
    },
    {
      title: "边界与听众关系",
      quote: quotes.boundary,
      analysis: ensureLong(`边界维度是 ${scores["边界"]}/20，关系维度是 ${scores["关系"]}/20。${indicatorSentence("边界", boundaryHits)} ${indicatorSentence("关系", relationHits)} 原稿中的“${quotes.boundary}”是本轮可以直接保留的证据，但它还需要让${guidance.audience}明白：你在支持什么、暂时不能承诺什么、以及为什么这个范围对对方也有意义。边界不是生硬地拒绝，也不是把责任推回别人；它应该把影响、选择和确认点说清楚。关系也不是客气词越多越好，而是先承认对方正在面对的问题，再给出你能承担的部分。尤其在分歧、临时加活或即兴回应时，先接住对方再说判断，能避免你的重点被听成对抗。下一轮请保留一句对对方处境的回应，同时补一句清楚的范围或条件；两句就够，不需要解释所有背景。`, "复练结束后检查：听众是否同时听见了你的合作意图和你的实际限制；只出现其中一个，表达仍容易被误解。")
    },
    {
      title: "下一轮行动",
      quote: quotes.next,
      analysis: ensureLong(`下一步维度当前是 ${scores["下一步"]}/20。${indicatorSentence("下一步", nextHits)} 这轮引用“${quotes.next}”说明你的原稿已经有一个可用于收束的位置；接下来要做的不是再加更多建议，而是让行动变得可以确认。对于“${currentScene}”，一个有效的结尾通常回答三个问题：谁需要做什么、什么时候确认、以及做完后如何知道事情往前走了。原稿${nextHits.length ? "已经出现了行动或时间相关信号，可以把它放到最后一句。" : "暂时没有明确行动信号，因此听众可能听完后仍不知道下一步。"} 第二轮请按固定顺序练习：第一句说判断；第二句补一个真实理由或细节；最后一句提出一个最小动作。你的本轮力量动作是“${currentFocus}”，请只检查这一件事是否做到，不要在同一轮同时追求更有感染力、更有逻辑和更少填充词。这样评分与复练才会形成真实的前后对照。`, "复练完成后用一句话自查：听众现在是否知道我希望发生什么；若不知道，只重写最后一句。")
    }
  ];
  const improvement = {
    "主张": "我的判断是先把重点说清楚，再补一个理由，最后确认下一步。",
    "证据": "我先说结论，再补一个原稿中真实出现的细节，说明我为什么这样判断。",
    "边界": "我可以先支持关键部分；完整接手会影响既有承诺，请一起确认优先级。",
    "关系": "我理解你现在的处境；我先说我的判断，再一起确认最可行的做法。",
    "下一步": "我的建议是先完成这一小步，请在今天确认负责人和完成时间。"
  };
  const score = Math.round(compass.reduce((sum, item) => sum + item.score, 0));
  return {
    score,
    trainingPoints: score,
    summary: `本地训练评估：围绕“${currentScene}”，优先补足“${priority.label}”。评分依据原稿结构与可检查信号，不调用 AI 模型。`,
    priority: { label: priority.label, quote: quotes[priority.label === "主张" ? "claim" : priority.label === "证据" ? "evidence" : priority.label === "边界" ? "boundary" : priority.label === "下一步" ? "next" : "scene"], impact: `在“${currentScene}”里，${guidance.audience}可能还无法据此理解你的${priority.label === "下一步" ? "行动安排" : priority.label}。`, action: improvement[priority.label] },
    compass,
    detailedSections,
    rewrite: { original: quotes[priority.label === "主张" ? "claim" : priority.label === "证据" ? "evidence" : priority.label === "边界" ? "boundary" : priority.label === "下一步" ? "next" : "scene"], improved: improvement[priority.label], reason: `先只练“${priority.label}”，让听众能从原稿中听见清楚的判断和可确认的下一步。` },
    source: "local",
    stats: { characters: normalized.length, fillerCount: fillers }
  };
}
