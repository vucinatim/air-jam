import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const packageRoot = path.resolve(__dirname, "../..");
export const repoRoot = path.resolve(packageRoot, "../..");
export const gamesRoot = path.join(repoRoot, "games");
export const scaffoldSourcesRoot = path.join(packageRoot, "scaffold-sources");

const byTemplateName = (left, right) => left.name.localeCompare(right.name);

const parseScaffoldManifest = (manifestPath) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (typeof manifest.id !== "string" || manifest.id.trim() === "") {
    throw new Error(`Invalid scaffold manifest id at ${manifestPath}`);
  }

  if (typeof manifest.name !== "string" || manifest.name.trim() === "") {
    throw new Error(`Invalid scaffold manifest name at ${manifestPath}`);
  }

  if (typeof manifest.scaffold !== "boolean") {
    throw new Error(
      `Invalid scaffold manifest scaffold flag at ${manifestPath}`,
    );
  }

  return manifest;
};

export const loadRepoGameTemplateManifests = () => {
  if (!fs.existsSync(gamesRoot)) {
    throw new Error(`Missing games directory at ${gamesRoot}`);
  }

  return fs
    .readdirSync(gamesRoot)
    .map((entry) => path.join(gamesRoot, entry))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .map((gameDir) => {
      const manifestPath = path.join(gameDir, "airjam-template.json");
      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      const manifest = parseScaffoldManifest(manifestPath);
      return {
        gameDir,
        manifestPath,
        manifest,
      };
    })
    .filter(Boolean)
    .sort((left, right) => byTemplateName(left.manifest, right.manifest));
};

export const loadScaffoldableRepoGameManifests = () =>
  loadRepoGameTemplateManifests().filter(
    (entry) => entry.manifest.scaffold === true,
  );
