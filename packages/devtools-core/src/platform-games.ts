import {
  airJamGameMetadataSchema,
  type AirJamGameMetadata,
} from "@air-jam/sdk/metadata";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import {
  platformMachineCreateOwnedGameResultSchema,
  platformMachineGetOwnedGameResultSchema,
  platformMachineListOwnedGamesResultSchema,
  platformMachineUpdateOwnedGameResultSchema,
} from "@air-jam/sdk/platform-machine";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findUp, pathExists, readJsonFile, readPackageJson } from "./fs-utils.js";
import { inspectGame } from "./games.js";
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

const resolveTsxLoaderPath = (): string | null => {
  try {
    return require.resolve("tsx/esm");
  } catch {
    return null;
  }
};

const normalizeGithubRemoteUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("git@github.com:")) {
    const repoPath = trimmed.slice("git@github.com:".length).replace(/\.git$/, "");
    return repoPath ? `https://github.com/${repoPath}` : null;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com") {
      return null;
    }

    return `https://github.com${url.pathname.replace(/\.git$/, "")}`.replace(
      /\/$/,
      "",
    );
  } catch {
    return null;
  }
};

const readGitRemoteFromConfig = async (
  gitDirOrFilePath: string,
): Promise<string | null> => {
  let configPath: string | null = null;

  const statsFile = await readFile(gitDirOrFilePath, "utf8").catch(() => null);
  if (statsFile?.startsWith("gitdir:")) {
    const relativeGitDir = statsFile.slice("gitdir:".length).trim();
    const resolvedGitDir = path.resolve(
      path.dirname(gitDirOrFilePath),
      relativeGitDir,
    );
    configPath = path.join(resolvedGitDir, "config");
  } else {
    configPath = path.join(gitDirOrFilePath, "config");
  }

  if (!(await pathExists(configPath))) {
    return null;
  }

  const config = await readFile(configPath, "utf8");
  const remoteBlockMatch = config.match(
    /\[remote "origin"\][\s\S]*?(?:\n\[|$)/,
  );
  if (!remoteBlockMatch) {
    return null;
  }

  const urlMatch = remoteBlockMatch[0].match(/^\s*url\s*=\s*(.+)$/m);
  return urlMatch?.[1]?.trim() || null;
};

const resolveRepoSourceUrl = async ({
  projectDir,
}: {
  projectDir: string;
}): Promise<string | null> => {
  const gitMarkerPath = await findUp(projectDir, ".git");
  if (!gitMarkerPath) {
    return null;
  }

  const repoRoot = path.dirname(gitMarkerPath);
  const remoteUrl = await readGitRemoteFromConfig(gitMarkerPath);
  const normalizedRemoteUrl = remoteUrl
    ? normalizeGithubRemoteUrl(remoteUrl)
    : null;

  if (!normalizedRemoteUrl) {
    return null;
  }

  const relativeProjectPath = path.relative(repoRoot, projectDir);
  if (!relativeProjectPath || relativeProjectPath.startsWith("..")) {
    return null;
  }

  return `${normalizedRemoteUrl}/tree/main/${relativeProjectPath.replaceAll(path.sep, "/")}`;
};

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

  const tsxLoaderPath = resolveTsxLoaderPath();
  if (!tsxLoaderPath) {
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
  const [template, packageJson, metadata, sourceUrl] = await Promise.all([
    loadTemplateManifest(game.rootDir),
    readPackageJson(game.rootDir),
    loadGameMetadataFromConfig(game.configPath),
    resolveRepoSourceUrl({ projectDir: game.rootDir }),
  ]);

  return {
    projectDir: game.rootDir,
    configPath: game.configPath,
    manifestPath: template.path,
    packageJsonPath: packageJson?.path ?? null,
    packageName: game.packageName,
    sourceUrl,
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
