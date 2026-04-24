import {
  getRepoVisualArtifactRoot,
  runRepoVisualCaptureCommand,
  startRepoVisualStack as startRepoVisualStackAtRoot,
} from "../../../packages/devtools-core/runtime/repo-visual.mjs";
import { repoRoot } from "../lib/paths.mjs";

export const VISUAL_ARTIFACT_ROOT = getRepoVisualArtifactRoot({
  rootDir: repoRoot,
});

export const startRepoVisualStack = (options: {
  gameId: string;
  mode: "standalone-dev" | "arcade-built";
  secure: boolean;
  visualHarness?: boolean;
}) =>
  startRepoVisualStackAtRoot({
    rootDir: repoRoot,
    ...options,
  });

export const runVisualCaptureCommand = (options: {
  gameId: string;
  scenarioId?: string | null;
  mode?: "standalone-dev" | "arcade-built";
  secure?: boolean;
}) =>
  runRepoVisualCaptureCommand({
    rootDir: repoRoot,
    ...options,
  });
