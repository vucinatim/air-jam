import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./paths.mjs";
import { runCommandCaptured } from "./shell.mjs";

export const verifyFoundationLibraryPackages = async (setDir) => {
  const root = path.resolve(setDir);
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "manifest.json"), "utf8"),
  );
  const artifacts = [];
  for (const packageName of [
    "@air-jam/sdk",
    "@air-jam/env",
    "@air-jam/harness",
    "@air-jam/devtools-core",
    "@air-jam/mcp-server",
    "@air-jam/cli",
  ]) {
    const filename = manifest.packages?.[packageName];
    if (typeof filename !== "string" || path.basename(filename) !== filename) {
      throw new Error(`Candidate set requires a tarball for ${packageName}`);
    }
    const tarball = path.join(root, filename);
    artifacts.push({
      packageName,
      tarball,
      sha256: createHash("sha256")
        .update(await fs.readFile(tarball))
        .digest("hex"),
    });
  }
  const consumerRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "airjam-foundation-libraries-"),
  );
  try {
    await fs.mkdir(path.join(consumerRoot, "src"));
    for (const [source, destination] of [
      ["foundation-library-consumer.mts", "consumer.mts"],
      ["foundation-library-config.ts", "src/airjam.config.ts"],
      ["foundation-library-scenarios.ts", "src/visual-scenarios.ts"],
    ]) {
      await fs.copyFile(
        path.join(repoRoot, "scripts/repo/fixtures", source),
        path.join(consumerRoot, destination),
      );
    }
    const run = (command, args) =>
      runCommandCaptured(command, args, { cwd: consumerRoot });
    await run("npm", ["init", "--yes"]);
    await run("npm", ["pkg", "set", "type=module"]);
    await run("npm", [
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      ...artifacts.map((artifact) => artifact.tarball),
      "typescript@5.9.3",
      "@types/node@24.10.1",
      "@types/react@19.2.5",
    ]);
    await run("npx", [
      "--no-install",
      "tsc",
      "--noEmit",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "--strict",
      "consumer.mts",
      "src/airjam.config.ts",
      "src/visual-scenarios.ts",
    ]);
    const result = await run(process.execPath, [
      "--import",
      "tsx",
      "consumer.mts",
    ]);
    return {
      contractVersion: 1,
      setId: manifest.setId,
      artifacts,
      checks: { typedConsumer: true, ...JSON.parse(result.stdout) },
    };
  } finally {
    await fs.rm(consumerRoot, { recursive: true, force: true });
  }
};
