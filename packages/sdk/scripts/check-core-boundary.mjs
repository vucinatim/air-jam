// The core runs in browsers and in Node without drawing. It typechecks against
// web-worker globals (no window, document or storage) and may import only these
// packages; React, UI libraries and .tsx modules belong to the binding.
import { execFileSync } from "node:child_process";

const ALLOWED_PACKAGES = new Set([
  "typescript",
  "zod",
  "zustand",
  "nanoid",
  "socket.io-client",
  "engine.io-client",
  "engine.io-parser",
  "socket.io-parser",
  "@socket.io/component-emitter",
]);

const run = (args) =>
  execFileSync("npx", ["tsc", "-p", "tsconfig.core.json", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

run(["--noEmit"]);
const files = run(["--listFilesOnly"]).trim().split("\n");
const violations = files.filter((file) => {
  const match = file.match(
    /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/,
  );
  if (match) return !ALLOWED_PACKAGES.has(match[1]);
  return file.endsWith(".tsx");
});
if (violations.length > 0) {
  console.error("The SDK core imports modules outside its boundary:");
  for (const file of violations) console.error(`  ${file}`);
  process.exit(1);
}
console.log(`SDK core boundary holds across ${files.length} files.`);
