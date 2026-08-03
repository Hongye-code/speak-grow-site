function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export function onRequestGet({ env }) {
  return json({ configured: Boolean(env.LLM_API_KEY), model: env.LLM_API_KEY ? (env.LLM_MODEL || "deepseek-chat") : null });
}
