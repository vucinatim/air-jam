import path from "node:path";
import { runCommandResult } from "./commands.js";
import {
  getTopology,
  startDev,
  stopDev,
  tryAttachToRunningDev,
} from "./dev.js";
import { pathExists, readJsonFile } from "./fs-utils.js";
import { inspectGame, readVisualCaptureSummary } from "./games.js";
import {
  resolveDevtoolsHelperScript,
  resolveTsxCliPath,
} from "./helper-scripts.js";
import { inspectAirJamAgentConfig } from "./tooling/airjam-agent-inspection.js";
import type {
  AirJamVisualCaptureInspection,
  AirJamVisualScenarioList,
  AirJamVisualScenarioMetadata,
  CaptureVisualsOptions,
  CaptureVisualsResult,
  ListVisualScenariosOptions,
} from "./types.js";

type ResolvedVisualSource = {
  configPath: string;
  scenarioModulePath: string;
};

const resolveVisualArtifactRoot = (rootDir: string): string =>
  path.join(rootDir, ".airjam", "artifacts", "visual");

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

const runTsxHelper = <T>({
  helperFile,
  args,
  cwd,
}: {
  helperFile: string;
  args: string[];
  cwd: string;
}): T => {
  const result = runCommandResult({
    command: process.execPath,
    args: [resolveTsxCliPath(), helperFile, ...args],
    cwd,
  });
  if (!result.ok) {
    throw new Error(
      `Air Jam visual helper failed.\n\n${result.stderr || result.stdout}`,
    );
  }

  return parseHelperJson<T>(result.stdout);
};

const resolveVisualSource = async (
  configPath: string | null,
): Promise<ResolvedVisualSource | null> => {
  if (!configPath) {
    return null;
  }

  const scenarioModulePath = await inspectAirJamAgentConfig(configPath).then(
    (inspection) => inspection.visualScenariosModulePath,
  );
  return scenarioModulePath ? { configPath, scenarioModulePath } : null;
};

const readScenarioMetadata = async ({
  artifactRoot,
  summary,
}: {
  artifactRoot: string;
  summary: AirJamVisualCaptureInspection["summary"];
}): Promise<AirJamVisualScenarioMetadata[]> => {
  const entries = await Promise.all(
    summary.scenarios.map(async (scenario) => {
      const metadataPath = path.join(
        artifactRoot,
        scenario.relativeDir,
        "metadata.json",
      );
      return (await pathExists(metadataPath))
        ? readJsonFile<AirJamVisualScenarioMetadata>(metadataPath)
        : null;
    }),
  );

  return entries.filter(
    (entry): entry is AirJamVisualScenarioMetadata => entry !== null,
  );
};

export const listVisualScenarios = async ({
  cwd = process.cwd(),
  gameId,
}: ListVisualScenariosOptions = {}): Promise<AirJamVisualScenarioList> => {
  const game = await inspectGame({ cwd, gameId });
  const source = await resolveVisualSource(game.configPath);
  if (!source) {
    throw new Error(
      `No visual scenarios published for "${game.id}" in ${game.rootDir}.`,
    );
  }

  const result = runTsxHelper<{
    gameId: string;
    scenarios: AirJamVisualScenarioList["scenarios"];
  }>({
    helperFile: resolveDevtoolsHelperScript("list-visual-scenarios.ts"),
    cwd: game.rootDir,
    args: [`--config=${source.configPath}`],
  });
  return {
    gameId: result.gameId,
    scenarioModulePath: source.scenarioModulePath,
    scenarios: result.scenarios,
  };
};

const withVisualSession = async <T>({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  run,
}: {
  cwd?: string;
  gameId?: string;
  mode?: "standalone-dev" | "arcade-dev" | "arcade-test";
  secure?: boolean;
  run: (input: {
    game: Awaited<ReturnType<typeof inspectGame>>;
    visualSource: ResolvedVisualSource;
    topology: Awaited<ReturnType<typeof getTopology>>;
  }) => Promise<T>;
}): Promise<T> => {
  const game = await inspectGame({ cwd, gameId });
  const visualSource = await resolveVisualSource(game.configPath);
  if (!visualSource) {
    throw new Error(
      `No visual scenarios published for "${game.id}" in ${game.rootDir}.`,
    );
  }

  const attachedTopology = await tryAttachToRunningDev({
    cwd,
    gameId: game.id,
    mode,
    secure,
  });
  const session = attachedTopology
    ? {
        topology: attachedTopology,
        reusedExistingProcess: true,
        managedProcessId: attachedTopology.process?.id ?? null,
      }
    : await startDev({ cwd, gameId: game.id, mode, secure }).then(
        (started) => ({
          topology: started.topology,
          reusedExistingProcess: started.reusedExistingProcess,
          managedProcessId: started.process.id,
        }),
      );

  try {
    return await run({ game, visualSource, topology: session.topology });
  } finally {
    if (!session.reusedExistingProcess && session.managedProcessId) {
      await stopDev({ cwd, processId: session.managedProcessId });
    }
  }
};

export const captureVisuals = async ({
  cwd = process.cwd(),
  gameId,
  scenarioId,
  mode = "standalone-dev",
  secure = false,
}: CaptureVisualsOptions = {}): Promise<CaptureVisualsResult> =>
  withVisualSession({
    cwd,
    gameId,
    mode,
    secure,
    run: async ({ game, visualSource, topology }) => {
      const artifactRoot = resolveVisualArtifactRoot(
        topology.process?.cwd ?? game.rootDir,
      );

      runTsxHelper<unknown>({
        helperFile: resolveDevtoolsHelperScript("run-visual-capture.ts"),
        cwd: game.rootDir,
        args: [
          `--game-id=${game.id}`,
          `--config=${visualSource.configPath}`,
          `--module-path=${visualSource.scenarioModulePath}`,
          `--artifact-root=${artifactRoot}`,
          `--mode=${mode}`,
          `--app-origin=${topology.urls.appOrigin}`,
          `--host-url=${topology.urls.hostUrl}`,
          `--controller-base-url=${topology.urls.controllerBaseUrl}`,
          `--public-host=${topology.urls.publicHost}`,
          ...(topology.urls.localBuildUrl
            ? [`--local-build-url=${topology.urls.localBuildUrl}`]
            : []),
          ...(topology.urls.browserBuildUrl
            ? [`--browser-build-url=${topology.urls.browserBuildUrl}`]
            : []),
          ...(scenarioId ? [`--scenario-id=${scenarioId}`] : []),
          ...(secure ? ["--secure"] : []),
        ],
      });

      const inspection = await readVisualCaptureSummary({
        cwd,
        gameId: game.id,
      });
      return {
        gameId: inspection.gameId,
        artifactRoot,
        summaryPath: inspection.summaryPath,
        summary: inspection.summary,
        scenarios: await readScenarioMetadata({
          artifactRoot,
          summary: inspection.summary,
        }),
      };
    },
  });
