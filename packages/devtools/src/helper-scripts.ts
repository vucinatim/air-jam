import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

  const sourceHelperPath = path.resolve(
    moduleDir,
    "..",
    "src",
    "tooling",
    fileName,
  );
  if (existsSync(sourceHelperPath)) {
    return sourceHelperPath;
  }

  throw new Error(
    `Air Jam helper script is missing from this installation: ${fileName}`,
  );
};

const typescriptExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const projectTypescriptLoaderHelpers = new Set([
  "describe-game",
  "list-visual-scenarios",
  "run-visual-capture",
  "run-test-profile",
  "run-headless-room",
]);

export const resolveDevtoolsHelperArgs = (helperPath: string): string[] =>
  typescriptExtensions.has(path.extname(helperPath)) ||
  projectTypescriptLoaderHelpers.has(
    path.basename(helperPath, path.extname(helperPath)),
  )
    ? [
        "--import",
        pathToFileURL(createRequire(helperPath).resolve("tsx")).href,
        helperPath,
      ]
    : [helperPath];

export function resolveProjectDevtoolsHelperScript(
  projectDir: string,
  fileName: string,
) {
  const projectRequire = createRequire(path.join(projectDir, "package.json"));
  const manifest = projectRequire.resolve("@air-jam/devtools/package.json");
  const helper = path.join(
    path.dirname(manifest),
    "dist/tooling",
    fileName.replace(/\.ts$/, ".js"),
  );
  if (!existsSync(helper))
    throw new Error(
      `The pinned dependency graph is missing its runtime helper: ${fileName}`,
    );
  return helper;
}
