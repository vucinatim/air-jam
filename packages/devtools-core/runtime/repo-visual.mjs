import path from "node:path";
import { startWorkspaceArcadeBuiltStack } from "./arcade-built-stack.mjs";
import { startWorkspaceStandaloneLiveStack } from "./standalone-live-stack.mjs";

const resolveRepoRoot = (rootDir) => path.resolve(rootDir ?? process.cwd());

export const getRepoVisualArtifactRoot = ({ rootDir } = {}) =>
  path.join(resolveRepoRoot(rootDir), ".airjam", "artifacts", "visual");

export const startRepoVisualStack = async ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure,
  visualHarness,
}) =>
  mode === "arcade-built"
    ? startWorkspaceArcadeBuiltStack({
        rootDir,
        gameId,
        secure,
        browserOrigin: "host",
        visualHarness: visualHarness === true,
      })
    : startWorkspaceStandaloneLiveStack({
        rootDir,
        gameId,
        secure,
      });
