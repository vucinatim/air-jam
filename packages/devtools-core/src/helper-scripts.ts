import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const resolveDevtoolsHelperScript = (fileName: string): string => {
  const builtHelperPath = path.resolve(
    moduleDir,
    "tooling",
    fileName.replace(/\.ts$/, ".js"),
  );
  if (existsSync(builtHelperPath)) {
    return builtHelperPath;
  }

  return path.resolve(moduleDir, "..", "src", "tooling", fileName);
};

export const resolveDevtoolsHelperArgs = (helperPath: string): string[] =>
  /\.(?:c|m)?tsx?$/u.test(helperPath)
    ? ["--import", require.resolve("tsx"), helperPath]
    : [helperPath];
