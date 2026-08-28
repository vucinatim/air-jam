import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { resolvePublicPackages } from "../../release/public-packages.mjs";
import { repoRoot } from "./paths.mjs";

const require = createRequire(import.meta.url);
const commandMaxBuffer = 64 * 1024 * 1024;
const candidatePackageNames = new Set(
  resolvePublicPackages().map((entry) => entry.packageName),
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const normalizeOutput = (value, runRoot) =>
  String(value ?? "")
    .replaceAll(repoRoot, "<repo>")
    .replaceAll(runRoot, "<run>");

const reserveLoopbackPort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a loopback registry port."));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const waitForRegistry = async ({ registryUrl, child, readOutput }) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) {
      throw new Error(
        `Candidate registry exited before becoming healthy.\n${readOutput()}`,
      );
    }
    try {
      const response = await fetch(`${registryUrl}/-/ping`);
      if (response.ok) return;
    } catch {
      // Registry startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for candidate registry.\n${readOutput()}`);
};

const stopChild = async (child) => {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const startCandidateRegistry = async ({ runRoot, port }) => {
  const registryDir = path.join(runRoot, "registry");
  fs.mkdirSync(registryDir, { recursive: true });
  const configPath = path.join(registryDir, "config.yaml");
  fs.writeFileSync(
    configPath,
    [
      "storage: ./storage",
      "max_body_size: 120mb",
      "auth:",
      "  htpasswd:",
      "    file: ./htpasswd",
      "uplinks:",
      "  npmjs:",
      "    url: https://registry.npmjs.org/",
      "packages:",
      "  '@air-jam/*':",
      "    access: $all",
      "    publish: $all",
      "  'create-airjam':",
      "    access: $all",
      "    publish: $all",
      "  '**':",
      "    access: $all",
      "    proxy: npmjs",
      "log: { type: stdout, format: pretty, level: warn }",
      "publish:",
      "  allow_offline: false",
      "",
    ].join("\n"),
  );

  const verdaccioPackagePath = require.resolve("verdaccio/package.json");
  const verdaccioPackage = JSON.parse(
    fs.readFileSync(verdaccioPackagePath, "utf8"),
  );
  const binRelative =
    typeof verdaccioPackage.bin === "string"
      ? verdaccioPackage.bin
      : verdaccioPackage.bin?.verdaccio;
  if (!binRelative) {
    throw new Error("The installed Verdaccio package exposes no CLI binary.");
  }
  const binPath = path.resolve(path.dirname(verdaccioPackagePath), binRelative);
  const output = [];
  const child = spawn(
    process.execPath,
    [binPath, "--config", configPath, "--listen", `127.0.0.1:${port}`],
    {
      cwd: registryDir,
      env: {
        ...process.env,
        NO_UPDATE_NOTIFIER: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const registryUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForRegistry({
      registryUrl,
      child,
      readOutput: () => output.join("").slice(-8_000),
    });
    return { child, registryUrl };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
};

const configureRunScopedRegistryAuth = async ({
  registryUrl,
  runRoot,
  commandEnv,
}) => {
  const username = "airjam-golden-path";
  const password = randomBytes(24).toString("base64url");
  const response = await fetch(
    `${registryUrl}/-/user/org.couchdb.user:${username}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: username,
        password,
        email: "golden-path@invalid.local",
        type: "user",
        roles: [],
        date: new Date().toISOString(),
      }),
    },
  );
  const result = await response.json();
  if (!response.ok || typeof result.token !== "string") {
    throw new Error(
      `Candidate registry user bootstrap failed with HTTP ${response.status}.`,
    );
  }
  const npmrcPath = path.join(runRoot, "registry", "client.npmrc");
  const registryKey = registryUrl.replace(/^https?:/u, "");
  fs.writeFileSync(
    npmrcPath,
    [
      `registry=${registryUrl}/`,
      `${registryKey}/:_authToken=${result.token}`,
      "",
    ].join("\n"),
  );
  commandEnv.npm_config_userconfig = npmrcPath;
};

const findPackedTarball = ({ output, packageDir }) => {
  const candidate = output
    .trim()
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  if (!candidate) {
    throw new Error(`Package at ${packageDir} produced no tarball path.`);
  }
  return path.resolve(packageDir, candidate);
};

const assertRegistrySafeProject = ({ projectDir, registryUrl }) => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectDir, "package.json"), "utf8"),
  );
  const specs = [
    ...Object.entries(packageJson.dependencies ?? {}),
    ...Object.entries(packageJson.devDependencies ?? {}),
    ...Object.entries(packageJson.pnpm?.overrides ?? {}),
  ];
  for (const [name, spec] of specs) {
    if (typeof spec === "string" && /^(?:file|link|workspace):/u.test(spec)) {
      throw new Error(
        `Generated dependency ${name} uses forbidden spec ${spec}.`,
      );
    }
  }
  for (const packageName of [
    "@air-jam/sdk",
    "@air-jam/server",
    "@air-jam/mcp-server",
    "@air-jam/cli",
  ]) {
    const spec =
      packageJson.dependencies?.[packageName] ??
      packageJson.devDependencies?.[packageName];
    if (typeof spec !== "string") {
      throw new Error(`Generated project is missing ${packageName}.`);
    }
  }

  const modulesState = fs.readFileSync(
    path.join(projectDir, "node_modules", ".modules.yaml"),
    "utf8",
  );
  if (!modulesState.includes(registryUrl)) {
    throw new Error("Generated install did not record the candidate registry.");
  }
  if (modulesState.includes(repoRoot)) {
    throw new Error("Generated install contains a private monorepo path.");
  }
  const lockSource = fs.readFileSync(
    path.join(projectDir, "pnpm-lock.yaml"),
    "utf8",
  );
  if (lockSource.includes(repoRoot)) {
    throw new Error("Generated lockfile contains a private monorepo path.");
  }
  if (
    /^\s*(?:specifier|version):\s+(?:file|link|workspace):/mu.test(lockSource)
  ) {
    throw new Error("Generated lockfile contains a forbidden local spec.");
  }
  return packageJson;
};

const inspectInstalledAirJamVersions = (projectDir) => {
  const versions = {};
  for (const packageName of candidatePackageNames) {
    if (packageName === "create-airjam") continue;
    const packagePath = path.join(
      projectDir,
      "node_modules",
      ...packageName.split("/"),
      "package.json",
    );
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    versions[packageName] = packageJson.version;
  }
  return versions;
};

const verifyMcpProtocol = async ({ projectDir, env }) => {
  const child = spawn("pnpm", ["exec", "airjam-mcp"], {
    cwd: projectDir,
    env,
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
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const request = (id, method, params = {}) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for MCP ${method}.\n${stderr}`));
      }, 10_000);
      pending.set(id, (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });

  try {
    const initialized = await request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "airjam-golden-path-bootstrap", version: "1.0.0" },
    });
    if (initialized.error || !initialized.result?.serverInfo) {
      throw new Error("Candidate MCP server rejected initialization.");
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
    for (const required of [
      "airjam.inspect_project",
      "airjam.open_game_session",
      "airjam.read_game_session",
      "airjam.invoke_game_session_action",
      "airjam.close_game_session",
    ]) {
      if (!toolNames.includes(required)) {
        throw new Error(`Candidate MCP server did not expose ${required}.`);
      }
    }
    return {
      serverInfo: initialized.result.serverInfo,
      tools: toolNames.sort(),
    };
  } finally {
    child.stdin.end();
    await stopChild(child);
  }
};

