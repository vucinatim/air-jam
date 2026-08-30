#!/usr/bin/env node

import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";

const platformRoot = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.resolve(
  platformRoot,
  ".next/standalone/apps/platform",
);
const runtimeEntries = [
  {
    inputFile: path.resolve(import.meta.dirname, "run-platform.mjs"),
    outputFile: path.resolve(outputDirectory, "run-platform.mjs"),
    externalPackages: [],
    copiedPackages: [],
    banner: null,
  },
  {
    inputFile: path.resolve(
      import.meta.dirname,
      "run-operational-job-worker.ts",
    ),
    outputFile: path.resolve(outputDirectory, "run-operational-job-worker.mjs"),
    // Playwright contains optional BiDi-over-CDP requires that esbuild cannot
    // resolve from the published dependency-free package. Keep the official
    // package intact beside the worker; all other worker dependencies remain
    // bundled and are checked below.
    externalPackages: ["playwright-core"],
    copiedPackages: ["playwright-core"],
    // Bundled AWS SDK packages contain CommonJS dynamic requires for Node
    // built-ins. Supply a real ESM-scoped require instead of relying on
    // esbuild's browser-oriented throwing shim.
    banner:
      'import { createRequire as __airJamCreateRequire } from "node:module"; const require = __airJamCreateRequire(import.meta.url);',
  },
];
const nodeBuiltinImports = new Set(
  builtinModules.flatMap((moduleName) => [
    moduleName,
    moduleName.startsWith("node:") ? moduleName : `node:${moduleName}`,
  ]),
);

await mkdir(outputDirectory, { recursive: true });

for (const {
  inputFile,
  outputFile,
  externalPackages,
  copiedPackages,
  banner,
} of runtimeEntries) {
  const result = await build({
    entryPoints: [inputFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "bundle",
    external: externalPackages,
    banner: banner ? { js: banner } : undefined,
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
      return (
        external &&
        !nodeBuiltinImports.has(importPath) &&
        !externalPackages.includes(importPath)
      );
    })
    .map(({ path: importPath }) => importPath);

  if (unexpectedExternalImports.length > 0) {
    throw new Error(
      `Platform runtime entry has unbundled package imports: ${unexpectedExternalImports.join(", ")}`,
    );
  }

  for (const packageName of copiedPackages) {
    const source = path.resolve(platformRoot, "node_modules", packageName);
    const destination = path.resolve(
      outputDirectory,
      "node_modules",
      packageName,
    );
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, {
      recursive: true,
      dereference: true,
      force: true,
    });
  }

  console.log(`[build-runtime-entry] Wrote ${outputFile}`);
}
