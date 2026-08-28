import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const manifestFileName = "airjam-template.json";

export const defaultWorkspaceGameId = "air-capture";

export const toLocalReferenceUrlEnvKey = (gameId) =>
  `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_${gameId.replace(/-/g, "_").toUpperCase()}_URL`;

export const toLocalReferenceControllerUrlEnvKey = (gameId) =>
  `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_${gameId.replace(/-/g, "_").toUpperCase()}_CONTROLLER_URL`;

const isRepoGameManifest = (value) =>
  value &&
  typeof value === "object" &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  typeof value.category === "string" &&
  typeof value.scaffold === "boolean";

const resolveGamesRoot = (rootDir) =>
  path.resolve(rootDir ?? packageRoot, "games");

export const loadRepoWorkspaceGames = ({ rootDir } = {}) => {
  const gamesRoot = resolveGamesRoot(rootDir);
  if (!fs.existsSync(gamesRoot)) {
    return [];
  }

  return fs
    .readdirSync(gamesRoot)
    .map((entry) => path.join(gamesRoot, entry))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .flatMap((dir) => {
      const manifestPath = path.join(dir, manifestFileName);
      if (!fs.existsSync(manifestPath)) {
        return [];
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!isRepoGameManifest(manifest)) {
        throw new Error(`Invalid repo game manifest at ${manifestPath}`);
      }

      return [
        {
          ...manifest,
          dir,
          manifestPath,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const findRepoWorkspaceGame = ({ rootDir, gameId }) =>
  loadRepoWorkspaceGames({ rootDir }).find((game) => game.id === gameId);
