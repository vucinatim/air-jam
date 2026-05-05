import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const EXCLUDED_ROOT_PREFIXES = [".airjam", ".git"];
const EXCLUDED_DIR_NAMES = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

const EXCLUDED_FILE_SUFFIXES = [".tsbuildinfo"];
const BIN_WARNING_PATTERN = /Failed to create bin at /;

const shouldCopyPath = (sourcePath) => {
  const relativePath = path.relative(repoRoot, sourcePath);
  if (!relativePath) {
    return true;
  }

  const segments = relativePath.split(path.sep);
  const firstSegment = segments[0];
  if (EXCLUDED_ROOT_PREFIXES.includes(firstSegment)) {
    return false;
  }

  if (segments.some((segment) => EXCLUDED_DIR_NAMES.has(segment))) {
    return false;
  }

  const basename = path.basename(sourcePath);
  return !EXCLUDED_FILE_SUFFIXES.some((suffix) => basename.endsWith(suffix));
};

const run = ({ args, cwd, label }) => {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
    encoding: "utf8",
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.trim()) {
    process.stdout.write(output);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }

  return output;
};

const main = async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "airjam-platform-deploy-"));
  const checkoutRoot = path.join(tempRoot, "repo");

  try {
    await cp(repoRoot, checkoutRoot, {
      recursive: true,
      filter: shouldCopyPath,
      force: true,
    });

    const installOutput = run({
      args: ["corepack", "pnpm", "install", "--frozen-lockfile"],
      cwd: checkoutRoot,
      label: "Hermetic platform install",
    });

    if (BIN_WARNING_PATTERN.test(installOutput)) {
      throw new Error(
        "Hermetic platform install emitted workspace bin warnings. Ensure workspace bin entrypoints exist before build.",
      );
    }

    run({
      args: ["corepack", "pnpm", "--filter", "platform", "build"],
      cwd: checkoutRoot,
      label: "Hermetic platform build",
    });

    process.stdout.write("✓ Hermetic platform deploy contract passed\n");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

await main();
