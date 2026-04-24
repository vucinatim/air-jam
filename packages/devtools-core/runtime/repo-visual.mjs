import { runVisualHarness } from "@air-jam/harness";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startWorkspaceArcadeBuiltStack } from "./arcade-built-stack.mjs";
import { startWorkspaceStandaloneLiveStack } from "./standalone-live-stack.mjs";

const resolveRepoRoot = (rootDir) => path.resolve(rootDir ?? process.cwd());

export const getRepoVisualArtifactRoot = ({ rootDir } = {}) =>
  path.join(resolveRepoRoot(rootDir), ".airjam", "artifacts", "visual");

const resolveScenarioModulePath = ({ rootDir, gameId }) => {
  const repoRoot = resolveRepoRoot(rootDir);
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

const loadScenarioPack = async ({ rootDir, gameId }) => {
  const scenarioModulePath = resolveScenarioModulePath({ rootDir, gameId });
  const loaded = await import(pathToFileURL(scenarioModulePath).href);
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

export const runRepoVisualCaptureCommand = async ({
  rootDir = process.cwd(),
  gameId,
  scenarioId = null,
  mode = "standalone-dev",
  secure = false,
}) => {
  const artifactRoot = getRepoVisualArtifactRoot({ rootDir });
  const summary = await runVisualHarness({
    gameId,
    scenarioId,
    mode,
    secure,
    artifactRoot,
    loadScenarioPack: (targetGameId) =>
      loadScenarioPack({
        rootDir,
        gameId: targetGameId,
      }),
    startStack: (options) =>
      startRepoVisualStack({
        rootDir,
        ...options,
      }),
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
