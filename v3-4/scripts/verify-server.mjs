import { createAppServer } from "../server.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(base, path, options) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  return { response, body };
}

const transcript = "我建议先把这件事拆成一个小步，今天完成验证，再根据结果决定下一步。";
const payload = { provider: "deepseek", profileId: "workplace", focus: "先说你能支持什么。", transcript, scene: "向同事说明一个临时决定", goal: "先讲清下一步" };
let externalCalled = false;
const server = createAppServer({ env: { DEEPSEEK_API_KEY: "test-only-key", DAILY_REPORT_LIMIT: "5" }, fetchImpl: async () => { externalCalled = true; throw new Error("public model must not be called"); } });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const providers = await request(base, "/api/providers");
  assert(providers.response.status === 200, "服务商状态应返回 200");
  assert(!JSON.stringify(providers.body).includes("test-only-key"), "服务商状态不得泄露 Key");
  assert(!JSON.stringify(providers.body).includes("baseUrl"), "服务商状态不得泄露 Base URL");

  const invalid = await request(base, "/api/report", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "verify-short" }, body: JSON.stringify({ ...payload, transcript: "太短" }) });
  assert(invalid.response.status === 422 && invalid.body.error === "invalid_transcript", "短原稿必须返回 422");

  const first = await request(base, "/api/report", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "verify-valid" }, body: JSON.stringify(payload) });
  assert(first.response.status === 200 && first.body.source === "local" && Number.isInteger(first.body.report?.score) && first.body.report?.detailedSections?.length === 5, "有效报告必须返回本地完整训练报告");
  assert(!externalCalled, "即使存在服务端 Key，大众接口也不得调用外部模型");

  const empty = createAppServer({ env: { DAILY_REPORT_LIMIT: "5" } });
  await new Promise((resolve) => empty.listen(0, "127.0.0.1", resolve));
  const emptyResult = await request(`http://127.0.0.1:${empty.address().port}`, "/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  assert(emptyResult.response.status === 200 && emptyResult.body.source === "local" && Number.isInteger(emptyResult.body.report?.score) && emptyResult.body.report?.detailedSections?.length === 5, "未配置模型必须返回本地完整训练报告");
  await new Promise((resolve) => empty.close(resolve));

} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("server: validation, local-complete-report, no-public-model-call");
