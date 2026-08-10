import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const parentRoot = fileURLToPath(new URL("../../v3-3/", import.meta.url));
const currentRoot = fileURLToPath(new URL("../", import.meta.url));
const protectedFiles = [
  "server/report.mjs", "web/modules/transcription.js",
  "web/modules/growth.js", "web/modules/model-settings.js", "web/modules/report.js", "web/modules/training.js",
  "web/data/interview-scenes.js", "web/data/workplace-scenes.js", "web/data/speech-scenes.js", "web/data/topic-scenes.js", "web/data/improv-scenes.js"
];

function digest(value) { return createHash("sha256").update(value).digest("hex"); }

for (const relativePath of protectedFiles) {
  const [parent, current] = await Promise.all([readFile(new URL(relativePath, `file://${parentRoot}`)), readFile(new URL(relativePath, `file://${currentRoot}`))]);
  if (digest(parent) !== digest(current)) throw new Error(`受保护文件发生未授权变更：${relativePath}`);
}

console.log(`inheritance: ${protectedFiles.length} protected V3-3 files unchanged; V3-4 adds the pyramid, story profile and VAD without removing prior training`);
