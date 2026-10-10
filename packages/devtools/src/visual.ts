import path from "node:path";
import { z } from "zod";
import { runCommandResult } from "./commands.js";
import {
  getTopology,
  startDev,
  stopDev,
  tryAttachToRunningDev,
} from "./dev.js";
import { pathExists, readJsonFile } from "./fs-utils.js";
import { inspectGame } from "./games.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import { inspectAirJamAgentConfig } from "./tooling/airjam-agent-inspection.js";
import type {
  AirJamSurfaceUrlSummary,
  AirJamVisualArtifactMode,
  AirJamVisualCaptureInspection,
  AirJamVisualCaptureSummary,
  AirJamVisualScenarioList,
  AirJamVisualScenarioMetadata,
  CaptureVisualsOptions,
  CaptureVisualsResult,
  ListVisualScenariosOptions,
} from "./types.js";

export type {
  AirJamVisualArtifactMode,
  AirJamVisualCaptureInspection,
  AirJamVisualCaptureSummary,
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

const captureUrlsSchema = z.object({
  appOrigin: z.url(),
  hostUrl: z.url(),
  controllerBaseUrl: z.url(),
  publicHost: z.url(),
  localBuildUrl: z.url().nullable(),
  browserBuildUrl: z.url().nullable(),
});

export type CaptureVisualsAtRuntimeOptions = Pick<
  CaptureVisualsOptions,
  "cwd" | "gameId" | "scenarioId" | "secure"
> & {
  mode: AirJamVisualArtifactMode;
  urls: AirJamSurfaceUrlSummary;
  artifactRoot: string;
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
    args: [...resolveDevtoolsHelperArgs(helperFile), ...args],
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

const captureGameAtRuntime = async ({
  game,
  visualSource,
  scenarioId,
  mode,
  secure,
  urls,
  artifactRoot,
}: Omit<CaptureVisualsAtRuntimeOptions, "cwd" | "gameId"> & {
  game: Awaited<ReturnType<typeof inspectGame>>;
  visualSource: ResolvedVisualSource;
}): Promise<CaptureVisualsResult> => {
  const resolvedUrls = captureUrlsSchema.parse(urls);
  runTsxHelper<AirJamVisualCaptureSummary>({
    helperFile: resolveDevtoolsHelperScript("run-visual-capture.ts"),
    cwd: game.rootDir,
    args: [
      `--game-id=${game.id}`,
      `--config=${visualSource.configPath}`,
      `--module-path=${visualSource.scenarioModulePath}`,
      `--artifact-root=${artifactRoot}`,
      `--mode=${mode === "arcade-built" ? "arcade-test" : "standalone-dev"}`,
      `--app-origin=${resolvedUrls.appOrigin}`,
      `--host-url=${resolvedUrls.hostUrl}`,
      `--controller-base-url=${resolvedUrls.controllerBaseUrl}`,
      `--public-host=${resolvedUrls.publicHost}`,
      ...(resolvedUrls.localBuildUrl
        ? [`--local-build-url=${resolvedUrls.localBuildUrl}`]
        : []),
      ...(resolvedUrls.browserBuildUrl
        ? [`--browser-build-url=${resolvedUrls.browserBuildUrl}`]
        : []),
      ...(scenarioId ? [`--scenario-id=${scenarioId}`] : []),
      ...(secure ? ["--secure"] : []),
    ],
  });
  const summaryPath = path.join(artifactRoot, game.id, "capture-summary.json");
  const summary = await readJsonFile<AirJamVisualCaptureSummary>(summaryPath);
  return {
    gameId: game.id,
    artifactRoot,
    summaryPath,
    summary,
    scenarios: await readScenarioMetadata({ artifactRoot, summary }),
  };
};

export const captureVisualsAtRuntime = async ({
  cwd = process.cwd(),
  gameId,
  ...runtime
}: CaptureVisualsAtRuntimeOptions): Promise<CaptureVisualsResult> => {
  const game = await inspectGame({ cwd, gameId });
  const visualSource = await resolveVisualSource(game.configPath);
  if (!visualSource) {
    throw new Error(
      `No visual scenarios published for "${game.id}" in ${game.rootDir}.`,
    );
  }
  return captureGameAtRuntime({ game, visualSource, ...runtime });
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
    run: ({ game, visualSource, topology }) =>
      captureGameAtRuntime({
        game,
        visualSource,
        scenarioId,
        mode: mode === "arcade-test" ? "arcade-built" : "standalone-dev",
        secure,
        urls: topology.urls,
        artifactRoot: resolveVisualArtifactRoot(
          topology.process?.cwd ?? game.rootDir,
        ),
      }),
  });
