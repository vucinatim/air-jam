import { execFileSync, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredScaffoldPaths } from "../../cli/scripts/ai-pack-contract.mjs";
import { loadScaffoldableRepoGameManifests } from "./lib/scaffold-source-manifests.mjs";

const SMOKE_SOURCES = ["registry", "tarball", "workspace"];
const AGENT_CONTRACT_PATH = path.join("src", "game", "contracts", "agent.ts");

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

const runJson = (command, args, cwd) => {
  const output = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });
  return JSON.parse(output);
};

const quoteArg = (value) => JSON.stringify(value);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (
  predicate,
  { timeoutMs = 20_000, intervalMs = 200, label },
) => {
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
  const child = spawn("pnpm", ["exec", "air-jam-server", "start"], {
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
  const logFilePath = path.join(
    projectDir,
    ".airjam",
    "logs",
    "dev-latest.ndjson",
  );
  const port = 4310;

  const firstServer = startServerProcess({ cwd: projectDir, port });
  try {
    await waitForServerHealth({ port, server: firstServer });
    await waitFor(
      async () => {
        if (!fs.existsSync(logFilePath)) {
          return false;
        }

        return fs
          .readFileSync(logFilePath, "utf8")
          .includes('"event":"server.started"');
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

const verifyAiPackOwnershipBoundary = ({ projectDir, repoRoot }) => {
  const agentsPath = path.join(projectDir, "AGENTS.md");
  const skillPath = path.join(projectDir, "skills", "airjam-mcp", "SKILL.md");
  const managedDocPath = path.join(
    projectDir,
    "docs",
    "airjam",
    "agent-gold-path.md",
  );
  const rootManifestPath = path.join(
    repoRoot,
    "apps",
    "platform",
    "public",
    "ai-pack",
    "manifest.json",
  );
  const userMarker = "\n<!-- user-owned-smoke-marker -->\n";
  const managedMarker = "\n<!-- managed-drift-smoke-marker -->\n";

  fs.appendFileSync(agentsPath, userMarker, "utf8");
  fs.appendFileSync(skillPath, userMarker, "utf8");
  fs.appendFileSync(managedDocPath, managedMarker, "utf8");

  run(
    [
      "pnpm exec airjam ai-pack update --dir . --force --manifest-file",
      quoteArg(rootManifestPath),
    ].join(" "),
    projectDir,
  );

  if (!fs.readFileSync(agentsPath, "utf8").includes(userMarker.trim())) {
    throw new Error("AI pack update overwrote project-owned AGENTS.md.");
  }
  if (!fs.readFileSync(skillPath, "utf8").includes(userMarker.trim())) {
    throw new Error("AI pack update overwrote a project-owned skill.");
  }
  if (fs.readFileSync(managedDocPath, "utf8").includes(managedMarker.trim())) {
    throw new Error(
      "AI pack update did not repair managed framework guidance.",
    );
  }
};

const verifyPackedSemanticSessionLifecycle = async (projectDir) => {
  let gameSessionId;
  try {
    const opened = runJson(
      "pnpm",
      [
        "exec",
        "airjam",
        "session",
        "open",
        "--dir",
        ".",
        "--timeout-ms",
        "30000",
      ],
      projectDir,
    );
    gameSessionId = opened.gameSessionId;
    if (typeof gameSessionId !== "string" || gameSessionId.length === 0) {
      throw new Error("Packed airjam session open returned no gameSessionId.");
    }

    const inspection = runJson(
      "pnpm",
      ["exec", "airjam", "session", "read", gameSessionId, "--dir", "."],
      projectDir,
    );
    if (inspection.gameSessionId !== gameSessionId) {
      throw new Error(
        "Packed airjam session read did not return the opened semantic session.",
      );
    }
    if (!inspection.gameSnapshot || !Array.isArray(inspection.actions)) {
      throw new Error(
        "Packed airjam session read did not expose semantic state and actions.",
      );
    }
  } finally {
    if (gameSessionId) {
      runJson(
        "pnpm",
        ["exec", "airjam", "session", "close", gameSessionId, "--dir", "."],
        projectDir,
      );
    }
    runJson(
      "pnpm",
      ["exec", "airjam", "session", "broker", "stop", "--dir", "."],
      projectDir,
    );
  }
};

const verifyPackedMcpProtocol = async (projectDir) => {
  const child = spawn("pnpm", ["exec", "airjam-mcp"], {
    cwd: projectDir,
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    while (stdoutBuffer.includes("\n")) {
      const newline = stdoutBuffer.indexOf("\n");
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const request = (id, method, params = {}) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for packed MCP ${method}.${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      }, 10_000);
      pending.set(id, {
        resolve: (message) => {
          clearTimeout(timeout);
          resolve(message);
        },
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });

  try {
    const initialized = await request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "airjam-packed-smoke", version: "1.0.0" },
    });
    if (initialized.error || !initialized.result?.serverInfo) {
      throw new Error("Packed MCP server rejected protocol initialization.");
    }
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      })}\n`,
    );

    const listed = await request(2, "tools/list");
    const toolNames = listed.result?.tools?.map((tool) => tool.name) ?? [];
    for (const expected of [
      "airjam.inspect_project",
      "airjam.open_game_session",
      "airjam.read_game_session",
      "airjam.invoke_game_session_action",
      "airjam.close_game_session",
    ]) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Packed MCP server did not expose ${expected}.`);
      }
    }
  } finally {
    child.stdin.end();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
};

