import { runVisualHarness } from "@air-jam/harness";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startWorkspaceArcadeBuiltStack } from "./arcade-built-stack.mjs";
import { startWorkspaceStandaloneLiveStack } from "./standalone-live-stack.mjs";

const resolveRepoRoot = (rootDir) => path.resolve(rootDir ?? process.cwd());

export const getRepoVisualArtifactRoot = ({ rootDir } = {}) =>
  path.join(resolveRepoRoot(rootDir), ".airjam", "artifacts", "visual");

const resolveConfigPath = ({ rootDir, gameId }) => {
  const repoRoot = resolveRepoRoot(rootDir);
  const candidates = [
    path.join(repoRoot, "games", gameId, "src", "airjam.config.ts"),
    path.join(repoRoot, "games", gameId, "airjam.config.ts"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No Air Jam config found for "${gameId}" in games/${gameId}.`,
  );
};

const loadScenarioPack = async ({ rootDir, gameId }) => {
  const configPath = resolveConfigPath({ rootDir, gameId });
  const loadedConfigModule = await import(pathToFileURL(configPath).href);
  const airjam =
    loadedConfigModule.airjam ?? loadedConfigModule.default ?? null;
  const moduleSpecifier = airjam?.game?.machine?.visualScenariosModule ?? null;

  if (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "") {
    throw new Error(
      `Air Jam config "${configPath}" does not publish game.machine.visualScenariosModule.`,
    );
  }

  const scenarioModulePath = path.resolve(
    path.dirname(configPath),
    moduleSpecifier,
  );
  const loaded = await import(pathToFileURL(scenarioModulePath).href);
  const scenarioPack =
    loaded.visualHarness ?? loaded.visualScenarios ?? loaded.harness ?? null;

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
