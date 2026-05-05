import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const runtimeDir = path.join(packageRoot, "runtime");
const sdkPackageJsonPath = path.resolve(packageRoot, "../sdk/package.json");

const sdkPackageJson = JSON.parse(fs.readFileSync(sdkPackageJsonPath, "utf8"));
const sdkExports = new Set(Object.keys(sdkPackageJson.exports ?? {}));

const extractSdkSubpathImports = (contents) => {
  const matches = contents.matchAll(/@air-jam\/sdk(?<subpath>\/[^"']+)?/g);
  const subpaths = new Set();

  for (const match of matches) {
    const subpath = match.groups?.subpath ?? "";
    subpaths.add(subpath === "" ? "." : `.${subpath}`);
  }

  return [...subpaths];
};

test("create-airjam runtime only imports exported SDK public subpaths", () => {
  const runtimeFiles = fs
    .readdirSync(runtimeDir)
    .filter((entry) => entry.endsWith(".mjs") || entry.endsWith(".mts"))
    .sort();

  const missingExports = [];

  for (const fileName of runtimeFiles) {
    const filePath = path.join(runtimeDir, fileName);
    const contents = fs.readFileSync(filePath, "utf8");

    for (const subpath of extractSdkSubpathImports(contents)) {
      if (!sdkExports.has(subpath)) {
        missingExports.push({ fileName, subpath });
      }
    }
  }

  assert.deepEqual(
    missingExports,
    [],
    `Missing SDK export(s): ${missingExports
      .map(({ fileName, subpath }) => `${fileName} -> ${subpath}`)
      .join(", ")}`,
  );
});
