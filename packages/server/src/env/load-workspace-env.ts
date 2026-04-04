import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let hasLoadedWorkspaceEnv = false;

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_PACKAGE_ROOT = resolve(MODULE_DIR, "..", "..");
const WORKSPACE_ROOT = resolve(SERVER_PACKAGE_ROOT, "..", "..");

const ENV_CANDIDATES = [
  resolve(WORKSPACE_ROOT, ".env.local"),
  resolve(WORKSPACE_ROOT, "apps/platform/.env.local"),
  resolve(SERVER_PACKAGE_ROOT, ".env"),
];

export const loadWorkspaceEnv = (): void => {
  if (hasLoadedWorkspaceEnv) {
    return;
  }

  for (const candidate of ENV_CANDIDATES) {
    if (!existsSync(candidate)) {
      continue;
    }

    dotenv.config({ path: candidate, override: false });
  }

  hasLoadedWorkspaceEnv = true;
};
