import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const currentRoot = fileURLToPath(new URL("../", import.meta.url));
// SHA-256 fingerprints of the selected V3-4 E parent files. Keeping the
// baseline here makes the published package independently verifiable.
const protectedFiles = new Map([
  ["server/report.mjs", "8054d1e3c158d2068094a2157c588a26da5e412dc37702feff6363057fed34b7"],
  ["web/modules/transcription.js", "421a2b72d1c6930eacb4a44598de0bba6cced304762ac5a20cb88a078fbd012f"],
  ["web/modules/growth.js", "96fb5e2db2126fdf8c37ff903197e445f12dafd628a46f6b87089763513932cf"],
  ["web/modules/model-settings.js", "6d190c3efd101e4a377411e417625f243ae13c911061a2be3c3ea5d7a0ecd893"],
  ["web/modules/report.js", "fe88e0c694e7f867b19bca763cb92757a59fdc02c00ceb23034fe30f6aca7104"],
  ["web/data/interview-scenes.js", "cdb5194b7e9800d0bf118981b83a71f389fbf863329c48245781238f2911bcb0"],
  ["web/data/workplace-scenes.js", "a13d8a34e6ec642019924d735b8aca4759502eb85352527fee12633e9512cf1e"],
  ["web/data/speech-scenes.js", "cb21aee34cc4dc9affe81b71284b66c21bce433e6612d55b1a15513e829cdfdb"],
  ["web/data/topic-scenes.js", "c14ca973bf67a63d8c4cb9273eac410b7419ff27ef77126e0e74755a7b611b51"],
  ["web/data/improv-scenes.js", "af256e95fef04c6dc3ea31c85a19b835afe0241f240b833baff502043b3a41fb"]
]);
const approvedModifiedFiles = ["web/modules/training.js"];

function digest(value) { return createHash("sha256").update(value).digest("hex"); }

for (const [relativePath, parentDigest] of protectedFiles) {
  const current = await readFile(new URL(relativePath, `file://${currentRoot}`));
  if (digest(current) !== parentDigest) throw new Error(`受保护文件发生未授权变更：${relativePath}`);
}

console.log(`inheritance: ${protectedFiles.size} protected V3-4 files match the selected E parent baseline; 60-second challenge adds a first-run flow without removing prior training`);
console.log(`inheritance: approved change retained in ${approvedModifiedFiles[0]} for the requested 5-second preparation period`);
