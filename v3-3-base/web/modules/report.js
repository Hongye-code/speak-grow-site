import { buildLocalReport } from "./local-report.js";
import { buildReportPrompt, parseModelReport } from "./report-contract.js";

async function requestBrowserReport(payload, configuration) {
  try {
    const response = await fetch(configuration.baseUrl + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + configuration.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model: configuration.model, temperature: 0.35, max_tokens: 3600, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildReportPrompt(payload) }] }) });
    if (!response.ok) throw new Error("provider_analysis_failed");
    const result = await response.json();
    const content = Array.isArray(result.choices?.[0]?.message?.content) ? result.choices[0].message.content.map((item) => item.text || "").join("") : result.choices?.[0]?.message?.content;
    return parseModelReport(content, payload);
  } catch (error) {
    throw new Error(error.message === "provider_analysis_failed" || error.message.startsWith("invalid_model_") ? error.message : "provider_browser_unavailable");
  }
}

function markReport(report, source = "model") {
  return { ...report, source, trainingPoints: source === "local" ? 0 : Number.isInteger(report.trainingPoints) ? report.trainingPoints : report.score };
}

async function requestPublicReport(payload, configuration) {
  let response;
  try {
    response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...payload, provider: configuration?.provider || "auto" })
    });
  } catch {
    throw new Error("analysis_unavailable");
  }
  let result;
  try { result = await response.json(); } catch { throw new Error("analysis_unavailable"); }
  if (!response.ok) {
    const error = new Error(result.error || "analysis_unavailable");
    error.remaining = result.remaining;
    throw error;
  }
  if (!result.report) throw new Error("invalid_model_schema");
  return markReport(result.report, result.source || "model");
}

export async function requestReport(payload, configuration) {
  if (configuration?.mode !== "byok" || !configuration.apiKey) return buildLocalReport(payload);
  try {
    const report = await requestBrowserReport(payload, configuration);
    return markReport(report, report.source || "model");
  } catch (error) {
    if (error.message === "invalid_transcript") throw error;
    return buildLocalReport(payload);
  }
}

export function renderReport(report, elements) {
  const local = report.source === "local";
  elements.scorePanel.hidden = false;
  elements.score.textContent = report.score ?? "--";
  elements.summary.textContent = report.summary;
  if (elements.source) elements.source.textContent = local ? "本地完整训练评估 · 不调用 AI 或外部 API" : report.source === "mock" ? "本地测试报告" : report.deepCoach ? "用户自带 API · 完整报告 + 专属深度教练" : "模型辅助 · 完整训练报告";
  if (elements.fillers) elements.fillers.textContent = report.stats?.fillerCount ?? "暂未统计";
  elements.priorityHeading.textContent = "这次先改一处";
  elements.priorityLabel.textContent = report.priority.label;
  elements.priorityQuote.textContent = `“${report.priority.quote}”`;
  elements.priorityImpact.textContent = report.priority.impact;
  elements.priorityAction.textContent = report.priority.action;
  elements.compass.replaceChildren(...report.compass.map((item) => {
    const card = document.createElement("div");
    card.title = item.evidence;
    const score = document.createElement("b");
    score.textContent = item.score ?? "—";
    const label = document.createElement("span");
    label.textContent = item.label;
    card.append(score, label);
    return card;
  }));
  elements.rewrite.textContent = `“${report.rewrite.improved}”`;
  elements.reason.textContent = report.rewrite.reason;
  elements.details.replaceChildren(...(report.detailedSections || []).map((section) => {
    const article = document.createElement("article");
    article.className = "analysis-section";
    const title = document.createElement("h3");
    title.textContent = section.title;
    const quote = document.createElement("blockquote");
    quote.textContent = `原稿证据：“${section.quote}”`;
    const analysis = document.createElement("p");
    analysis.textContent = section.analysis;
    article.append(title, quote, analysis);
    return article;
  }));
  elements.details.hidden = true;
  elements.detailsToggle.hidden = false;
  elements.detailsToggle.setAttribute("aria-expanded", "false");
  elements.detailsToggle.textContent = "展开完整五维分析";
  elements.deepCoach.hidden = !report.deepCoach;
  if (report.deepCoach) {
    elements.deepCoachQuote.textContent = `原稿证据：“${report.deepCoach.quote}”`;
    elements.deepCoachAnalysis.textContent = report.deepCoach.analysis;
    elements.deepCoachSecondRound.textContent = report.deepCoach.secondRound;
    elements.deepCoachChecklist.replaceChildren(...report.deepCoach.checklist.map((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      return listItem;
    }));
  }
}