const removeIfExists = (targetPath) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
};

const findLastArg = (prefix) => {
  for (let index = process.argv.length - 1; index >= 0; index -= 1) {
    const value = process.argv[index];
    if (value.startsWith(prefix)) {
      return value;
    }
  }

  return undefined;
};

const parseSource = () => {
  const arg = findLastArg("--source=");
  const source = arg ? arg.split("=")[1] : "tarball";
  if (!SMOKE_SOURCES.includes(source)) {
    throw new Error(
      `Invalid --source value "${source}". Expected one of: ${SMOKE_SOURCES.join(", ")}`,
    );
  }
  return source;
};

const parseTemplate = () => {
  const arg = findLastArg("--template=");
  return arg ? arg.split("=")[1] : "pong";
};

const loadScaffoldTemplateIds = (repoRoot) => {
  const manifestPath = path.join(
    repoRoot,
    "packages",
    "create-airjam",
    "scaffold-templates",
    "manifest.json",
  );
  const index = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  return index.templates
    .map((entry) => entry.manifest)
    .filter(
      (manifest) =>
        manifest?.scaffold === true && typeof manifest.id === "string",
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((manifest) => manifest.id);
};

const resolveTemplateAgentContractExpectation = (templateId) => {
  const entry = loadScaffoldableRepoGameManifests().find(
    (candidate) => candidate.manifest.id === templateId,
  );
  if (!entry) {
    throw new Error(`Unknown scaffold template "${templateId}"`);
  }

  return fs.existsSync(path.join(entry.gameDir, AGENT_CONTRACT_PATH));
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

const installPackedCli = ({ createAirJamTarball, overrides, installDir }) => {
  fs.mkdirSync(installDir, { recursive: true });
  fs.writeFileSync(
    path.join(installDir, "package.json"),
    JSON.stringify(
      {
        name: "create-airjam-cli-smoke",
        private: true,
        pnpm: {
          overrides: Object.fromEntries(
            Object.entries(overrides).map(([name, tarballPath]) => [
              name,
              `file:${tarballPath}`,
            ]),
          ),
        },
      },
      null,
      2,
    ),
  );
  run(`pnpm add ${quoteArg(`file:${createAirJamTarball}`)}`, installDir);
};

const runScaffoldSmoke = async ({ repoRoot, source, template }) => {
  const cliEntry = path.join(
    repoRoot,
    "packages",
    "create-airjam",
    "dist",
    "index.js",
  );

  if (!fs.existsSync(cliEntry)) {
    throw new Error(
      "create-airjam dist entry missing. Run 'pnpm --filter create-airjam build' before smoke test.",
    );
  }

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-smoke-"),
  );
  const projectName = "smoke-airjam-app";
  const projectArg = path.join("nested", projectName);
  let scaffoldRoot = tempRoot;
  let projectDir = path.join(scaffoldRoot, projectArg);

  try {
    console.log(`\n[scaffold smoke] template=${template} source=${source}`);
    const cliArgs = [projectArg, "--template", template];
    let cliCommand = `node ${quoteArg(cliEntry)}`;

    if (source !== "registry") {
      cliArgs.push("--skip-install");
    }

    if (source === "tarball") {
      const tarballDir = path.join(tempRoot, "tarballs");
      const createAirJamTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "create-airjam"),
        outDir: tarballDir,
      });
      run("pnpm --filter sdk build", repoRoot);
      run("pnpm --filter server build", repoRoot);
      run("pnpm --filter @air-jam/mcp-server build", repoRoot);
      run("pnpm --filter @air-jam/cli build", repoRoot);

      const sdkTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "sdk"),
        outDir: tarballDir,
      });
      const serverTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "server"),
        outDir: tarballDir,
      });
      const mcpServerTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "mcp-server"),
        outDir: tarballDir,
      });
      const airJamCliTarball = packWorkspacePackage({
        packageDir: path.join(repoRoot, "packages", "cli"),
        outDir: tarballDir,
      });
      const cliInstallDir = path.join(tempRoot, "create-airjam-cli");
      installPackedCli({
        createAirJamTarball,
        overrides: {
          "@air-jam/sdk": sdkTarball,
          "@air-jam/server": serverTarball,
          "@air-jam/mcp-server": mcpServerTarball,
          "@air-jam/cli": airJamCliTarball,
        },
        installDir: cliInstallDir,
      });
      scaffoldRoot = cliInstallDir;
      projectDir = path.join(scaffoldRoot, projectArg);
      cliCommand = "pnpm exec create-airjam";
      cliArgs.push(`--dep-spec=@air-jam/sdk=file:${sdkTarball}`);
      cliArgs.push(`--dep-spec=@air-jam/server=file:${serverTarball}`);
      cliArgs.push(`--dep-spec=@air-jam/mcp-server=file:${mcpServerTarball}`);
      cliArgs.push(`--dep-spec=@air-jam/cli=file:${airJamCliTarball}`);
      cliArgs.push(`--override-spec=@air-jam/sdk=file:${sdkTarball}`);
      cliArgs.push(`--override-spec=@air-jam/server=file:${serverTarball}`);
      cliArgs.push(
        `--override-spec=@air-jam/mcp-server=file:${mcpServerTarball}`,
      );
      cliArgs.push(`--override-spec=@air-jam/cli=file:${airJamCliTarball}`);
      run([cliCommand, ...cliArgs.map(quoteArg)].join(" "), cliInstallDir);
    } else if (source === "workspace") {
      run("pnpm --filter sdk build", repoRoot);
      run("pnpm --filter server build", repoRoot);
      run("pnpm --filter @air-jam/mcp-server build", repoRoot);
      run("pnpm --filter @air-jam/cli build", repoRoot);

      const sdkPkg = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, "packages", "sdk", "package.json"),
          "utf-8",
        ),
      );
      cliArgs.push(
        `--dep-spec=@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
      );
      cliArgs.push(
        `--dep-spec=@air-jam/server=link:${path.join(repoRoot, "packages", "server")}`,
      );
      cliArgs.push(
        `--dep-spec=@air-jam/mcp-server=link:${path.join(repoRoot, "packages", "mcp-server")}`,
      );
      cliArgs.push(
        `--dep-spec=@air-jam/cli=link:${path.join(repoRoot, "packages", "cli")}`,
      );
      cliArgs.push(
        `--dep-spec=zod=${toExactVersion(sdkPkg.dependencies?.zod)}`,
      );
      cliArgs.push(
        `--override-spec=@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
      );
      run([cliCommand, ...cliArgs.map(quoteArg)].join(" "), tempRoot);
    } else {
      run([cliCommand, ...cliArgs.map(quoteArg)].join(" "), scaffoldRoot);
    }

    const expectedAgentContract =
      resolveTemplateAgentContractExpectation(template);
    const generatedAgentContractPath = path.join(
      projectDir,
      AGENT_CONTRACT_PATH,
    );
    const generatedHasAgentContract = fs.existsSync(generatedAgentContractPath);
    if (generatedHasAgentContract !== expectedAgentContract) {
      throw new Error(
        expectedAgentContract
          ? `Generated project lost ${AGENT_CONTRACT_PATH} for template "${template}".`
          : `Generated project unexpectedly added ${AGENT_CONTRACT_PATH} for template "${template}".`,
      );
    }

    const scaffoldPkg = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    );
    if (scaffoldPkg.name !== projectName) {
      throw new Error(
        `Expected scaffold package name "${projectName}", received "${scaffoldPkg.name}"`,
      );
    }
    if (typeof scaffoldPkg.scripts?.mcp !== "string") {
      throw new Error('Expected scaffold project to define an "mcp" script.');
    }
    if (!scaffoldPkg.devDependencies?.["@air-jam/mcp-server"]) {
      throw new Error(
        'Expected scaffold project to depend on "@air-jam/mcp-server".',
      );
    }
    if (!scaffoldPkg.devDependencies?.["@air-jam/cli"]) {
      throw new Error(
        'Expected scaffold project to depend on the canonical "@air-jam/cli".',
      );
    }
    if (!fs.existsSync(path.join(projectDir, ".mcp.json"))) {
      throw new Error(
        'Expected scaffold project to include a committed ".mcp.json".',
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

    run("pnpm exec air-jam-server logs --help", projectDir);
    run("pnpm exec airjam --help", projectDir);
    run("pnpm exec airjam-mcp --help", projectDir);
    if (source === "tarball" && template === "pong") {
      verifyAiPackOwnershipBoundary({ projectDir, repoRoot });
      await verifyPackedMcpProtocol(projectDir);
      await verifyPackedSemanticSessionLifecycle(projectDir);
    }
    await verifyGeneratedDevLogLifecycle(projectDir);
    run("pnpm typecheck", projectDir);
    run("pnpm test", projectDir);
    run("pnpm build", projectDir);
  } finally {
    removeIfExists(tempRoot);
  }
};

const main = async () => {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "../../..");
  const source = parseSource();
  const template = parseTemplate();
  const templates =
    template === "all" ? loadScaffoldTemplateIds(repoRoot) : [template];

  for (const templateId of templates) {
    await runScaffoldSmoke({ repoRoot, source, template: templateId });
  }
};

await main();
