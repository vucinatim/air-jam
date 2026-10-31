import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRepoGame,
  loadRepoGames,
} from "../../../../scripts/workspace/lib/repo-games.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const packageRoot = path.resolve(__dirname, "../..");
export const repoRoot = path.resolve(packageRoot, "../..");
export const gamesRoot = path.join(repoRoot, "games");
export const scaffoldSourcesRoot = path.join(packageRoot, "scaffold-sources");
export const scaffoldTemplatesRoot = path.join(
  packageRoot,
  "scaffold-templates",
);
export const scaffoldTemplateManifestPath = path.join(
  scaffoldTemplatesRoot,
  "manifest.json",
);

export const listScaffoldableRepoGameDirectories = () =>
  fs
    .readdirSync(gamesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(gamesRoot, entry.name))
    .filter((gameDir) => {
      const manifestPath = path.join(gameDir, "airjam-template.json");
      return (
        fs.existsSync(manifestPath) &&
        JSON.parse(fs.readFileSync(manifestPath, "utf8")).scaffold === true
      );
    });

export const loadRepoGameTemplateManifests = async ({
  gameDirectories,
} = {}) => {
  const games = gameDirectories
    ? await Promise.all(
        gameDirectories.map((gameDir) =>
          findRepoGame({ rootDir: repoRoot, gameId: path.basename(gameDir) }),
        ),
      )
    : await loadRepoGames({ rootDir: repoRoot });
  return games
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((game) => ({
      gameDir: game.rootDir,
      declaration: game.declaration,
      manifestPath: game.manifestPath,
      manifest: {
        ...JSON.parse(fs.readFileSync(game.manifestPath, "utf8")),
        id: game.id,
        name: game.name,
        description: game.description,
        category: game.category,
      },
    }));
};
export const loadScaffoldableRepoGameManifests = async (options) => {
  const directories = listScaffoldableRepoGameDirectories();
  return (await loadRepoGameTemplateManifests(options)).filter((entry) =>
    directories.includes(entry.gameDir),
  );
};
