import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PackageJson } from "./types.js";

export const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const readJsonFile = async <T = unknown>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, "utf8")) as T;

export const readPackageJson = async (
  rootDir: string,
): Promise<{ path: string; value: PackageJson } | null> => {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  return {
    path: packageJsonPath,
    value: await readJsonFile<PackageJson>(packageJsonPath),
  };
};

export const findUp = async (
  startDir: string,
  fileName: string,
): Promise<string | null> => {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, fileName);
    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      return null;
    }
    currentDir = parent;
  }
};

export const listDirectories = async (rootDir: string): Promise<string[]> => {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir);
  const dirs = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry);
      const entryStat = await stat(entryPath).catch(() => null);
      return entryStat?.isDirectory() ? entryPath : null;
    }),
  );

  return dirs.filter((dir): dir is string => Boolean(dir));
};

export const firstExistingPath = async (
  candidates: string[],
): Promise<string | null> => {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const resolveCandidatePath = (
  rootDir: string,
  relativePaths: string[],
): Promise<string | null> =>
  firstExistingPath(
    relativePaths.map((relativePath) => path.join(rootDir, relativePath)),
  );
