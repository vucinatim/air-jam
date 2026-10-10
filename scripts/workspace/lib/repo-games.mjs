import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const manifestFileName = "airjam-template.json";

export const defaultWorkspaceGameId = "air-capture";

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

export const loadRepoGames = ({ rootDir } = {}) => {
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

export const findRepoGame = ({ rootDir, gameId }) =>
  loadRepoGames({ rootDir }).find((game) => game.id === gameId);