export const runGoldenPathBootstrap = async ({
  template = "minimal",
  keepWorkspace = false,
  onProgress = () => {},
} = {}) => {
  const runRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-golden-path-bootstrap-"),
  );
  const projectName = "signal-relay-bootstrap";
  const projectDir = path.join(runRoot, "workspace", projectName);
  const packDir = path.join(runRoot, "packages");
  const commands = [];
  let registry;
  let managedDevStarted = false;
  let managedDevProcessId = null;
  const port = await reserveLoopbackPort();
  const registryUrl = `http://127.0.0.1:${port}`;
  const commandEnv = {
    ...process.env,
    CI: process.env.CI ?? "1",
    NO_UPDATE_NOTIFIER: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    npm_config_audit: "false",
    npm_config_registry: registryUrl,
  };
  delete commandEnv.npm_config_reporter;

  const run = (id, command, args, cwd = repoRoot) => {
    onProgress(id);
    const startedAt = Date.now();
    const result = spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      env: commandEnv,
      maxBuffer: commandMaxBuffer,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = String(result.stdout ?? "");
    const stderr = String(result.stderr ?? "");
    const normalizedStdout = normalizeOutput(stdout, runRoot);
    const normalizedStderr = normalizeOutput(stderr, runRoot);
    commands.push({
      id,
      exitCode: result.status,
      durationMs: Date.now() - startedAt,
      stdoutSha256: sha256(normalizedStdout),
      stderrSha256: sha256(normalizedStderr),
    });
    if (result.status !== 0) {
      throw new Error(
        `${id} failed with exit code ${result.status}.\n${normalizedStdout}\n${normalizedStderr}`,
      );
    }
    return stdout;
  };

  try {
    fs.mkdirSync(packDir, { recursive: true });
    for (const packageFilter of [
      "@air-jam/sdk",
      "@air-jam/mcp-server",
      "@air-jam/server",
      "@air-jam/cli",
      "create-airjam",
    ]) {
      run(
        `build:${packageFilter}`,
        "pnpm",
        ["--filter", packageFilter, "build"],
        repoRoot,
      );
    }

    const tarballs = new Map();
    const packageSizes = {};
    for (const packageDefinition of resolvePublicPackages()) {
      const packageDir = path.join(
        repoRoot,
        packageDefinition.workingDirectory,
      );
      const output = run(
        `pack:${packageDefinition.packageName}`,
        "pnpm",
        ["pack", "--pack-destination", packDir],
        packageDir,
      );
      const tarballPath = findPackedTarball({ output, packageDir });
      tarballs.set(packageDefinition.packageName, tarballPath);
      packageSizes[packageDefinition.packageName] =
        fs.statSync(tarballPath).size;
    }

    onProgress("registry:start");
    registry = await startCandidateRegistry({ runRoot, port });
    await configureRunScopedRegistryAuth({
      registryUrl: registry.registryUrl,
      runRoot,
      commandEnv,
    });
    for (const packageDefinition of resolvePublicPackages()) {
      run(`publish:${packageDefinition.packageName}`, "npm", [
        "publish",
        tarballs.get(packageDefinition.packageName),
        "--registry",
        registry.registryUrl,
        "--access",
        "public",
        "--ignore-scripts",
      ]);
    }

    fs.mkdirSync(path.dirname(projectDir), { recursive: true });
    const version = resolvePublicPackages()[0].version;
    run(
      "scaffold:create",
      "pnpm",
      ["dlx", `create-airjam@${version}`, projectName, "--template", template],
      path.dirname(projectDir),
    );
    const packageJson = assertRegistrySafeProject({
      projectDir,
      registryUrl: registry.registryUrl,
    });

    run("discover:cli", "pnpm", ["exec", "airjam", "--help"], projectDir);
    run("discover:dev", "pnpm", ["run", "dev", "--", "--help"], projectDir);
    run(
      "discover:session",
      "pnpm",
      ["exec", "airjam", "session", "--help"],
      projectDir,
    );
    run(
      "discover:release",
      "pnpm",
      ["exec", "airjam", "release", "--help"],
      projectDir,
    );
    const doctor = JSON.parse(
      run(
        "discover:mcp-doctor",
        "pnpm",
        ["exec", "airjam", "mcp", "doctor", "--dir", ".", "--json"],
        projectDir,
      ),
    );
    const codexProfile = JSON.parse(
      run(
        "discover:codex-profile",
        "pnpm",
        [
          "exec",
          "airjam",
          "mcp",
          "config",
          "--profile",
          "codex",
          "--dir",
          ".",
          "--json",
        ],
        projectDir,
      ),
    );
    if (
      doctor.projectMode !== "standalone-game" ||
      !doctor.package?.dependencyPresent ||
      !doctor.portableDeclaration?.present
    ) {
      throw new Error("Generated MCP doctor did not report a ready project.");
    }
    if (
      codexProfile.profile !== "codex" ||
      codexProfile.scope !== "project" ||
      !codexProfile.content?.includes("[mcp_servers.airjam]")
    ) {
      throw new Error("Generated Codex MCP profile is not project-scoped.");
    }
    onProgress("discover:mcp-protocol");
    const mcp = await verifyMcpProtocol({
      projectDir,
      env: commandEnv,
    });

    const devStarted = JSON.parse(
      run(
        "lifecycle:dev-start",
        "pnpm",
        ["exec", "airjam", "dev", "start", "--dir", "."],
        projectDir,
      ),
    );
    managedDevStarted = true;
    managedDevProcessId = devStarted.process?.id ?? null;
    const devStatus = JSON.parse(
      run(
        "lifecycle:status",
        "pnpm",
        ["exec", "airjam", "status", "--dir", "."],
        projectDir,
      ),
    );
    if (
      typeof managedDevProcessId !== "string" ||
      !Array.isArray(devStatus.processes) ||
      !devStatus.processes.some((entry) => entry.id === managedDevProcessId)
    ) {
      throw new Error(
        "Generated dev start/status did not expose one managed process.",
      );
    }
    const devStopped = JSON.parse(
      run(
        "lifecycle:dev-stop",
        "pnpm",
        ["exec", "airjam", "dev", "stop", "--dir", "."],
        projectDir,
      ),
    );
    if (
      !Array.isArray(devStopped.stopped) ||
      !devStopped.stopped.some((entry) => entry.id === managedDevProcessId)
    ) {
      throw new Error("Generated dev stop did not close its managed process.");
    }
    managedDevStarted = false;

    run("quality:typecheck", "pnpm", ["typecheck"], projectDir);
    run("quality:test", "pnpm", ["test"], projectDir);
    run("quality:build", "pnpm", ["build"], projectDir);

    const installedVersions = inspectInstalledAirJamVersions(projectDir);
    return {
      ok: true,
      contract: "air-jam-golden-path-bootstrap/v1",
      template,
      packageVersion: version,
      registry: {
        kind: "run-scoped-loopback-verdaccio",
        upstream: "https://registry.npmjs.org/",
        airJamPackagesProxied: false,
        published: resolvePublicPackages().map((entry) => ({
          name: entry.packageName,
          tarballBytes: packageSizes[entry.packageName],
        })),
      },
      isolation: {
        forbiddenSpecsAbsent: true,
        monorepoPathsAbsent: true,
        workspaceRetained: keepWorkspace,
      },
      project: {
        name: packageJson.name,
        scripts: ["dev", "status", "reset:local", "mcp"].filter(
          (script) => typeof packageJson.scripts?.[script] === "string",
        ),
        installedVersions,
      },
      discovery: {
        portableMcp: doctor.portableDeclaration.present,
        codexProjectProfile: true,
        mcpServer: mcp.serverInfo,
        mcpTools: mcp.tools,
      },
      lifecycle: {
        managedDevStart: "passed",
        managedDevStatus: "passed",
        managedDevStop: "passed",
      },
      quality: {
        typecheck: "passed",
        tests: "passed",
        build: "passed",
      },
      commands,
      retainedWorkspace: keepWorkspace ? runRoot : null,
    };
  } finally {
    if (managedDevStarted && fs.existsSync(projectDir)) {
      spawnSync("pnpm", ["exec", "airjam", "dev", "stop", "--dir", "."], {
        cwd: projectDir,
        env: commandEnv,
        stdio: "ignore",
      });
    }
    if (registry) await stopChild(registry.child);
    fs.rmSync(path.join(runRoot, "registry"), {
      recursive: true,
      force: true,
    });
    if (!keepWorkspace) {
      fs.rmSync(runRoot, { recursive: true, force: true });
    }
  }
};
