import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_PACKAGE_ROOT = resolve(MODULE_DIR, "..", "..");
const WORKSPACE_ROOT = resolve(SERVER_PACKAGE_ROOT, "..", "..");

export interface WorkspaceEnvCandidates {
  rootEnvLocal: string;
  serverEnv: string;
}

export interface LoadWorkspaceEnvOptions {
  processEnv?: Record<string, string | undefined>;
  candidates?: WorkspaceEnvCandidates;
}

const DEFAULT_ENV_CANDIDATES: WorkspaceEnvCandidates = {
  rootEnvLocal: resolve(WORKSPACE_ROOT, ".env.local"),
  serverEnv: resolve(SERVER_PACKAGE_ROOT, ".env"),
};

const loadedEnvCandidates = new Set<string>();

export const resolveWorkspaceEnvCandidatePaths = ({
  candidates = DEFAULT_ENV_CANDIDATES,
}: Pick<LoadWorkspaceEnvOptions, "candidates"> = {}) => [
  candidates.rootEnvLocal,
  candidates.serverEnv,
];

export const loadWorkspaceEnv = ({
  processEnv = process.env,
  candidates = DEFAULT_ENV_CANDIDATES,
}: LoadWorkspaceEnvOptions = {}): void => {
  for (const candidate of resolveWorkspaceEnvCandidatePaths({
    candidates,
  })) {
    if (loadedEnvCandidates.has(candidate)) {
      continue;
    }

    if (!existsSync(candidate)) {
      loadedEnvCandidates.add(candidate);
      continue;
    }

    dotenv.config({
      path: candidate,
      override: false,
      processEnv: processEnv as Record<string, string>,
    });
    loadedEnvCandidates.add(candidate);
  }
};

export const resetWorkspaceEnvLoaderForTests = (): void => {
  loadedEnvCandidates.clear();
};
