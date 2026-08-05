const storageKey = "speak-grow-v3-1-model-session";

const providerDefaults = {
  DeepSeek: { model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
  OpenAI: { model: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" },
  Custom: { model: "", baseUrl: "" }
};

function validBaseUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function defaultsFor(provider) {
  return providerDefaults[provider] || providerDefaults.Custom;
}

export function normalizeConfiguration(input, existing = readModelConfiguration()) {
  const apiKey = String(input.apiKey || existing?.apiKey || "").trim();
  const model = String(input.model || "").trim();
  const baseUrl = String(input.baseUrl || "").trim().replace(/\/$/, "");
  if (!apiKey || !model || !validBaseUrl(baseUrl)) throw new Error("invalid_model_configuration");
  return { provider: input.provider || "Custom", apiKey, model, baseUrl };
}

export function readModelConfiguration() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    return value?.apiKey && value?.model && validBaseUrl(value.baseUrl) ? value : null;
  } catch {
    return null;
  }
}

export function saveModelConfiguration(configuration) {
  window.sessionStorage.setItem(storageKey, JSON.stringify(configuration));
}

export async function testModelConnection(configuration) {
  try {
    const response = await fetch(`${configuration.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${configuration.apiKey}` }
    });
    if (!response.ok) throw new Error("provider_connection_failed");
  } catch (error) {
    throw new Error(error.message === "provider_connection_failed" ? error.message : "provider_browser_unavailable");
  }
}
