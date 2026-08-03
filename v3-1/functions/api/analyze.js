import { buildPrompt, parseModelJson } from "../../shared/report.mjs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  if (!env.LLM_API_KEY) return json({ error: "model_not_configured" }, 422);
  const raw = await request.text();
  if (raw.length > 65536) return json({ error: "request_too_large" }, 413);
  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_request" }, 400); }
  const transcript = String(payload.transcript || "").trim();
  const scene = String(payload.scene || "").trim().slice(0, 160);
  const goal = String(payload.goal || "").trim().slice(0, 80);
  if (transcript.length < 12 || transcript.length > 8000) return json({ error: "invalid_transcript" }, 422);
  try {
    const baseUrl = (env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.LLM_MODEL || "deepseek-chat", temperature: 0.35, response_format: { type: "json_object" }, messages: [{ role: "system", content: "你是严谨的表达教练，只输出合法 JSON。" }, { role: "user", content: buildPrompt({ transcript, scene, goal }) }] })
    });
    if (!upstream.ok) throw new Error(`upstream_${upstream.status}`);
    const result = await upstream.json();
    const content = Array.isArray(result.choices?.[0]?.message?.content) ? result.choices[0].message.content.map((item) => item.text || "").join("") : result.choices?.[0]?.message?.content;
    return json({ report: parseModelJson(content) });
  } catch {
    return json({ error: "analysis_unavailable" }, 502);
  }
}
