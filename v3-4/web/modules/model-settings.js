const storageKey = "speak-grow-v3-2-model-session";
const legacyStorageKey = "speak-grow-v3-1-model-session";
const publicProviders = ["auto", "qwen", "doubao", "deepseek"];

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

function readStoredValue() {
  for (const key of [storageKey, legacyStorageKey]) {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) continue;
    try { return JSON.parse(raw); } catch { continue; }
  }
  return null;
}

export function readModelConfiguration() {
  try {
    const stored = readStoredValue();
    if (stored?.apiKey && stored?.model && validBaseUrl(stored.baseUrl)) {
      return { mode: "byok", provider: stored.provider || "Custom", apiKey: stored.apiKey, model: stored.model, baseUrl: stored.baseUrl };
    }
    const provider = publicProviders.includes(stored?.provider) ? stored.provider : "auto";
    return { mode: "public", provider };
  } catch {
    return { mode: "public", provider: "auto" };
  }
}

export function normalizeConfiguration(input = {}, existing = readModelConfiguration()) {
  const provider = String(input.provider || existing?.provider || "Custom").trim();
  const apiKey = String(input.apiKey || "").trim();
  const model = String(input.model || "").trim();
  const baseUrl = String(input.baseUrl || "").trim().replace(/\/$/, "");
  if (!apiKey) {
    if (!publicProviders.includes(provider.toLowerCase())) throw new Error("invalid_model_configuration");
    return { mode: "public", provider: provider.toLowerCase() };
  }
  if (!model || !validBaseUrl(baseUrl)) throw new Error("invalid_model_configuration");
  return { mode: "byok", provider: provider || "Custom", apiKey, model, baseUrl };
}

export function saveModelConfiguration(configuration) {
  const normalized = configuration.mode === "public"
    ? { mode: "public", provider: configuration.provider }
    : normalizeConfiguration(configuration);
  window.sessionStorage.setItem(storageKey, JSON.stringify(normalized));
}

export async function fetchProviderStatus() {
  const response = await fetch("/api/providers", { headers: { Accept: "application/json" } });
  let data;
  try { data = await response.json(); } catch { throw new Error("provider_status_unavailable"); }
  if (!response.ok) throw new Error(data.error || "provider_status_unavailable");
  return data;
}

export async function testPublicConnection() {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("provider_status_unavailable");
    return await response.json();
  } catch (error) {
    throw new Error(error.message === "provider_status_unavailable" ? error.message : "provider_browser_unavailable");
  }
}

export async function testModelConnection(configuration) {
  if (!configuration?.apiKey) return testPublicConnection();
  try {
    const response = await fetch(configuration.baseUrl + "/models", {
      headers: { Authorization: "Bearer " + configuration.apiKey }
    });
    if (!response.ok) throw new Error("provider_connection_failed");
  } catch (error) {
    throw new Error(error.message === "provider_connection_failed" ? error.message : "provider_browser_unavailable");
  }
}
