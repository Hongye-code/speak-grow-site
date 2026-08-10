import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildPrompt, parseModelJson } from "./server/report.mjs";
import { buildLocalReport } from "./web/modules/local-report.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const webRoot = join(root, "web");
const providerCatalog = [
  { id: "qwen", label: "通义千问", key: "QWEN_API_KEY", base: "QWEN_BASE_URL", model: "QWEN_MODEL", defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  { id: "doubao", label: "豆包", key: "DOUBAO_API_KEY", base: "DOUBAO_BASE_URL", model: "DOUBAO_MODEL", defaultBase: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "" },
  { id: "deepseek", label: "DeepSeek", key: "DEEPSEEK_API_KEY", base: "DEEPSEEK_BASE_URL", model: "DEEPSEEK_MODEL", defaultBase: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" }
];
const profileIds = ["interview", "workplace", "speech", "topic", "improv"];
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function httpError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function positiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function providerConfigs(env) {
  return providerCatalog.map((item) => ({
    ...item,
    apiKey: String(env[item.key] || "").trim(),
    baseUrl: String(env[item.base] || item.defaultBase).trim().replace(/\/$/, ""),
    modelName: String(env[item.model] || item.defaultModel).trim()
  }));
}

function configured(config) {
  return Boolean(config.apiKey && config.modelName && config.baseUrl);
}

function localDay(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now());
}

function clientKey(request, day, trustProxy) {
  const forwarded = trustProxy ? String(request.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
  const source = forwarded || request.socket?.remoteAddress || "anonymous";
  return createHash("sha256").update(`${day}:${source}`).digest("hex");
}

function quotaFor(quota, key, day, limit) {
  const current = quota.get(key);
  if (!current || current.day !== day) {
    const next = { day, count: 0 };
    quota.set(key, next);
    return next;
  }
  if (current.count >= limit) throw httpError("quota_exhausted", 429);
  return current;
}

function remaining(quota, key, day, limit) {
  const current = quota.get(key);
  return Math.max(0, limit - (current?.day === day ? current.count : 0));
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw httpError("request_too_large", 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw httpError("invalid_request", 400); }
}

function extractContent(result) {
  const content = result?.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((item) => item?.text || "").join("") : content;
}

function mockAnalysis(title, quote) {
  return `${title}需要结合当前场景判断，而不是只看有没有某个关键词。原稿中的“${quote}”说明你已经开始表达自己的想法，但听众仍需要知道这句话与当前问题、训练目标和下一步之间的关系。下一轮请先保留这层真实意思，再按顺序补齐能帮助对方理解的信息：先让对方知道你的判断是什么，再说你依据了什么，最后明确希望谁做什么。这样不会把原稿改成不属于你的漂亮话，也能避免为了得分硬塞经历、数据或承诺。你可以把这段话当作一次复练检查：说完后问自己，陌生听众是否能复述重点、知道限制条件，并据此做出一个具体动作。`.repeat(2);
}

function mockReport({ transcript }) {
  const original = transcript.replace(/[。！？；，,]$/u, "").slice(0, 28);
  return {
    score: 76,
    summary: "你已经说出了主要判断，下一步可以把理由和行动说得更紧凑。",
    priority: { label: "下一步", quote: original, impact: "听众还无法据此立刻确认后续安排。", action: "补一句明确的负责人和下一步。" },
    compass: ["主张", "证据", "边界", "关系", "下一步"].map((label, index) => ({ label, score: 15 - index, evidence: index === 0 ? transcript.slice(0, 24) : "建议下一轮补充一个具体细节" })),
    detailedSections: ["场景判断", "主张与结构", "证据与具体性", "边界与听众关系", "下一轮行动"].map((title) => ({ title, quote: original, analysis: mockAnalysis(title, original) })),
    rewrite: { original, improved: `${original.slice(0, 22)}，所以我建议先做一个小步验证。`, reason: "把判断、理由和下一步连在一起，听众更容易接住。" }
  };
}

async function requestProvider(config, payload, fetchImpl, env) {
  if (env.MODEL_MOCK === "1") return mockReport(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.modelName, temperature: 0.35, max_tokens: 3600, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildPrompt(payload) }] })
    });
    if (!response.ok) throw httpError("analysis_unavailable", 502);
    const result = await response.json();
    return parseModelJson(extractContent(result), payload);
  } catch (error) {
    if (error.code === "analysis_unavailable") throw error;
    if (error.message === "invalid_model_response" || error.message === "invalid_model_schema") throw httpError(error.message, 502);
    throw httpError("analysis_unavailable", 502);
  } finally {
    clearTimeout(timer);
  }
}

