import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRepoGames } from "../../../../scripts/workspace/lib/repo-games.mjs";

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

export const loadRepoGameTemplateManifests = async () =>
  (await loadRepoGames({ rootDir: repoRoot })).map((game) => ({
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
export const loadScaffoldableRepoGameManifests = async () =>
  (await loadRepoGameTemplateManifests()).filter(
    (entry) => entry.manifest.scaffold === true,
  );
