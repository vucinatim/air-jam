import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packWorkspacePackage } from "../lib/packaging.mjs";
import { repoRoot } from "../lib/paths.mjs";
import { runCommand } from "../lib/shell.mjs";

const legacyGameNames = [
  "code-review",
  "last-band-standing",
  "the-office",
];

const resolveLegacyGamesRoot = (explicitRoot) => {
  const root = explicitRoot?.trim() || process.env.AIRJAM_LEGACY_GAMES_ROOT?.trim();
  if (!root) {
    throw new Error(
      'Missing legacy game root. Pass `--root <path>` or set `AIRJAM_LEGACY_GAMES_ROOT`.',
    );
  }

  return path.resolve(root);
};

const createLegacyGames = (legacyGamesRoot) =>
  legacyGameNames.map((name) => ({
    name,
    sourceDir: path.join(legacyGamesRoot, name),
  }));

const rewritePackageJsonForTarballs = ({ projectDir, sdkTarball, serverTarball }) => {
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@air-jam/sdk": `file:${sdkTarball}`,
  };

  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@air-jam/server": `file:${serverTarball}`,
  };

  packageJson.pnpm = {
    ...packageJson.pnpm,
    overrides: {
      ...packageJson.pnpm?.overrides,
      "@air-jam/sdk": `file:${sdkTarball}`,
    },
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  return packageJson;
};

const copyLegacyGame = ({ sourceDir, destinationDir }) => {
  fs.cpSync(sourceDir, destinationDir, {
    recursive: true,
    force: true,
    filter: (entry) => {
      const basename = path.basename(entry);
      return basename !== "node_modules" && basename !== "dist";
    },
  });
};

const validateLegacyGame = ({ game, sdkTarball, serverTarball, tempRoot }) => {
  const projectDir = path.join(tempRoot, game.name);

  console.log("");
  console.log(`==> Validating ${game.name} against local Air Jam tarballs`);

  copyLegacyGame({
    sourceDir: game.sourceDir,
    destinationDir: projectDir,
  });

  const packageJson = rewritePackageJsonForTarballs({
    projectDir,
    sdkTarball,
    serverTarball,
  });

  runCommand("pnpm", ["install", "--no-frozen-lockfile"], { cwd: projectDir });
  runCommand("pnpm", ["exec", "air-jam-server", "logs", "--help"], { cwd: projectDir });
  runCommand("pnpm", ["typecheck"], { cwd: projectDir });

  if (packageJson.scripts?.test) {
    runCommand("pnpm", ["test"], { cwd: projectDir });
  }

  runCommand("pnpm", ["build"], { cwd: projectDir });
};

export const runRepoLegacyValidateTarballCommand = ({ root } = {}) => {
  const legacyGamesRoot = resolveLegacyGamesRoot(root);
  const legacyGames = createLegacyGames(legacyGamesRoot);
  const missing = legacyGames
    .filter((game) => !fs.existsSync(game.sourceDir))
    .map((game) => `${game.name}: ${game.sourceDir}`);

  if (missing.length > 0) {
    throw new Error(
      `Missing legacy game directories under ${legacyGamesRoot}:\n${missing.join("\n")}`,
    );
  }

  runCommand("pnpm", ["--filter", "sdk", "build"]);
  runCommand("pnpm", ["--filter", "server", "build"]);

  const sdkTarball = packWorkspacePackage(path.join(repoRoot, "packages", "sdk"));
  const serverTarball = packWorkspacePackage(path.join(repoRoot, "packages", "server"));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-legacy-tarball-"));

  legacyGames.forEach((game) => {
    validateLegacyGame({ game, sdkTarball, serverTarball, tempRoot });
  });

  console.log("");
  console.log(`Legacy game tarball validation passed from ${legacyGamesRoot}:`);
  legacyGames.forEach((game) => {
    console.log(`- ${game.name}`);
  });
};
