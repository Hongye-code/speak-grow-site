export async function requestReport(payload) {
  const response = await fetch("./api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || "analysis_unavailable");
  return result.report;
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
