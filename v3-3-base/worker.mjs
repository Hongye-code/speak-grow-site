import { buildPrompt, parseModelJson } from "./server/report.mjs";
import { buildLocalReport } from "./web/modules/local-report.js";

const providerCatalog = [
  { id: "qwen", label: "通义千问", key: "QWEN_API_KEY", base: "QWEN_BASE_URL", model: "QWEN_MODEL", defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  { id: "doubao", label: "豆包", key: "DOUBAO_API_KEY", base: "DOUBAO_BASE_URL", model: "DOUBAO_MODEL", defaultBase: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "" },
  { id: "deepseek", label: "DeepSeek", key: "DEEPSEEK_API_KEY", base: "DEEPSEEK_BASE_URL", model: "DEEPSEEK_MODEL", defaultBase: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" }
];
const profileIds = ["interview", "workplace", "speech", "topic", "improv"];

function httpError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
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

function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
}

async function quotaKey(request, day) {
  const source = String(request.headers.get("CF-Connecting-IP") || "anonymous");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(day + ":" + source));
  return day + ":" + Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function quotaState(env, key, day, limit) {
  const current = await env.REPORT_QUOTA.get(key, "json");
  if (!current || current.day !== day) return { day, count: 0, remaining: limit };
  return { ...current, remaining: Math.max(0, limit - current.count) };
}

async function consumeQuota(env, key, day, limit) {
  const current = await quotaState(env, key, day, limit);
  if (current.count >= limit) throw httpError("quota_exhausted", 429);
  const next = { day, count: current.count + 1 };
  await env.REPORT_QUOTA.put(key, JSON.stringify(next), { expirationTtl: 172800 });
  return next;
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

function extractContent(result) {
  const content = result?.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((item) => item?.text || "").join("") : content;
}

async function requestProvider(config, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(config.baseUrl + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.modelName, temperature: 0.35, max_tokens: 3600, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildPrompt(payload) }] })
    });
    if (!response.ok) throw httpError("analysis_unavailable", 502);
    return parseModelJson(extractContent(await response.json()), payload);
  } catch (error) {
    if (error.code === "analysis_unavailable") throw error;
    if (error.message === "invalid_model_response" || error.message === "invalid_model_schema") throw httpError(error.message, 502);
    throw httpError("analysis_unavailable", 502);
  } finally {
    clearTimeout(timer);
  }
}

function headers(type = "application/json; charset=utf-8") {
  return { "Content-Type": type, "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; connect-src 'self' https:; style-src 'self'; script-src 'self'; img-src 'self' data:; media-src 'self' blob:;", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

async function serveAssets(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/v3-2" || url.pathname.startsWith("/v3-2/")) {
    url.pathname = url.pathname.slice("/v3-2".length) || "/";
    return env.ASSETS.fetch(new Request(url, request));
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const configs = providerConfigs(env);
      const limit = Math.max(1, Number.parseInt(env.DAILY_REPORT_LIMIT || "5", 10) || 5);
      const day = localDay();
      const key = await quotaKey(request, day);
      const quota = await quotaState(env, key, day, limit);
      if (request.method === "GET" && url.pathname === "/api/providers") {
        return json({ providers: configs.map((item) => ({ id: item.id, label: item.label, available: configured(item) })).concat({ id: "auto", label: "自动选择", available: configs.some(configured) }), dailyLimit: limit, remaining: quota.remaining });
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ status: "ok", available: configs.some(configured), configuredProviders: configs.filter(configured).map((item) => item.id), dailyLimit: limit });
      }
      if (request.method === "POST" && url.pathname === "/api/report") {
        let payload;
        try { payload = await request.json(); } catch { throw httpError("invalid_request", 400); }
        const provider = String(payload.provider || "auto").trim().toLowerCase();
        if (!["auto", ...providerCatalog.map((item) => item.id)].includes(provider)) throw httpError("invalid_provider", 400);
        const reportPayload = normalizeReportPayload(payload);
        // 大众接口固定使用本地完整训练评估，不消耗或调用任何平台模型。
        return json({ report: buildLocalReport(reportPayload), provider: "local", source: "local", remaining: quota.remaining });
      }
      if (request.method === "GET" || request.method === "HEAD") return serveAssets(request, env);
      return json({ error: "method_not_allowed" }, 405);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 502;
      if (status >= 500 && status !== 503) console.error("AI report failed:", error.code || "analysis_unavailable");
      return json({ error: error.code || "analysis_unavailable" }, status);
    }
  }
};
