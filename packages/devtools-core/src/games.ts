import { readFile } from "node:fs/promises";
import path from "node:path";
import { detectProjectContext } from "./context.js";
import {
  listDirectories,
  pathExists,
  readJsonFile,
  readPackageJson,
  resolveCandidatePath,
} from "./fs-utils.js";
import { resolveVisualScenarioModulePathFromConfig } from "./tooling/airjam-machine.js";
import type {
  AirJamGameInspection,
  AirJamGameSummary,
  AirJamProjectContext,
  AirJamQualityGate,
  AirJamVisualCaptureInspection,
  AirJamVisualCaptureSummary,
  JsonObject,
} from "./types.js";

const REPO_GAME_MANIFEST = "airjam-template.json";

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const toBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const inferGameIdFromRoot = (
  rootDir: string,
  packageName: string | null,
): string => packageName ?? path.basename(rootDir);

const getConfigPath = async (rootDir: string): Promise<string | null> =>
  resolveCandidatePath(rootDir, [
    "src/airjam.config.ts",
    "src/airjam.config.tsx",
    "src/airjam.config.js",
    "src/airjam.config.mjs",
    "airjam.config.ts",
    "airjam.config.tsx",
    "airjam.config.js",
    "airjam.config.mjs",
  ]);

const getVisualSupport = async ({
  rootDir,
  configPath,
}: {
  rootDir: string;
  configPath: string | null;
}): Promise<AirJamGameSummary["visual"]> => {
  const explicitVisualScenarios = configPath
    ? await resolveVisualScenarioModulePathFromConfig(configPath)
    : null;

  return {
    hasContract: Boolean(explicitVisualScenarios),
    hasScenarios: Boolean(explicitVisualScenarios),
    hasPrefabs: Boolean(
      await resolveCandidatePath(rootDir, [
        "visual/prefabs.ts",
        "visual/prefabs.tsx",
        "visual/prefabs.js",
        "visual/prefabs.mjs",
      ]),
    ),
  };
};

const readRepoGameSummary = async (
  rootDir: string,
): Promise<AirJamGameSummary | null> => {
  const manifestPath = path.join(rootDir, REPO_GAME_MANIFEST);
  if (!(await pathExists(manifestPath))) {
    return null;
  }

  const manifest = await readJsonFile<JsonObject>(manifestPath);
  const packageJson = await readPackageJson(rootDir);
  const packageName = packageJson?.value.name ?? null;
  const configPath = await getConfigPath(rootDir);

  return {
    id:
      toStringOrNull(manifest.id) ?? inferGameIdFromRoot(rootDir, packageName),
    name:
      toStringOrNull(manifest.name) ?? packageName ?? path.basename(rootDir),
    rootDir,
    packageName,
    description: toStringOrNull(manifest.description),
    category: toStringOrNull(manifest.category),
    scaffold: toBooleanOrNull(manifest.scaffold),
    manifestPath,
    configPath,
    visual: await getVisualSupport({ rootDir, configPath }),
  };
};

const readStandaloneGameSummary = async (
  context: AirJamProjectContext,
): Promise<AirJamGameSummary> => {
  const packageName = context.packageJson?.name ?? null;
  const configPath = await getConfigPath(context.rootDir);

  return {
    id: inferGameIdFromRoot(context.rootDir, packageName),
    name: packageName ?? path.basename(context.rootDir),
    rootDir: context.rootDir,
    packageName,
    description: toStringOrNull(context.packageJson?.description),
    category: null,
    scaffold: null,
    manifestPath: null,
    configPath,
    visual: await getVisualSupport({
      rootDir: context.rootDir,
      configPath,
    }),
  };
};

