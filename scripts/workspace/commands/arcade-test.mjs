import { SECURE_MODE_LOCAL } from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import { startWorkspaceArcadeBuiltStack } from "../lib/arcade-built-stack.mjs";
import { defaultWorkspaceGameId } from "../lib/repo-games.mjs";

export const runWorkspaceArcadeTestCommand = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
} = {}) => {
  const stack = await startWorkspaceArcadeBuiltStack({
    rootDir,
    gameId,
    secure,
    secureMode,
  });

  console.log(
    `[arcade:test] Stable Arcade integration stack is ready for ${stack.activeGame.id}${secure ? " in secure local mode" : ""}.`,
  );

  await new Promise(() => {});
};
