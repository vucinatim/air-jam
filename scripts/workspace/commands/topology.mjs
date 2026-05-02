import path from "node:path";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import { resolveRepoWorkspaceTopologySurfaces } from "../../../packages/devtools-core/runtime/repo-workspace.mjs";

export const runWorkspaceTopologyCommand = async ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure = false,
} = {}) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort: DEFAULT_GAME_PORT,
      })
    : null;

  const surfaces = resolveRepoWorkspaceTopologySurfaces({
    rootDir,
    gameId,
    mode,
    secure,
    secureState,
    gamePort: DEFAULT_GAME_PORT,
    platformPort: DEFAULT_PLATFORM_PORT,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        gameId,
        mode,
        secure,
        surfaces,
      },
      null,
      2,
    )}\n`,
  );
};
