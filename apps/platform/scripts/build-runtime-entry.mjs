#!/usr/bin/env node

import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";

const platformRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.resolve(
  platformRoot,
  ".next/standalone/apps/platform",
);
const outputFile = path.resolve(outputDirectory, "run-platform.mjs");
const nodeBuiltinImports = new Set(
  builtinModules.flatMap((moduleName) => [
    moduleName,
    moduleName.startsWith("node:") ? moduleName : `node:${moduleName}`,
  ]),
);

await mkdir(outputDirectory, { recursive: true });

const result = await build({
  entryPoints: [path.resolve(import.meta.dirname, "run-platform.mjs")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "bundle",
  absWorkingDir: platformRoot,
  metafile: true,
  logLevel: "info",
});

const outputMetadata = Object.entries(result.metafile.outputs).find(
  ([metadataPath]) => path.resolve(platformRoot, metadataPath) === outputFile,
)?.[1];
if (!outputMetadata) {
  throw new Error(`Missing esbuild metadata for "${outputFile}".`);
}

const unexpectedExternalImports = outputMetadata.imports
  .filter(({ external, path: importPath }) => {
    return external && !nodeBuiltinImports.has(importPath);
  })
  .map(({ path: importPath }) => importPath);

if (unexpectedExternalImports.length > 0) {
  throw new Error(
    `Platform runtime entry has unbundled package imports: ${unexpectedExternalImports.join(", ")}`,
  );
}

console.log(`[build-runtime-entry] Wrote ${outputFile}`);
