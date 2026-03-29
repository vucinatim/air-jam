import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tarballDir = path.join(repoRoot, ".airjam", "tarballs");
const legacyGamesRoot = "/Users/timvucina/Desktop/zerodays/air-jam-games";

const legacyGames = [
  {
    name: "code-review",
    sourceDir: path.join(legacyGamesRoot, "code-review"),
  },
  {
    name: "last-band-standing",
    sourceDir: path.join(legacyGamesRoot, "last-band-standing"),
  },
  {
    name: "the-office",
    sourceDir: path.join(legacyGamesRoot, "the-office"),
  },
];

const run = (command, cwd = repoRoot) => {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
  });
};

const toTarballBaseName = (packageName) =>
  packageName.replace(/^@/, "").replace(/\//g, "-");

const packWorkspacePackage = (packageDir) => {
  fs.mkdirSync(tarballDir, { recursive: true });

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );

  const expectedTarball = `${toTarballBaseName(packageJson.name)}-${packageJson.version}.tgz`;
  const tarballPath = path.join(tarballDir, expectedTarball);

  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  run(`pnpm pack --pack-destination ${JSON.stringify(tarballDir)}`, packageDir);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return tarballPath;
};

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

  run("pnpm install --no-frozen-lockfile", projectDir);
  run("pnpm exec air-jam-server logs --help", projectDir);
  run("pnpm typecheck", projectDir);

  if (packageJson.scripts?.["test:run"]) {
    run("pnpm test:run", projectDir);
  } else if (packageJson.scripts?.test) {
    run("pnpm test", projectDir);
  }

  run("pnpm build", projectDir);
};

const main = () => {
  const missing = legacyGames
    .filter((game) => !fs.existsSync(game.sourceDir))
    .map((game) => `${game.name}: ${game.sourceDir}`);

  if (missing.length > 0) {
    throw new Error(
      `Missing legacy game directories:\n${missing.join("\n")}`,
    );
  }

  run("pnpm --filter sdk build");
  run("pnpm --filter server build");

  const sdkTarball = packWorkspacePackage(path.join(repoRoot, "packages", "sdk"));
  const serverTarball = packWorkspacePackage(path.join(repoRoot, "packages", "server"));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-legacy-tarball-"));

  legacyGames.forEach((game) => {
    validateLegacyGame({ game, sdkTarball, serverTarball, tempRoot });
  });

  console.log("");
  console.log("Legacy game tarball validation passed:");
  legacyGames.forEach((game) => {
    console.log(`- ${game.name}`);
  });
};

main();
