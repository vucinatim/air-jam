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
    const cliArgs = [
      "node",
      JSON.stringify(cliEntry),
      projectName,
      "--template",
      "pong",
    ];

    if (source !== "registry") {
      cliArgs.push("--skip-install");
    }

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
      cliArgs.push(`--dep-spec=@air-jam/sdk=file:${sdkTarball}`);
      cliArgs.push(`--dep-spec=@air-jam/server=file:${serverTarball}`);
      cliArgs.push(`--override-spec=@air-jam/sdk=file:${sdkTarball}`);
    } else if (source === "workspace") {
      run("pnpm --filter sdk build", repoRoot);
      run("pnpm --filter server build", repoRoot);

      const sdkPkg = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "packages", "sdk", "package.json"), "utf-8"),
      );
      cliArgs.push(
        `--dep-spec=@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
      );
      cliArgs.push(
        `--dep-spec=@air-jam/server=link:${path.join(repoRoot, "packages", "server")}`,
      );
      cliArgs.push(`--dep-spec=zod=${toExactVersion(sdkPkg.dependencies?.zod)}`);
      cliArgs.push(
        `--override-spec=@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
      );
    }

    run(cliArgs.join(" "), tempRoot);

    if (source !== "registry") {
      run("pnpm install", projectDir);
    }

    run("pnpm typecheck", projectDir);
    run("pnpm build", projectDir);
  } finally {
    removeIfExists(tempRoot);
  }
};

main();
