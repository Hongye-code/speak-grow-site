import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const parentRoot = fileURLToPath(new URL("../../v3-3-base/", import.meta.url));
const currentRoot = fileURLToPath(new URL("../", import.meta.url));
const protectedFiles = [
  "server.mjs", "server/report.mjs", "worker.mjs", "web/modules/recording.js", "web/modules/transcription.js",
  "web/modules/growth.js", "web/modules/model-settings.js", "web/modules/report-contract.js", "web/modules/report.js", "web/modules/training.js",
  "web/data/interview-scenes.js", "web/data/workplace-scenes.js", "web/data/speech-scenes.js", "web/data/topic-scenes.js", "web/data/improv-scenes.js"
];

function digest(value) { return createHash("sha256").update(value).digest("hex"); }

for (const relativePath of protectedFiles) {
  const [parent, current] = await Promise.all([readFile(new URL(relativePath, `file://${parentRoot}`)), readFile(new URL(relativePath, `file://${currentRoot}`))]);
  if (digest(parent) !== digest(current)) throw new Error(`受保护文件发生未授权变更：${relativePath}`);
}

console.log(`inheritance: ${protectedFiles.length} protected base files unchanged; additions are isolated to the current V3-3 routes and modules`);