function chooseProvider(requested, configs, primaryProvider = "") {
  const available = configs.filter(configured);
  if (requested === "auto") return available.find((item) => item.id === primaryProvider) || available[0] || null;
  const selected = configs.find((item) => item.id === requested);
  return selected && configured(selected) ? selected : null;
}

function normalizeReportPayload(input) {
  const transcript = String(input.transcript || "").trim();
  const scene = String(input.scene || "").trim();
  const goal = String(input.goal || "").trim();
  const focus = String(input.focus || "").trim();
  const profileId = String(input.profileId || "workplace").trim();
  if (transcript.length < 12 || transcript.length > 8000 || !scene || scene.length > 160 || !goal || goal.length > 80 || focus.length > 120 || !profileIds.includes(profileId)) throw httpError("invalid_transcript", 422);
  return { transcript, scene, goal, focus, profileId, detailLevel: "standard" };
}

function publicProviders(configs, quota, key, day, limit) {
  return configs.map((item) => ({ id: item.id, label: item.label, available: configured(item) })).concat({ id: "auto", label: "自动选择", available: configs.some(configured), remaining: remaining(quota, key, day, limit) });
}

function headers(type = "application/json; charset=utf-8") {
  return { "Content-Type": type, "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; connect-src 'self' https:; style-src 'self'; script-src 'self'; img-src 'self' data:; media-src 'self' blob:;", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
}

function reply(response, status, body, type) {
  response.writeHead(status, headers(type));
  response.end(Buffer.isBuffer(body) ? body : typeof body === "string" ? body : JSON.stringify(body));
}

async function serveStatic(request, response, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const safePath = normalize(relative);
  if (safePath.split(/[\\/]/).includes("..")) return reply(response, 404, "Not found", "text/plain; charset=utf-8");
  try {
    const file = await readFile(join(webRoot, safePath));
    if (request.method === "HEAD") return reply(response, 200, "", mimeTypes[extname(safePath)] || "application/octet-stream");
    return reply(response, 200, file, mimeTypes[extname(safePath)] || "application/octet-stream");
  } catch { return reply(response, 404, "Not found", "text/plain; charset=utf-8"); }
}

export function createAppServer({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const configs = providerConfigs(env);
  const quota = new Map();
  const limit = positiveInt(env.DAILY_REPORT_LIMIT, 5);
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const day = localDay(now);
    const key = clientKey(request, day, env.TRUST_PROXY === "1");
    try {
      if (request.method === "GET" && url.pathname === "/api/providers") return reply(response, 200, { providers: publicProviders(configs, quota, key, day, limit), dailyLimit: limit, remaining: remaining(quota, key, day, limit) });
      if (request.method === "GET" && url.pathname === "/api/health") return reply(response, 200, { status: "ok", available: configs.some(configured), configuredProviders: configs.filter(configured).map((item) => item.id), dailyLimit: limit });
      if (request.method === "POST" && url.pathname === "/api/report") {
        const input = await readBody(request);
        const provider = String(input.provider || "auto").trim().toLowerCase();
        if (!["auto", ...providerCatalog.map((item) => item.id)].includes(provider)) throw httpError("invalid_provider", 400);
        const payload = normalizeReportPayload(input);
        // 大众接口固定使用本地完整训练评估，不消耗或调用任何平台模型。
        return reply(response, 200, { report: buildLocalReport(payload), provider: "local", source: "local", remaining: remaining(quota, key, day, limit) });
      }
      if (request.method === "GET" || request.method === "HEAD") return serveStatic(request, response, url.pathname);
      return reply(response, 405, { error: "method_not_allowed" });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 502;
      if (status >= 500 && status !== 503) console.error("AI report failed:", error.code || "analysis_unavailable");
      return reply(response, status, { error: error.code || "analysis_unavailable" });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4184);
  const server = createAppServer();
  server.listen(port, "127.0.0.1", () => console.log(`讲清楚大众版：http://127.0.0.1:${server.address().port}`));
}
