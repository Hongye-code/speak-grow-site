import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrompt, parseModelJson } from "./shared/report.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const webRoot = join(root, "web");
const port = Number(process.env.PORT || 4174);
const config = {
  apiKey: process.env.LLM_API_KEY || "",
  baseUrl: (process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, ""),
  model: process.env.LLM_MODEL || "deepseek-chat"
};
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function reply(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; media-src 'self';",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  response.end(Buffer.isBuffer(body) ? body : typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65536) throw new Error("request_too_large");
  }
  return JSON.parse(body || "{}");
}

async function analyze(payload) {
  if (!config.apiKey) return { error: "model_not_configured" };
  const transcript = String(payload.transcript || "").trim();
  const scene = String(payload.scene || "").trim().slice(0, 160);
  const goal = String(payload.goal || "").trim().slice(0, 80);
  if (transcript.length < 12 || transcript.length > 8000) return { error: "invalid_transcript" };
  const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, temperature: 0.35, response_format: { type: "json_object" }, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildPrompt({ transcript, scene, goal }) }] })
  });
  if (!upstream.ok) throw new Error(`upstream_${upstream.status}`);
  const result = await upstream.json();
  const content = Array.isArray(result.choices?.[0]?.message?.content) ? result.choices[0].message.content.map((item) => item.text || "").join("") : result.choices?.[0]?.message?.content;
  return { report: parseModelJson(String(content || "")) };
}

async function serveStatic(request, response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(relative);
  if (safePath.split(/[\\/]/).includes("..")) return reply(response, 404, "Not found", "text/plain; charset=utf-8");
  const filePath = pathname === "/speak.css" ? join(root, "..", "speak.css") : join(webRoot, safePath);
  try {
    const file = await readFile(filePath);
    reply(response, 200, file, mimeTypes[extname(filePath)] || "application/octet-stream");
  } catch { reply(response, 404, "Not found", "text/plain; charset=utf-8"); }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return reply(response, 200, { configured: Boolean(config.apiKey), model: config.apiKey ? config.model : null });
    if (request.method === "POST" && url.pathname === "/api/analyze") {
      const result = await analyze(await readBody(request));
      return reply(response, result.error ? 422 : 200, result);
    }
    if (request.method === "GET" || request.method === "HEAD") return serveStatic(request, response, url.pathname);
    return reply(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("Request failed:", error instanceof Error ? error.message : "unknown_error");
    return reply(response, 502, { error: "analysis_unavailable" });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`讲清楚正式安全版：http://127.0.0.1:${port}`));
