import { buildReportPrompt, parseModelReport } from "../web/modules/report-contract.js";

// 服务端和浏览器直连共用同一份教练契约，避免两条路线得到不同标准的报告。
export const buildPrompt = buildReportPrompt;
export function parseModelJson(content, input) {
  return parseModelReport(content, input);
}
