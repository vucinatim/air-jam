import path from "node:path";
import { captureVisuals } from "../../../packages/devtools/src/visual.js";
import { startWorkspaceStandaloneLiveStack } from "../../workspace/lib/standalone-live-stack.mjs";
import { repoRoot } from "../lib/paths.mjs";

export const VISUAL_ARTIFACT_ROOT = path.join(
  repoRoot,
  ".airjam",
  "artifacts",
  "visual",
);

export const startRepoVisualStack = (options: {
  gameId: string;
  mode: "standalone-dev" | "arcade-built";
  secure: boolean;
}) => {
  if (options.mode !== "standalone-dev") {
    throw new Error(
      "Private Arcade capture belongs to the product repository.",
    );
  }
  return startWorkspaceStandaloneLiveStack({
    rootDir: repoRoot,
    ...options,
  });
};

export const runVisualCaptureCommand = (options: {
  gameId: string;
  scenarioId?: string | null;
  mode?: "standalone-dev";
  secure?: boolean;
}) =>
  captureVisuals({
    cwd: repoRoot,
    ...options,
    scenarioId: options.scenarioId ?? undefined,
  });
