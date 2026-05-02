import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const readPackageName = (cwd: string): string | null => {
  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8"),
    ) as {
      name?: string;
    };
    return typeof packageJson.name === "string" ? packageJson.name : null;
  } catch {
    return null;
  }
};

const findWorkspaceRootFromCwd = (cwd: string): string | null => {
  let currentDir = cwd;

  while (true) {
    if (fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    const packageName = readPackageName(currentDir);
    if (packageName === "air-jam") {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
};

export const resolveAirJamLogProjectRoot = (options?: {
  cwd?: string;
  moduleUrl?: string;
}): string => {
  const cwd = options?.cwd ?? process.cwd();
  const cwdPackageName = readPackageName(cwd);

  if (cwdPackageName && cwdPackageName !== "@air-jam/server") {
    return cwd;
  }

  const workspaceRoot = findWorkspaceRootFromCwd(cwd);
  if (workspaceRoot) {
    return workspaceRoot;
  }

  const moduleUrl = options?.moduleUrl ?? import.meta.url;
  const thisFilePath = fileURLToPath(moduleUrl);
  const loggingDir = path.dirname(thisFilePath);
  return path.resolve(loggingDir, "../../../../");
};

export const AIR_JAM_WORKSPACE_ROOT = resolveAirJamLogProjectRoot();

export const resolveDefaultDevLogDir = (): string => {
  return path.join(AIR_JAM_WORKSPACE_ROOT, ".airjam", "logs");
};