export const listGames = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamGameSummary[]> => {
  const context = await detectProjectContext({ cwd });

  if (context.mode === "monorepo") {
    const gameDirs = await listDirectories(path.join(context.rootDir, "games"));
    const summaries = await Promise.all(gameDirs.map(readRepoGameSummary));
    return summaries
      .filter((game): game is AirJamGameSummary => Boolean(game))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (context.mode === "standalone-game") {
    return [await readStandaloneGameSummary(context)];
  }

  return [];
};

const inferControllerPath = (configSource: string): string | null => {
  const match = /controllerPath:\s*["'`]([^"'`]+)["'`]/.exec(configSource);
  return match?.[1] ?? null;
};

const inferQualityGates = (
  scripts: Record<string, string>,
  contextMode: AirJamProjectContext["mode"],
): AirJamQualityGate[] => {
  const gates: AirJamQualityGate[] = [];
  if (scripts.typecheck) {
    gates.push("typecheck");
  }
  if (scripts.lint) {
    gates.push("lint");
  }
  if (scripts.test) {
    gates.push("test");
  }
  if (scripts.build) {
    gates.push("build");
  }
  if (scripts["format:check"]) {
    gates.push("format-check");
  }
  if (contextMode === "monorepo") {
    if (scripts["test:scaffold"]) {
      gates.push("scaffold-smoke");
    }
    if (scripts["check:release"]) {
      gates.push("release-check");
    }
  }
  return gates;
};

export const inspectGame = async ({
  cwd = process.cwd(),
  gameId,
}: {
  cwd?: string;
  gameId?: string;
} = {}): Promise<AirJamGameInspection> => {
  const context = await detectProjectContext({ cwd });
  const games = await listGames({ cwd });
  const game = gameId
    ? games.find((candidate) => candidate.id === gameId)
    : games[0];

  if (!game) {
    throw new Error(
      gameId
        ? `Unable to find Air Jam game "${gameId}".`
        : "Unable to find an Air Jam game in this project.",
    );
  }

  const packageJson = await readPackageJson(game.rootDir);
  const scripts = packageJson?.value.scripts ?? {};
  const configSource = game.configPath
    ? await readFile(game.configPath, "utf8").catch(() => "")
    : "";

  return {
    ...game,
    packageJsonPath: packageJson?.path ?? null,
    scripts,
    metadataExportLikely: /\bgameMetadata\b/.test(configSource),
    controllerPathLikely: inferControllerPath(configSource),
    qualityGates: inferQualityGates(
      context.mode === "monorepo"
        ? (context.packageJson?.scripts ?? {})
        : scripts,
      context.mode,
    ),
  };
};

const resolveVisualArtifactRoot = async (
  context: AirJamProjectContext,
): Promise<string> => {
  if (context.mode === "monorepo") {
    return path.join(context.rootDir, ".airjam", "artifacts", "visual");
  }

  return path.join(context.rootDir, ".airjam", "artifacts", "visual");
};

export const readVisualCaptureSummary = async ({
  cwd = process.cwd(),
  gameId,
}: {
  cwd?: string;
  gameId?: string;
} = {}): Promise<AirJamVisualCaptureInspection> => {
  const context = await detectProjectContext({ cwd });
  const game = await inspectGame({ cwd, gameId });
  const artifactRoot = await resolveVisualArtifactRoot(context);
  const summaryPath = path.join(artifactRoot, game.id, "capture-summary.json");

  if (!(await pathExists(summaryPath))) {
    throw new Error(
      `No visual capture summary found for "${game.id}" at ${summaryPath}.`,
    );
  }

  return {
    gameId: game.id,
    summaryPath,
    summary: await readJsonFile<AirJamVisualCaptureSummary>(summaryPath),
  };
};

export const listVisualCaptureSummaries = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamVisualCaptureInspection[]> => {
  const context = await detectProjectContext({ cwd });
  const artifactRoot = await resolveVisualArtifactRoot(context);
  const gameDirs = await listDirectories(artifactRoot);

  const captures = await Promise.all(
    gameDirs.map(async (gameDir) => {
      const summaryPath = path.join(gameDir, "capture-summary.json");
      if (!(await pathExists(summaryPath))) {
        return null;
      }

      const summary =
        await readJsonFile<AirJamVisualCaptureSummary>(summaryPath);
      return {
        gameId: summary.gameId,
        summaryPath,
        summary,
      } satisfies AirJamVisualCaptureInspection;
    }),
  );

  return captures
    .filter(
      (capture): capture is AirJamVisualCaptureInspection => capture !== null,
    )
    .sort((left, right) => left.gameId.localeCompare(right.gameId));
};
