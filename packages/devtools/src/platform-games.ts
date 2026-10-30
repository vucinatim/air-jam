import {
  platformMachineCreateOwnedGameResultSchema,
  platformMachineGetOwnedGameResultSchema,
  platformMachineListOwnedGamesResultSchema,
  platformMachineUpdateOwnedGameResultSchema,
} from "@air-jam/sdk/platform-machine";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findUp, pathExists, readPackageJson } from "./fs-utils.js";
import { inspectGame } from "./games.js";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";
import type {
  AirJamLocalHostedGameDefaults,
  CreatePlatformGameOptions,
  InspectPlatformGameOptions,
  ListPlatformGamesOptions,
  UpdatePlatformGameOptions,
} from "./types.js";

export type {
  AirJamLocalHostedGameDefaults,
  CreatePlatformGameOptions,
  InspectPlatformGameOptions,
  ListPlatformGamesOptions,
  UpdatePlatformGameOptions,
} from "./types.js";

const normalizeGithubRemoteUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("git@github.com:")) {
    const repoPath = trimmed
      .slice("git@github.com:".length)
      .replace(/\.git$/, "");
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

export const readLocalHostedGameDefaults = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<AirJamLocalHostedGameDefaults> => {
  const game = await inspectGame({ cwd });
  const [packageJson, sourceUrl] = await Promise.all([
    readPackageJson(game.rootDir),
    resolveRepoSourceUrl({ projectDir: game.rootDir }),
  ]);

  const metadata = game.declaration.metadata;
  return {
    projectDir: game.rootDir,
    configPath: game.configPath,
    manifestPath: game.manifestPath,
    packageJsonPath: packageJson?.path ?? null,
    packageName: game.packageName,
    sourceUrl,
    metadata: {
      name: metadata.name,
      slug: metadata.slug,
      description: metadata.tagline,
      category: metadata.category,
      tags: [...(metadata.tags ?? [])],
    },
    template: {
      id: metadata.slug,
      name: metadata.name,
      description: metadata.tagline,
      category: metadata.category,
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
