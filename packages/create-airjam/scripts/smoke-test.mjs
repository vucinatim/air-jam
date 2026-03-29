import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredScaffoldPaths } from "./ai-pack-contract.mjs";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, { timeoutMs = 20_000, intervalMs = 200, label }) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}`);
};

const startServerProcess = ({ cwd, port }) => {
  const child = spawn("pnpm", ["exec", "air-jam-server"], {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const exited = new Promise((resolve, reject) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
    child.once("error", reject);
  });

  return {
    child,
    getOutput: () => output,
    exited,
  };
};

const stopServerProcess = async (server) => {
  if (server.child.exitCode !== null) {
    return;
  }

  server.child.kill("SIGTERM");
  await server.exited;
};

const waitForServerHealth = async ({ port, server }) => {
  await waitFor(
    async () => {
      const exitCode = server.child.exitCode;
      if (exitCode !== null) {
        throw new Error(
          `Generated server exited before becoming healthy.\n\n${server.getOutput()}`,
        );
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (!response.ok) {
          return false;
        }

        const body = await response.json();
        return body?.ok === true;
      } catch {
        return false;
      }
    },
    { label: `generated Air Jam server on :${port}` },
  );
};

const verifyGeneratedDevLogLifecycle = async (projectDir) => {
  const logFilePath = path.join(projectDir, ".airjam", "logs", "dev-latest.ndjson");
  const port = 4310;

  const firstServer = startServerProcess({ cwd: projectDir, port });
  try {
    await waitForServerHealth({ port, server: firstServer });
    await waitFor(
      async () => {
        if (!fs.existsSync(logFilePath)) {
          return false;
        }

        return fs.readFileSync(logFilePath, "utf8").includes('"event":"server.started"');
      },
      { label: "generated dev log file creation" },
    );
  } finally {
    await stopServerProcess(firstServer);
  }

  fs.appendFileSync(logFilePath, '{"marker":"restart-check"}\n', "utf8");

  const secondServer = startServerProcess({ cwd: projectDir, port });
  try {
    await waitForServerHealth({ port, server: secondServer });
    await waitFor(
      async () => {
        if (!fs.existsSync(logFilePath)) {
          return false;
        }

        const contents = fs.readFileSync(logFilePath, "utf8");
        return (
          !contents.includes("restart-check") &&
          contents.includes('"event":"server.started"')
        );
      },
      { label: "generated dev log file reset on restart" },
    );
  } finally {
    await stopServerProcess(secondServer);
  }
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

const main = async () => {
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
  const projectArg = path.join("nested", projectName);
  const projectDir = path.join(tempRoot, projectArg);

  try {
    const cliArgs = [
      "node",
      JSON.stringify(cliEntry),
      JSON.stringify(projectArg),
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

    const scaffoldPkg = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    );
    if (scaffoldPkg.name !== projectName) {
      throw new Error(
        `Expected scaffold package name "${projectName}", received "${scaffoldPkg.name}"`,
      );
    }

    for (const relativePath of requiredScaffoldPaths) {
      const absolutePath = path.join(projectDir, relativePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Expected scaffold file missing: ${relativePath}`);
      }
    }

    if (source !== "registry") {
      run("pnpm install", projectDir);
    }

    run("pnpm logs -- --help", projectDir);
    await verifyGeneratedDevLogLifecycle(projectDir);
    run("pnpm typecheck", projectDir);
    run("pnpm test", projectDir);
    run("pnpm build", projectDir);
  } finally {
    removeIfExists(tempRoot);
  }
};

await main();
