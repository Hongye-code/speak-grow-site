const compassLabels = ["主张", "证据", "边界", "关系", "下一步"];

function buildPrompt({ transcript, scene, goal }) {
  return `你是中文表达教练。只依据原稿，不虚构经历、数据或事实。\n\n场景：${scene}\n本轮目标：${goal}\n原稿：\n${transcript}\n\n只返回 JSON：{"score":0到100整数,"summary":"一句具体判断","compass":[{"label":"主张","score":0到20整数,"evidence":"引用原稿或写明缺口"},{"label":"证据","score":0到20整数,"evidence":"引用原稿或写明缺口"},{"label":"边界","score":0到20整数,"evidence":"引用原稿或写明缺口"},{"label":"关系","score":0到20整数,"evidence":"引用原稿或写明缺口"},{"label":"下一步","score":0到20整数,"evidence":"引用原稿或写明缺口"}],"rewrite":{"original":"原稿中最值得改的一句","improved":"保留原意的加强句","reason":"为什么它更能推进事情"}}`;
}

function parseModelJson(content) {
  const match = String(content).match(/\{[\s\S]*\}/);
  if (!match) throw new Error("invalid_model_response");
  let report;
  try { report = JSON.parse(match[0]); } catch { throw new Error("invalid_model_response"); }
  const validCompass = Array.isArray(report.compass) && report.compass.length === 5 && report.compass.every((item, index) =>
    item?.label === compassLabels[index] && Number.isInteger(item.score) && item.score >= 0 && item.score <= 20 && typeof item.evidence === "string"
  );
  if (!Number.isInteger(report.score) || report.score < 0 || report.score > 100 || typeof report.summary !== "string" || !validCompass || typeof report.rewrite?.improved !== "string" || typeof report.rewrite.reason !== "string") throw new Error("invalid_model_schema");
  return report;
}

async function requestBrowserReport(payload, configuration) {
  try {
    const response = await fetch(`${configuration.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: configuration.model, temperature: 0.35, response_format: { type: "json_object" }, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildPrompt(payload) }] })
    });
    if (!response.ok) throw new Error("provider_analysis_failed");
    const result = await response.json();
    const content = Array.isArray(result.choices?.[0]?.message?.content) ? result.choices[0].message.content.map((item) => item.text || "").join("") : result.choices?.[0]?.message?.content;
    return parseModelJson(content);
  } catch (error) {
    throw new Error(error.message === "provider_analysis_failed" || error.message.startsWith("invalid_model_") ? error.message : "provider_browser_unavailable");
  }
}

export async function requestReport(payload, configuration) {
  if (!configuration?.apiKey) throw new Error("model_not_configured");
  return requestBrowserReport(payload, configuration);
}

export function renderReport(report, elements) {
  elements.score.textContent = report.score;
  elements.summary.textContent = report.summary;
  elements.compass.replaceChildren(...report.compass.map((item) => {
    const card = document.createElement("div");
    card.title = item.evidence;
    const score = document.createElement("b");
    score.textContent = item.score;
    const label = document.createElement("span");
    label.textContent = item.label;
    card.append(score, label);
    return card;
  }));
  elements.rewrite.textContent = `“${report.rewrite.improved}”`;
  elements.reason.textContent = report.rewrite.reason;
}
