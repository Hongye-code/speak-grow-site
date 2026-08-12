import { buildPrompt, parseModelJson } from "./server/report.mjs";
import { buildLocalReport } from "./web/modules/local-report.js";
import { findLadderScene, ladderLevels, randomLadderScene } from "./web/data/ladder-scenes.js";
import { scoreLadderTranscript } from "./web/modules/ladder-rubric.js";

const providerCatalog = [
  { id: "qwen", label: "通义千问", key: "QWEN_API_KEY", base: "QWEN_BASE_URL", model: "QWEN_MODEL", defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  { id: "doubao", label: "豆包", key: "DOUBAO_API_KEY", base: "DOUBAO_BASE_URL", model: "DOUBAO_MODEL", defaultBase: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "" },
  { id: "deepseek", label: "DeepSeek", key: "DEEPSEEK_API_KEY", base: "DEEPSEEK_BASE_URL", model: "DEEPSEEK_MODEL", defaultBase: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" }
];
const profileIds = ["improv", "smalltalk", "workplace", "interview", "story", "topic", "speech"];

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

function ladderError(code, status = 400) { return httpError(code, status); }
function ladderProfile(request) {
  const value = String(request.headers.get("X-Ladder-Profile") || "").trim();
  if (!/^[a-zA-Z0-9-]{12,128}$/.test(value)) throw ladderError("invalid_profile", 422);
  return value;
}
function ladderWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function randomToken() {
  const values = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}
function randomId() { return crypto.randomUUID(); }
async function hmac(env, value) {
  const secret = String(env.LADDER_HMAC_SECRET || "");
  if (!secret) throw ladderError("ladder_not_configured", 503);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (part) => part.toString(16).padStart(2, "0")).join("");
}
function configuredLadder(env) {
  if (!env.LADDER || !env.LADDER_HMAC_SECRET) throw ladderError("ladder_not_configured", 503);
}
async function ladderSchema(env) {
  await env.LADDER.batch([
    env.LADDER.prepare("CREATE TABLE IF NOT EXISTS ladder_challenges (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, profile_hash TEXT NOT NULL, level INTEGER NOT NULL, category TEXT NOT NULL, question_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER)"),
    env.LADDER.prepare("CREATE TABLE IF NOT EXISTS ladder_evidence (id TEXT PRIMARY KEY, profile_hash TEXT NOT NULL, nickname TEXT NOT NULL, level INTEGER NOT NULL, category TEXT NOT NULL, question_id TEXT NOT NULL, transcript_hash TEXT NOT NULL UNIQUE, score INTEGER NOT NULL, created_at INTEGER NOT NULL, week TEXT NOT NULL)"),
    env.LADDER.prepare("CREATE INDEX IF NOT EXISTS ladder_evidence_profile_idx ON ladder_evidence(profile_hash, level, category)"),
    env.LADDER.prepare("CREATE INDEX IF NOT EXISTS ladder_evidence_week_idx ON ladder_evidence(week, level, score)")
  ]);
}
async function ladderProgress(env, profileHash) {
  const rows = (await env.LADDER.prepare("SELECT level, category, score FROM ladder_evidence WHERE profile_hash = ? ORDER BY created_at ASC").bind(profileHash).all()).results || [];
  const progress = ladderLevels.map((level) => {
    const categories = new Set(rows.filter((row) => Number(row.level) === level.id && Number(row.score) >= level.threshold).map((row) => row.category));
    return { level: level.id, count: categories.size, complete: categories.size >= 5 };
  });
  const current = progress.find((item) => !item.complete)?.level || 7;
  return { current, progress };
}
async function createLadderChallenge(request, env, url) {
  configuredLadder(env); await ladderSchema(env);
  const level = Number(url.searchParams.get("level") || 1);
  if (!ladderLevels.some((item) => item.id === level)) throw ladderError("invalid_level", 422);
  const profileHash = await hmac(env, `profile:${ladderProfile(request)}`);
  const scene = randomLadderScene(level);
  const token = randomToken(); const id = randomId(); const now = Date.now();
  await env.LADDER.prepare("INSERT INTO ladder_challenges (id, token_hash, profile_hash, level, category, question_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, await hmac(env, `token:${token}`), profileHash, level, scene.category, scene.id, now + 900000).run();
  return { challengeId: id, token, level, category: scene.category, question: scene.question, profileId: scene.profileId, expiresInSeconds: 900 };
}
function nickname(value) {
  const name = String(value || "").trim();
  if (name.length < 2 || name.length > 16 || /[<>]/u.test(name)) throw ladderError("invalid_nickname", 422);
  return name;
}
async function verifyLadder(request, env) {
  configuredLadder(env); await ladderSchema(env);
  let body; try { body = await request.json(); } catch { throw ladderError("invalid_request", 400); }
  const profileHash = await hmac(env, `profile:${ladderProfile(request)}`);
  const challengeId = String(body.challengeId || ""); const token = String(body.token || "");
  const challenge = await env.LADDER.prepare("SELECT * FROM ladder_challenges WHERE id = ?").bind(challengeId).first();
  if (!challenge || challenge.profile_hash !== profileHash || challenge.used_at || Number(challenge.expires_at) < Date.now() || await hmac(env, `token:${token}`) !== challenge.token_hash) throw ladderError("invalid_challenge", 422);
  const transcript = String(body.transcript || "").trim(); const result = scoreLadderTranscript({ level: challenge.level, transcript });
  if (!result.valid) throw ladderError(result.error, 422);
  const transcriptHash = await hmac(env, `transcript:${transcript}`);
  const recent = await env.LADDER.prepare("SELECT id FROM ladder_evidence WHERE profile_hash = ? AND created_at > ? LIMIT 1").bind(profileHash, Date.now() - 55000).first();
  if (recent) throw ladderError("rate_limited", 429);
  const duplicate = await env.LADDER.prepare("SELECT id FROM ladder_evidence WHERE transcript_hash = ? OR (profile_hash = ? AND question_id = ?) LIMIT 1").bind(transcriptHash, profileHash, challenge.question_id).first();
  if (duplicate) throw ladderError("duplicate_submission", 409);
  await env.LADDER.prepare("UPDATE ladder_challenges SET used_at = ? WHERE id = ?").bind(Date.now(), challengeId).run();
  if (!result.qualified) return { qualified: false, score: result.score, threshold: result.threshold, dimensions: result.dimensions };
  const now = Date.now();
  await env.LADDER.prepare("INSERT INTO ladder_evidence (id, profile_hash, nickname, level, category, question_id, transcript_hash, score, created_at, week) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(randomId(), profileHash, nickname(body.nickname), challenge.level, challenge.category, challenge.question_id, transcriptHash, result.score, now, ladderWeek()).run();
  const progress = await ladderProgress(env, profileHash); const current = progress.progress.find((item) => item.level === Number(challenge.level));
  const entries = await ladderRanking(env);
  const rank = entries.findIndex((item) => item.profileHash === profileHash) + 1;
  const rankInsight = entries.length >= 20 && rank > 0
    ? { participants: entries.length, rank, exceededPercent: Math.floor(((entries.length - rank) / entries.length) * 100) }
    : { participants: entries.length, rank: null, exceededPercent: null };
  const promotion = progress.current > Number(challenge.level) ? `已完成第 ${challenge.level} 级，可进入第 ${progress.current} 级。` : `第 ${challenge.level} 级已累积 ${current?.count || 0}/5 个不同类别的合格证据。`;
  return { qualified: true, score: result.score, threshold: result.threshold, dimensions: result.dimensions, progress, progressText: promotion, rankInsight };
}
async function ladderRanking(env) {
  const rows = (await env.LADDER.prepare("SELECT profile_hash, nickname, level, category, score, created_at, week FROM ladder_evidence").all()).results || [];
  const weekly = rows.filter((row) => row.week === ladderWeek());
  const profiles = new Map();
  for (const row of rows) {
    const item = profiles.get(row.profile_hash) || { nickname: row.nickname, rows: [] }; item.rows.push(row); profiles.set(row.profile_hash, item);
  }
  return [...profiles.entries()].map(([profileHash, item]) => {
    const complete = ladderLevels.map((level) => new Set(item.rows.filter((row) => Number(row.level) === level.id && Number(row.score) >= level.threshold).map((row) => row.category)).size >= 5);
    const level = Math.max(1, complete.findIndex((done) => !done) + 1 || 7);
    const best = weekly.filter((row) => item.rows.includes(row) && Number(row.level) === level).sort((a, b) => Number(b.score) - Number(a.score) || Number(a.created_at) - Number(b.created_at)).slice(0, 5);
    return best.length ? { profileHash, nickname: item.nickname, level, score: best.reduce((sum, row) => sum + Number(row.score), 0), createdAt: Math.min(...best.map((row) => Number(row.created_at))) } : null;
  }).filter(Boolean).sort((a, b) => b.level - a.level || b.score - a.score || a.createdAt - b.createdAt);
}
async function ladderBoard(request, env) {
  configuredLadder(env); await ladderSchema(env);
  const entries = await ladderRanking(env);
  return { week: ladderWeek(), participants: entries.length, board: entries.slice(0, 50).map(({ profileHash, ...entry }) => entry), showPercentile: entries.length >= 20 };
}
async function deleteLadderProfile(request, env) {
  configuredLadder(env); await ladderSchema(env);
  const profileHash = await hmac(env, `profile:${ladderProfile(request)}`);
  await env.LADDER.batch([env.LADDER.prepare("DELETE FROM ladder_evidence WHERE profile_hash = ?").bind(profileHash), env.LADDER.prepare("DELETE FROM ladder_challenges WHERE profile_hash = ?").bind(profileHash)]);
  return { deleted: true };
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
      if (request.method === "GET" && url.pathname === "/api/ladder/challenge") return json(await createLadderChallenge(request, env, url));
      if (request.method === "POST" && url.pathname === "/api/ladder/verify") return json(await verifyLadder(request, env));
      if (request.method === "GET" && url.pathname === "/api/ladder/board") return json(await ladderBoard(request, env));
      if (request.method === "DELETE" && url.pathname === "/api/ladder/profile") return json(await deleteLadderProfile(request, env));
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
