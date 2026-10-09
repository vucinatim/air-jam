import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./paths.mjs";
import { runCommandCaptured } from "./shell.mjs";

export const verifyServerPackage = async (setDir) => {
  const root = path.resolve(setDir);
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "manifest.json"), "utf8"),
  );
  const artifacts = [];
  for (const packageName of ["@air-jam/sdk", "@air-jam/server"]) {
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
    path.join(os.tmpdir(), "airjam-server-package-"),
  );
  try {
    for (const [source, destination] of [
      ["server-package-consumer.mts", "consumer.mts"],
      ["server-package-runtime.mjs", "verify.mjs"],
    ]) {
      await fs.copyFile(
        path.join(repoRoot, "scripts/repo/fixtures", source),
        path.join(consumerRoot, destination),
      );
    }
    const run = (command, args) =>
      runCommandCaptured(command, args, { cwd: consumerRoot });
    await run("npm", ["init", "--yes"]);
    await run("npm", [
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      ...artifacts.map((artifact) => artifact.tarball),
      "socket.io-client@4.8.3",
      "typescript@5.9.3",
      "@types/node@24.10.1",
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
    ]);
    const runtime = await run(process.execPath, ["verify.mjs"]);
    return {
      contractVersion: 1,
      setId: manifest.setId,
      artifacts,
      checks: { typedConsumer: true, ...JSON.parse(runtime.stdout) },
    };
  } finally {
    await fs.rm(consumerRoot, { recursive: true, force: true });
  }
};
