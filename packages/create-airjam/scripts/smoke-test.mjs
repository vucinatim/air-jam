import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SMOKE_SOURCES = ["registry", "tarball", "workspace"];

const run = (command, cwd) => {
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

const removeIfExists = (targetPath) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const parseSource = () => {
  const arg = process.argv.find((value) => value.startsWith("--source="));
  const source = arg ? arg.split("=")[1] : "tarball";
  if (!SMOKE_SOURCES.includes(source)) {
    throw new Error(
      `Invalid --source value "${source}". Expected one of: ${SMOKE_SOURCES.join(", ")}`,
    );
  }
  return source;
};

const toExactVersion = (value) => {
  if (!value) return undefined;
  return value.replace(/^[~^]/, "");
};

const writeJson = (filePath, json) => {
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");
};

const packWorkspacePackage = ({ packageDir, outDir }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const before = new Set(fs.readdirSync(outDir));
  run(`pnpm pack --pack-destination ${JSON.stringify(outDir)}`, packageDir);
  const created = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith(".tgz") && !before.has(name));
  if (created.length === 0) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }
  return path.join(outDir, created[created.length - 1]);
};

const rewireScaffoldDeps = ({
  projectDir,
  sdkDep,
  serverDep,
  sdkOverride,
  zodDep,
}) => {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  pkg.dependencies = pkg.dependencies || {};
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.dependencies["@air-jam/sdk"] = sdkDep;
  if (zodDep) {
    pkg.dependencies.zod = zodDep;
  }
  pkg.devDependencies["@air-jam/server"] = serverDep;
  if (sdkOverride) {
    pkg.pnpm = pkg.pnpm || {};
    pkg.pnpm.overrides = pkg.pnpm.overrides || {};
    pkg.pnpm.overrides["@air-jam/sdk"] = sdkOverride;
  }

  writeJson(pkgPath, pkg);
};

const main = () => {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "../../..");
  const cliEntry = path.join(repoRoot, "packages", "create-airjam", "dist", "index.js");
  const source = parseSource();

  if (!fs.existsSync(cliEntry)) {
    throw new Error(
      "create-airjam dist entry missing. Run 'pnpm --filter create-airjam build' before smoke test.",
    );
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-scaffold-smoke-"));
  const projectName = "smoke-airjam-app";
  const projectDir = path.join(tempRoot, projectName);

  try {
    const shouldSkipInstall = source !== "registry";
    run(
      `node ${JSON.stringify(cliEntry)} ${projectName} --template pong ${
        shouldSkipInstall ? "--skip-install" : ""
      }`.trim(),
      tempRoot,
    );

    if (source === "tarball") {
      const tarballDir = path.join(tempRoot, "tarballs");
      run("pnpm --filter sdk build", repoRoot);
      run("pnpm --filter server build", repoRoot);

      const sdkTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "sdk"),
        outDir: tarballDir,
      });
      const serverTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "server"),
        outDir: tarballDir,
      });

      rewireScaffoldDeps({
        projectDir,
        sdkDep: `file:${sdkTarball}`,
        serverDep: `file:${serverTarball}`,
        sdkOverride: `file:${sdkTarball}`,
      });
      run("pnpm install", projectDir);
    } else if (source === "workspace") {
      run("pnpm --filter sdk build", repoRoot);
      run("pnpm --filter server build", repoRoot);

      const sdkPkg = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "packages", "sdk", "package.json"), "utf-8"),
      );
      rewireScaffoldDeps({
        projectDir,
        sdkDep: `link:${path.join(repoRoot, "packages", "sdk")}`,
        serverDep: `link:${path.join(repoRoot, "packages", "server")}`,
        zodDep: toExactVersion(sdkPkg.dependencies?.zod),
      });
      run("pnpm install", projectDir);
    }

    run("pnpm typecheck", projectDir);
    run("pnpm build", projectDir);
  } finally {
    removeIfExists(tempRoot);
  }
};

main();
