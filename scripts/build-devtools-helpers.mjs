import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputFlagIndex = process.argv.indexOf("--out-dir");
const outputDirectory = process.argv[outputFlagIndex + 1];

if (outputFlagIndex === -1 || !outputDirectory) {
  throw new Error("Usage: build-devtools-helpers.mjs --out-dir <directory>");
}

const packageRequire = createRequire(path.join(process.cwd(), "package.json"));
const { build } = await import(
  pathToFileURL(packageRequire.resolve("tsup")).href
);

const toolingRoot = path.join(
  repoRoot,
  "packages",
  "devtools-core",
  "src",
  "tooling",
);
const entries = Object.fromEntries(
  [
    "agent-contract",
    "hold-runtime-host",
    "inspect-airjam-agent",
    "list-visual-scenarios",
    "run-visual-capture",
  ].map((name) => [name, path.join(toolingRoot, `${name}.ts`)]),
);

await build({
  entry: entries,
  outDir: path.resolve(process.cwd(), outputDirectory),
  format: ["esm"],
  dts: false,
  clean: false,
  shims: true,
  sourcemap: true,
  platform: "node",
  target: "es2022",
  external: ["cross-spawn", "playwright-core"],
  noExternal: [
    "@air-jam/devtools-core",
    "@air-jam/harness",
    "@air-jam/sdk",
    "@air-jam/env",
  ],
});

for (const name of Object.keys(entries)) {
  const outputPath = path.resolve(process.cwd(), outputDirectory, `${name}.js`);
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Devtools helper build did not produce ${outputPath}.`);
  }
}
