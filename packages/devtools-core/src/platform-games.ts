import {
  airJamGameMetadataSchema,
  type AirJamGameMetadata,
} from "@air-jam/sdk/metadata";
import { createRequire } from "node:module";
import {
  platformMachineCreateOwnedGameResultSchema,
  platformMachineGetOwnedGameResultSchema,
  platformMachineListOwnedGamesResultSchema,
  platformMachineUpdateOwnedGameResultSchema,
} from "@air-jam/sdk/platform-machine";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectGame } from "./games.js";
import { readJsonFile, readPackageJson } from "./fs-utils.js";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";
import { runCommandResult } from "./commands.js";
import type {
  AirJamLocalHostedGameDefaults,
  CreatePlatformGameOptions,
  InspectPlatformGameOptions,
  ListPlatformGamesOptions,
  UpdatePlatformGameOptions,
} from "./types.js";

const require = createRequire(import.meta.url);
const tsxLoaderPath = require.resolve("tsx/esm");

type LocalTemplateManifest = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
};

const toOptionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const resolveTemplateManifestPath = (projectDir: string) =>
  path.join(projectDir, "airjam-template.json");

const loadTemplateManifest = async (
  projectDir: string,
): Promise<{
  path: string | null;
  value: LocalTemplateManifest | null;
}> => {
  const manifestPath = resolveTemplateManifestPath(projectDir);
  try {
    return {
      path: manifestPath,
      value: await readJsonFile<LocalTemplateManifest>(manifestPath),
    };
  } catch {
    return {
      path: null,
      value: null,
    };
  }
};

const loadGameMetadataFromConfig = async (
  configPath: string | null,
): Promise<AirJamGameMetadata | null> => {
  if (!configPath) {
    return null;
  }

  const configUrl = pathToFileURL(configPath).href;
  const script = `
    const moduleUrl = ${JSON.stringify(configUrl)};
    const mod = await import(moduleUrl);
    const value = mod.gameMetadata ?? mod.airjam?.metadata ?? null;
    process.stdout.write(JSON.stringify(value));
  `;

  const result = runCommandResult({
    command: process.execPath,
    args: [
      "--import",
      tsxLoaderPath,
      "--input-type=module",
      "--eval",
      script,
    ],
    cwd: path.dirname(configPath),
  });

  if (!result.ok) {
    return null;
  }

  const raw = result.stdout.trim();
  if (!raw) {
    return null;
  }

  try {
    return airJamGameMetadataSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

export const readLocalHostedGameDefaults = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamLocalHostedGameDefaults> => {
  const game = await inspectGame({ cwd });
  const [template, packageJson, metadata] = await Promise.all([
    loadTemplateManifest(game.rootDir),
    readPackageJson(game.rootDir),
    loadGameMetadataFromConfig(game.configPath),
  ]);

  return {
    projectDir: game.rootDir,
    configPath: game.configPath,
    manifestPath: template.path,
    packageJsonPath: packageJson?.path ?? null,
    packageName: game.packageName,
    metadata: {
      name: metadata?.name ?? null,
      slug: metadata?.slug ?? null,
      description: metadata?.tagline ?? null,
      category: metadata?.category ?? null,
      tags: metadata?.tags ? [...metadata.tags] : [],
    },
    template: {
      id: toOptionalString(template.value?.id),
      name: toOptionalString(template.value?.name),
      description: toOptionalString(template.value?.description),
      category: toOptionalString(template.value?.category),
    },
  };
};

export const listPlatformGames = async ({
  platformUrl,
  token,
}: ListPlatformGamesOptions = {}) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/games",
    token: resolved.token,
    schema: platformMachineListOwnedGamesResultSchema,
  });
};

export const inspectPlatformGame = async ({
  platformUrl,
  token,
  slugOrId,
}: InspectPlatformGameOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}`,
    token: resolved.token,
    schema: platformMachineGetOwnedGameResultSchema,
  });
};

export const createPlatformGame = async ({
  platformUrl,
  token,
  input,
}: CreatePlatformGameOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/games",
    method: "POST",
    token: resolved.token,
    body: input,
    schema: platformMachineCreateOwnedGameResultSchema,
  });
};

export const updatePlatformGame = async ({
  platformUrl,
  token,
  slugOrId,
  input,
}: UpdatePlatformGameOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}`,
    method: "PATCH",
    token: resolved.token,
    body: input,
    schema: platformMachineUpdateOwnedGameResultSchema,
  });
};
