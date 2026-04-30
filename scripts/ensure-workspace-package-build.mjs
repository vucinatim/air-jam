import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoots = ["packages", "apps", "games"];
const ignoredDirNames = new Set([
  ".airjam",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizePackageName = (packageName) =>
  packageName.replace(/[^a-zA-Z0-9._-]+/g, "_");

const readJsonFile = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const findWorkspacePackageDir = async (packageName) => {
  for (const workspaceRoot of workspaceRoots) {
    const rootDir = path.join(repoRoot, workspaceRoot);
    if (!existsSync(rootDir)) {
      continue;
    }

    const entries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageDir = path.join(rootDir, entry.name);
      const packageJsonPath = path.join(packageDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = await readJsonFile(packageJsonPath);
      if (packageJson.name === packageName) {
        return packageDir;
      }
    }
  }

  throw new Error(`Unable to resolve workspace package "${packageName}".`);
};

const collectLatestInputMtimeMs = async (rootDir) => {
  let latestMtimeMs = 0;

  const visit = async (currentDir) => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoredDirNames.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      const entryStat = await stat(absolutePath);
      latestMtimeMs = Math.max(latestMtimeMs, entryStat.mtimeMs);
    }
  };

  await visit(rootDir);
  return latestMtimeMs;
};

const hasDistOutput = async (packageDir) => {
  const distDir = path.join(packageDir, "dist");
  if (!existsSync(distDir)) {
    return false;
  }

  const entries = await readdir(distDir);
  return entries.length > 0;
};

const runPnpmBuild = (packageName) =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", packageName, "build"], {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Build for "${packageName}" terminated by signal ${signal}.`
            : `Build for "${packageName}" exited with code ${code}.`,
        ),
      );
    });

    child.on("error", reject);
  });

const acquireLock = async (lockDir) => {
  await mkdir(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      await mkdir(lockDir);
      return;
    } catch (error) {
      if (error && error.code === "EEXIST") {
        await sleep(120);
        continue;
      }

      throw error;
    }
  }
};

const releaseLock = async (lockDir) => {
  await rm(lockDir, { recursive: true, force: true });
};

const main = async () => {
  const packageName = process.argv[2]?.trim();
  if (!packageName) {
    throw new Error("Usage: node scripts/ensure-workspace-package-build.mjs <package-name>");
  }

  const packageDir = await findWorkspacePackageDir(packageName);
  const safeName = sanitizePackageName(packageName);
  const lockDir = path.join(
    repoRoot,
    ".airjam",
    "locks",
    "workspace-builds",
    `${safeName}.lock`,
  );
  const stampPath = path.join(
    repoRoot,
    ".airjam",
    "cache",
    "workspace-builds",
    `${safeName}.json`,
  );

  await acquireLock(lockDir);

  try {
    const latestInputMtimeMs = await collectLatestInputMtimeMs(packageDir);
    const distReady = await hasDistOutput(packageDir);
    const stamp = existsSync(stampPath)
      ? await readJsonFile(stampPath).catch(() => null)
      : null;

    if (
      distReady &&
      stamp &&
      typeof stamp.latestInputMtimeMs === "number" &&
      stamp.latestInputMtimeMs >= latestInputMtimeMs
    ) {
      return;
    }

    await runPnpmBuild(packageName);

    await mkdir(path.dirname(stampPath), { recursive: true });
    await writeFile(
      stampPath,
      `${JSON.stringify(
        {
          packageName,
          packageDir,
          latestInputMtimeMs,
          builtAtMs: Date.now(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } finally {
    await releaseLock(lockDir);
  }
};

await main();
