import { buildReportPrompt, parseModelReport } from "../web/modules/report-contract.js";
import { reportFixtures } from "./report-fixtures.mjs";

const providers = [
  { id: "qwen", key: "QWEN_API_KEY", base: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1", model: process.env.QWEN_MODEL || "qwen-plus" },
  { id: "doubao", key: "DOUBAO_API_KEY", base: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3", model: process.env.DOUBAO_MODEL || "" },
  { id: "deepseek", key: "DEEPSEEK_API_KEY", base: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1", model: process.env.DEEPSEEK_MODEL || "deepseek-chat" }
];

for (const provider of providers) {
  const apiKey = String(process.env[provider.key] || "").trim();
  if (!apiKey || !provider.model) {
    console.log(`${provider.id}: skipped (not configured)`);
    continue;
  }
  let valid = 0;
  for (const fixture of reportFixtures) {
    try {
      const response = await fetch(`${provider.base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: provider.model, temperature: 0.35, max_tokens: 3600, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildReportPrompt(fixture) }] }) });
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      parseModelReport(Array.isArray(content) ? content.map((item) => item.text || "").join("") : content, fixture);
      valid += 1;
    } catch {}
  }
  console.log(`${provider.id}: ${valid}/${reportFixtures.length} valid complete reports`);
}
