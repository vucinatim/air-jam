import { airJamGameDescriptionSchema } from "@air-jam/sdk/core";
import path from "node:path";
import { z } from "zod";
import { runCommandResult } from "./commands.js";
import { detectProjectContext } from "./context.js";
import {
  listDirectories,
  pathExists,
  readJsonFile,
  readPackageJson,
} from "./fs-utils.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import type {
  AirJamGameInspection,
  AirJamGameSummary,
  AirJamProjectContext,
  AirJamQualityGate,
  AirJamVisualCaptureInspection,
  AirJamVisualCaptureSummary,
  JsonObject,
} from "./types.js";

export type {
  AirJamGameInspection,
  AirJamGameSummary,
  AirJamVisualCaptureInspection,
  AirJamVisualCaptureSummary,
} from "./types.js";

const REPO_GAME_MANIFEST = "airjam-template.json";

const toBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

export const AIRJAM_CONFIG_PATH = "src/airjam.config.ts";

const describeGames = (configPaths: string[], cwd: string) => {
  if (!configPaths.length) return [];
  const result = runCommandResult({
    command: process.execPath,
    args: [
      ...resolveDevtoolsHelperArgs(
        resolveDevtoolsHelperScript("describe-game.ts"),
      ),
      ...configPaths.flatMap((config) => ["--config", config]),
    ],
    cwd,
  });
  if (!result.ok)
    throw new Error(
      `Air Jam declaration inspection failed.\n${result.stderr || result.stdout}`,
    );
  return z.array(airJamGameDescriptionSchema).parse(JSON.parse(result.stdout));
};

const readGameSummary = async (
  rootDir: string,
  declaration: AirJamGameSummary["declaration"],
): Promise<AirJamGameSummary> => {
  const manifestPath = path.join(rootDir, REPO_GAME_MANIFEST);
  const hasManifest = await pathExists(manifestPath);
  const manifest = hasManifest
    ? await readJsonFile<JsonObject>(manifestPath)
    : null;
  const packageJson = await readPackageJson(rootDir);
  return {
    rootDir,
    manifestPath: hasManifest ? manifestPath : null,
    id: declaration.metadata.slug,
    name: declaration.metadata.name,
    packageName: packageJson?.value.name ?? null,
    description: declaration.metadata.tagline,
    category: declaration.metadata.category,
    scaffold: toBooleanOrNull(manifest?.scaffold),
    configPath: path.join(rootDir, AIRJAM_CONFIG_PATH),
    declaration,
  };
};

const gameRoots = async (context: AirJamProjectContext) => {
  if (context.mode === "standalone-game") return [context.rootDir];
  if (context.mode !== "monorepo") return [];
  const directories = await listDirectories(
    path.join(context.rootDir, "games"),
  );
  const candidates = await Promise.all(
    directories.map(async (rootDir) =>
      (await pathExists(path.join(rootDir, REPO_GAME_MANIFEST)))
        ? rootDir
        : null,
    ),
  );
  return candidates.filter((rootDir) => rootDir !== null);
};

export const listGames = async ({
  cwd = process.cwd(),
}: { cwd?: string } = {}): Promise<AirJamGameSummary[]> => {
  const context = await detectProjectContext({ cwd });
  const roots = await gameRoots(context);
  const descriptions = describeGames(
    roots.map((rootDir) => path.join(rootDir, AIRJAM_CONFIG_PATH)),
    context.rootDir,
  );
  const games = await Promise.all(
    roots.map((rootDir, index) =>
      readGameSummary(rootDir, descriptions[index]),
    ),
  );
  return games.sort((left, right) => left.name.localeCompare(right.name));
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
  const roots = await gameRoots(context);
  const rootDir =
    context.mode === "standalone-game"
      ? roots[0]
      : gameId
        ? roots.find((candidate) => path.basename(candidate) === gameId)
        : roots.find(
            (candidate) =>
              path.resolve(cwd).startsWith(`${candidate}${path.sep}`) ||
              path.resolve(cwd) === candidate,
          );
  if (!rootDir)
    throw new Error(
      gameId
        ? `Unable to find Air Jam game "${gameId}".`
        : "Choose a gameId when inspecting a workspace.",
    );
  const [declaration] = describeGames(
    [path.join(rootDir, AIRJAM_CONFIG_PATH)],
    context.rootDir,
  );
  const game = await readGameSummary(rootDir, declaration);
  if (gameId && game.id !== gameId)
    throw new Error(`Game directory "${gameId}" declares slug "${game.id}".`);

  const packageJson = await readPackageJson(game.rootDir);
  const scripts = packageJson?.value.scripts ?? {};

  return {
    ...game,
    packageJsonPath: packageJson?.path ?? null,
    scripts,
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
