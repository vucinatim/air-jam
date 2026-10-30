import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureWorkspacePackageBuild } from "../../ensure-workspace-package-build.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
export const defaultWorkspaceGameId = "air-capture";
export const loadRepoGames = async ({ rootDir = packageRoot } = {}) => {
  await ensureWorkspacePackageBuild("@air-jam/devtools");
  const { listGames } = await import("@air-jam/devtools/games");
  return Promise.all(
    (await listGames({ cwd: rootDir })).map(async (game) => ({
      ...JSON.parse(fs.readFileSync(game.manifestPath, "utf8")),
      ...game,
      dir: game.rootDir,
    })),
  );
};
export const findRepoGame = async ({ rootDir = packageRoot, gameId }) => {
  await ensureWorkspacePackageBuild("@air-jam/devtools");
  const { inspectGame } = await import("@air-jam/devtools/games");
  const game = await inspectGame({ cwd: rootDir, gameId });
  return {
    ...JSON.parse(fs.readFileSync(game.manifestPath, "utf8")),
    ...game,
    dir: game.rootDir,
  };
};
