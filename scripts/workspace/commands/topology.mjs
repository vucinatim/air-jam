import { runProjectTopologyCli } from "../../../packages/cli/runtime/topology.mjs";
import { findRepoGame } from "../lib/repo-games.mjs";

export const runWorkspaceTopologyCommand = async ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure = false,
} = {}) => {
  const activeGame = findRepoGame({ rootDir, gameId });
  if (!activeGame) throw new Error(`Unknown game "${gameId}".`);
  await runProjectTopologyCli({
    cwd: activeGame.dir,
    argv: [`--mode=${mode}`, ...(secure ? ["--secure"] : [])],
  });
};
