import {
  runVisualHarness,
  type AnyVisualHarnessBridgeDefinition,
  type RunVisualCaptureCommandOptions,
  type VisualHarnessMode,
  type VisualScenarioPack,
} from "@air-jam/visual-harness";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startWorkspaceArcadeBuiltStack } from "../../workspace/lib/arcade-built-stack.mjs";
import { startWorkspaceStandaloneLiveStack } from "../../workspace/lib/standalone-live-stack.mjs";
import { repoRoot } from "../lib/paths.mjs";

export const VISUAL_ARTIFACT_ROOT = path.join(
  repoRoot,
  ".airjam",
  "artifacts",
  "visual",
);

const resolveScenarioModulePath = (gameId: string): string => {
  const tsPath = path.join(repoRoot, "games", gameId, "visual", "scenarios.ts");
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  const mjsPath = path.join(
    repoRoot,
    "games",
    gameId,
    "visual",
    "scenarios.mjs",
  );
  if (fs.existsSync(mjsPath)) {
    return mjsPath;
  }

  throw new Error(
    `No visual harness scenario pack found for "${gameId}" in games/${gameId}/visual/.`,
  );
};

const loadScenarioPack = async (
  gameId: string,
): Promise<VisualScenarioPack<AnyVisualHarnessBridgeDefinition>> => {
  const scenarioModulePath = resolveScenarioModulePath(gameId);
  const loaded = (await import(pathToFileURL(scenarioModulePath).href)) as {
    visualHarness?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
  };
  const scenarioPack = loaded.visualHarness ?? null;

  if (
    !scenarioPack ||
    scenarioPack.gameId !== gameId ||
    !scenarioPack.bridge ||
    scenarioPack.bridge.gameId !== gameId ||
    !Array.isArray(scenarioPack.scenarios)
  ) {
    throw new Error(
      `Invalid visual harness scenario pack for "${gameId}" at ${scenarioModulePath}.`,
    );
  }

  return scenarioPack;
};

export const startRepoVisualStack = async ({
  gameId,
  mode,
  secure,
  visualHarness,
}: {
  gameId: string;
  mode: VisualHarnessMode;
  secure: boolean;
  visualHarness?: boolean;
}) => {
  return mode === "arcade-built"
    ? startWorkspaceArcadeBuiltStack({
        rootDir: repoRoot,
        gameId,
        secure,
        browserOrigin: "host",
        visualHarness: visualHarness === true,
      })
    : startWorkspaceStandaloneLiveStack({
        rootDir: repoRoot,
        gameId,
        secure,
      });
};

export const runVisualCaptureCommand = async ({
  gameId,
  scenarioId = null,
  mode = "standalone-dev",
  secure = false,
}: RunVisualCaptureCommandOptions): Promise<void> => {
  const summary = await runVisualHarness({
    gameId,
    scenarioId,
    mode,
    secure,
    artifactRoot: VISUAL_ARTIFACT_ROOT,
    loadScenarioPack,
    startStack: startRepoVisualStack,
    onCaptureStart: ({
      gameId: activeGameId,
      mode: activeMode,
      scenarioCount,
    }) => {
      console.log(
        `[visual] Capturing ${scenarioCount} scenario(s) for ${activeGameId} using ${activeMode}.`,
      );
    },
    onScenarioStart: (scenario) => {
      console.log(`[visual] Scenario ${scenario.id}`);
    },
    onComplete: (completedSummary) => {
      console.log(
        `[visual] Capture complete. Artifacts written to ${path.join(".airjam", "artifacts", "visual", completedSummary.gameId)}.`,
      );
    },
  });

  void summary;
};
