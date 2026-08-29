import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolvePublicPackages } from "../../release/public-packages.mjs";
import {
  prepareGoldenPathCandidateRegistry,
  reserveLoopbackPort,
  stopChild,
} from "./golden-path-bootstrap.mjs";
import {
  defaultGoldenPathManifestPath,
  readGoldenPathProgram,
  validateGoldenPathProgram,
} from "./golden-path-program.mjs";
import { repoRoot } from "./paths.mjs";

const evidenceFormat = "air-jam-golden-path-evidence/v1";
const commandMaxBuffer = 64 * 1024 * 1024;
const runIdPattern = /^[a-z0-9][a-z0-9-]{5,47}$/u;
const initialQualityCommands = ["typecheck", "lint", "test", "build"];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const writeJson = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
};

const writeJsonAtomic = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, targetPath);
};

const writeText = (targetPath, value) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
};

const normalizeEvidenceText = (value, { runRoot, registryUrl }) =>
  String(value ?? "")
    .replaceAll(repoRoot, "<repo>")
    .replaceAll(runRoot, "<run>")
    .replaceAll(os.homedir(), "<home>")
    .replaceAll(registryUrl, "<candidate-registry>")
    .replace(/(^|\n)([^\n]*:_authToken=)[^\n]+/gu, "$1$2<redacted>")
    .replace(/(authorization:\s*bearer\s+)[^\s"']+/giu, "$1<redacted>")
    .replace(/([?&](?:token|code|secret|key)=)[^&\s"']+/giu, "$1<redacted>");

const defaultRunId = () => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "z")
    .toLowerCase();
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
};

const assertRunId = (runId) => {
  if (!runIdPattern.test(runId)) {
    throw new Error(
      "--run-id must be 6-48 lowercase letters, digits, or hyphens and start with a letter or digit.",
    );
  }
};

const assertIsolatedStagingUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  const isLoopback = hostname === "127.0.0.1" || hostname === "localhost";
  const isNamedStaging =
    hostname.includes("staging") || /(?:^|-)pr-\d+(?:\.|-)/u.test(hostname);
  if (url.protocol !== "https:" && !isLoopback) {
    throw new Error("The staging URL must use HTTPS unless it is loopback.");
  }
  if (!isLoopback && !isNamedStaging) {
    throw new Error(
      "The staging URL must be visibly isolated through a staging or PR hostname.",
    );
  }
  return url.toString().replace(/\/$/u, "");
};

const substitutePrompt = ({
  source,
  candidateVersion,
  runId,
  stagingUrl,
  evidenceDir,
}) =>
  source
    .replaceAll("{{candidateVersion}}", candidateVersion)
    .replaceAll("{{runId}}", runId)
    .replaceAll("{{stagingPlatformUrl}}", stagingUrl)
    .replaceAll("{{evidenceDir}}", evidenceDir);

const collectToolchain = ({ codexVersion, registryUrl }) => ({
  capturedAt: new Date().toISOString(),
  operatingSystem: `${os.platform()} ${os.release()}`,
  architecture: os.arch(),
  node: process.version,
  corepack:
    spawnSync("corepack", ["--version"], { encoding: "utf8" }).stdout?.trim() ??
    null,
  pnpm:
    spawnSync("pnpm", ["--version"], { encoding: "utf8" }).stdout?.trim() ??
    null,
  git:
    spawnSync("git", ["--version"], { encoding: "utf8" }).stdout?.trim() ??
    null,
  codex: codexVersion,
  browserAvailability: "not-attested-by-controller",
  registry: registryUrl,
  packageManagerCache: "run-scoped-empty",
});

const readGitState = (projectDir) => {
  if (!fs.existsSync(path.join(projectDir, ".git"))) return null;
  const commit = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  const status = spawnSync("git", ["status", "--porcelain=v1"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : null,
    status:
      status.status === 0
        ? status.stdout.trim().split(/\r?\n/u).filter(Boolean)
        : [],
  };
};

const listEvidenceFiles = (rootDir, currentDir = rootDir) => {
  if (!fs.existsSync(currentDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listEvidenceFiles(rootDir, absolutePath));
    } else if (entry.isFile()) {
      files.push(
        path.relative(rootDir, absolutePath).replaceAll(path.sep, "/"),
      );
    }
  }
  return files.sort();
};

const indexEvidenceFiles = (evidenceDir) =>
  listEvidenceFiles(evidenceDir)
    .filter((relativePath) => relativePath !== "manifest.json")
    .map((relativePath) => {
      const absolutePath = path.join(evidenceDir, relativePath);
      const value = fs.readFileSync(absolutePath);
      return {
        path: relativePath,
        mediaType: relativePath.endsWith(".json")
          ? "application/json"
          : relativePath.endsWith(".ndjson")
            ? "application/x-ndjson"
            : relativePath.endsWith(".md")
              ? "text/markdown"
              : "application/octet-stream",
        bytes: value.byteLength,
        sha256: sha256(value),
      };
    });

const detectQualityCommand = (command) => {
  const detected = [];
  for (const qualityCommand of initialQualityCommands) {
    const pattern = new RegExp(
      `(?:pnpm(?:\\s+run)?|npm\\s+run|yarn)\\s+${qualityCommand}(?:\\s|$|[;&|])`,
      "u",
    );
    if (pattern.test(command)) detected.push(qualityCommand);
  }
  return detected;
};

const isControlCheckpointEvent = (event) => {
  if (event.type !== "item.completed") return false;
  if (event.item?.type === "command_execution" && event.item.exit_code === 0) {
    return /(?:^|\s)airjam\s+session\s+close(?:\s|$)/u.test(
      event.item.command ?? "",
    );
  }
  if (event.item?.type !== "mcp_tool_call") return false;
  return /(?:^|[._])close_game_session$/u.test(
    event.item.tool_name ?? event.item.name ?? "",
  );
};

const permissionProfileName = "airjamGoldenPath";

const tomlInlineStringMap = (value) =>
  `{${Object.entries(value)
    .map(([key, entry]) => `${JSON.stringify(key)}=${JSON.stringify(entry)}`)
    .join(",")}}`;

export const buildCodexPermissionArgs = ({ stagingUrl, runRoot }) => {
  const stagingHostname = new URL(stagingUrl).hostname;
  const networkDomains = {
    "127.0.0.1": "allow",
    localhost: "allow",
    [stagingHostname]: "allow",
  };
  const filesystem = {
    [repoRoot]: "deny",
  };
  const writableRoots = [
    "evidence",
    "state",
    "cache",
    "npm-cache",
    "pnpm-store",
  ].map((directory) => path.join(runRoot, directory));

  return {
    args: [
      "--enable",
      "network_proxy",
      "--config",
      'approval_policy="never"',
      "--config",
      `default_permissions=${JSON.stringify(permissionProfileName)}`,
      "--config",
      "allow_login_shell=false",
      "--config",
      `permissions.${permissionProfileName}.extends=\":workspace\"`,
      "--config",
      `permissions.${permissionProfileName}.filesystem=${tomlInlineStringMap(filesystem)}`,
      "--config",
      `permissions.${permissionProfileName}.network.enabled=true`,
      "--config",
      `permissions.${permissionProfileName}.network.mode=\"full\"`,
      "--config",
      `permissions.${permissionProfileName}.network.allow_local_binding=true`,
      "--config",
      `permissions.${permissionProfileName}.network.domains=${tomlInlineStringMap(networkDomains)}`,
      ...writableRoots.flatMap((root) => ["--add-dir", root]),
    ],
    profile: {
      name: permissionProfileName,
      base: ":workspace",
      loginShellAllowed: false,
      deniedReadRoots: ["<repo>"],
      writableRoots: writableRoots.map((root) =>
        normalizeEvidenceText(root, {
          runRoot,
          registryUrl: "<candidate-registry>",
        }),
      ),
      network: {
        managedProxy: true,
        mode: "full",
        allowLocalBinding: true,
        allowedDomains: Object.keys(networkDomains),
      },
    },
  };
};

export const buildGoldenPathCommandEnv = ({
  stagingUrl,
  runRoot,
  registryUrl,
  sourceEnv = process.env,
}) => {
  const safePath = [
    ...(sourceEnv.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin").split(
      path.delimiter,
    ),
    path.dirname(process.execPath),
  ]
    .filter(
      (entry) =>
        entry &&
        (!entry.startsWith(os.homedir()) ||
          entry === path.dirname(process.execPath)) &&
        fs.existsSync(entry),
    )
    .sort((left, right) => {
      const runtimeBin = path.dirname(process.execPath);
      if (left === runtimeBin && right !== runtimeBin) return 1;
      if (right === runtimeBin && left !== runtimeBin) return -1;
      return 0;
    })
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .join(path.delimiter);

  return {
    PATH: safePath,
    HOME: os.homedir(),
    USER: sourceEnv.USER ?? os.userInfo().username,
    LOGNAME: sourceEnv.LOGNAME ?? os.userInfo().username,
    SHELL: sourceEnv.SHELL ?? "/bin/zsh",
    TMPDIR: os.tmpdir(),
    LANG: sourceEnv.LANG ?? "en_US.UTF-8",
    TERM: sourceEnv.TERM ?? "dumb",
    AIRJAM_PLATFORM_URL: stagingUrl,
    AIRJAM_STATE_DIR: path.join(runRoot, "state"),
    CI: sourceEnv.CI ?? "1",
    NO_UPDATE_NOTIFIER: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    COREPACK_HOME: path.join(runRoot, "cache", "corepack"),
    XDG_CACHE_HOME: path.join(runRoot, "cache"),
    npm_config_audit: "false",
    npm_config_cache: path.join(runRoot, "npm-cache"),
    npm_config_registry: registryUrl,
    pnpm_config_store_dir: path.join(runRoot, "pnpm-store"),
  };
};

const injectDeclaredFault = ({
  projectDir,
  evidenceDir,
  runRoot,
  registryUrl,
}) => {
  const rulesPath = path.join(projectDir, "src", "game", "domain", "rules.ts");
  if (!fs.existsSync(rulesPath)) return null;
  const before = fs.readFileSync(rulesPath, "utf8");
  const match = before.match(/export const WIN_SCORE\s*=\s*3\s*;/u);
  if (!match) return null;
  const after = before.replace(match[0], "export const WIN_SCORE = 2;");
  fs.writeFileSync(rulesPath, after);
  const record = {
    id: "declared-win-score-fault",
    classification: "harness",
    injectedAt: new Date().toISOString(),
    target:
      "<run>/workspace/" +
      path.basename(projectDir) +
      "/src/game/domain/rules.ts",
    beforeSha256: sha256(
      normalizeEvidenceText(before, { runRoot, registryUrl }),
    ),
    afterSha256: sha256(normalizeEvidenceText(after, { runRoot, registryUrl })),
    mutation: "WIN_SCORE:3->2",
  };
  writeJson(
    path.join(evidenceDir, "failures", "declared-win-score-fault.json"),
    record,
  );
  return record;
};

const verifyPrimaryRun = ({
  program,
  evidenceDir,
  projectDir,
  fault,
  codexExitCode,
  postFaultQuality,
  runRoot,
  registryUrl,
}) => {
  const failures = [];
  for (const relativePath of program.evidenceBundle.requiredPaths) {
    if (
      relativePath === "manifest.json" ||
      relativePath === "verifier/report.json"
    ) {
      continue;
    }
    if (!fs.existsSync(path.join(evidenceDir, relativePath))) {
      failures.push({ code: "missing_evidence", path: relativePath });
    }
  }
  if (!fs.existsSync(projectDir)) {
    failures.push({ code: "missing_project", path: "workspace" });
  }
  const rulesPath = path.join(projectDir, "src", "game", "domain", "rules.ts");
  const rulesSource = fs.existsSync(rulesPath)
    ? fs.readFileSync(rulesPath, "utf8")
    : "";
  if (!/export const WIN_SCORE\s*=\s*3\s*;/u.test(rulesSource)) {
    failures.push({
      code: "win_score_not_repaired",
      path: "src/game/domain/rules.ts",
    });
  }
  if (!fault)
    failures.push({
      code: "declared_fault_not_injected",
      path: "failures/index.json",
    });
  for (const qualityCommand of initialQualityCommands) {
    if (!postFaultQuality.has(qualityCommand)) {
      failures.push({
        code: "post_fault_quality_not_observed",
        command: qualityCommand,
        path: "transcript/events.ndjson",
      });
    }
  }
  if (codexExitCode !== 0)
    failures.push({ code: "primary_agent_failed", exitCode: codexExitCode });

  const releaseIndexPath = path.join(evidenceDir, "release", "index.json");
  const releaseSource = fs.existsSync(releaseIndexPath)
    ? normalizeEvidenceText(fs.readFileSync(releaseIndexPath, "utf8"), {
        runRoot,
        registryUrl,
      })
    : "";
  const releaseAttested = /"status"\s*:\s*"(?:ready|published|passed)"/u.test(
    releaseSource,
  );
  if (!releaseAttested)
    failures.push({
      code: "hidden_release_not_attested",
      path: "release/index.json",
    });

  return {
    contract: evidenceFormat,
    scope: "codex-primary",
    verifiedAt: new Date().toISOString(),
    result: failures.length === 0 ? "passed" : "failed",
    failures,
    note: "This verifier certifies only the Codex primary lane. Claude Desktop remains independently owned by G2-04.",
  };
};

export const runGoldenPathPrimary = async ({
  runId = defaultRunId(),
  stagingUrl,
  keepWorkspace = true,
  model,
  onProgress = () => {},
} = {}) => {
  assertRunId(runId);
  if (!stagingUrl) throw new Error("--staging-url is required.");
  const normalizedStagingUrl = assertIsolatedStagingUrl(stagingUrl);
  const programState = readGoldenPathProgram(defaultGoldenPathManifestPath);
  validateGoldenPathProgram(programState);

  const artifactRoot = path.join(
    repoRoot,
    ".airjam",
    "golden-path-runs",
    runId,
  );
  if (fs.existsSync(artifactRoot))
    throw new Error(`Golden-path run already exists: ${runId}`);
  const runRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), `airjam-golden-path-${runId}-`)),
  );
  const workspaceDir = path.join(runRoot, "workspace");
  const projectName = `signal-relay-${runId}`;
  const projectDir = path.join(workspaceDir, projectName);
  const evidenceDir = path.join(runRoot, "evidence");
  const retainedEvidenceDir = path.join(artifactRoot, "evidence");
  const workspaceRelativeToRepo = path.relative(repoRoot, workspaceDir);
  const workspaceOutsideRepo =
    workspaceRelativeToRepo.startsWith("..") &&
    !path.isAbsolute(workspaceRelativeToRepo);
  if (!workspaceOutsideRepo) {
    throw new Error(
      "The golden-path workspace must be outside the Air Jam monorepo.",
    );
  }
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(retainedEvidenceDir, { recursive: true });
  for (const directory of ["state", "cache", "npm-cache", "pnpm-store"]) {
    fs.mkdirSync(path.join(runRoot, directory), { recursive: true });
  }

  const syncEvidence = () => {
    if (!fs.existsSync(evidenceDir)) return;
    fs.cpSync(evidenceDir, retainedEvidenceDir, {
      recursive: true,
      force: true,
    });
  };
  const bestEffortSyncEvidence = () => {
    try {
      syncEvidence();
    } catch {
      // A concurrent agent write can make a periodic snapshot transiently
      // unreadable. The next interval retries; explicit checkpoints stay strict.
    }
  };
  const writeDurableControllerState = (state, details = {}) => {
    writeJsonAtomic(path.join(artifactRoot, "controller.json"), {
      contract: evidenceFormat,
      runId,
      state,
      updatedAt: new Date().toISOString(),
      ...details,
    });
  };
  writeDurableControllerState("preparing");

  const registryPort = await reserveLoopbackPort();
  const registryUrl = `http://127.0.0.1:${registryPort}`;
  const commandEnv = buildGoldenPathCommandEnv({
    stagingUrl: normalizedStagingUrl,
    runRoot,
    registryUrl,
  });
  const controllerCommands = [];
  const runControllerCommand = (id, command, args, cwd = repoRoot) => {
    onProgress(id);
    const startedAt = new Date();
    const result = spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      env: commandEnv,
      maxBuffer: commandMaxBuffer,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = normalizeEvidenceText(result.stdout, {
      runRoot,
      registryUrl,
    });
    const stderr = normalizeEvidenceText(result.stderr, {
      runRoot,
      registryUrl,
    });
    const record = {
      id,
      actor: "run-controller",
      executable: command,
      arguments: args,
      workingDirectory: normalizeEvidenceText(cwd, { runRoot, registryUrl }),
      environmentNames: Object.keys(commandEnv).filter((name) =>
        /^(?:AIRJAM|CI$|NO_|FORCE_COLOR|npm_config_)/u.test(name),
      ),
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      exitCode: result.status,
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr),
      stdoutSha256: sha256(stdout),
      stderrSha256: sha256(stderr),
    };
    controllerCommands.push(record);
    if (result.status !== 0) {
      throw new Error(
        `${id} failed with exit code ${result.status}.\n${stdout}\n${stderr}`,
      );
    }
    return String(result.stdout ?? "");
  };

  let registry;
  let codexChild;
  let fault = null;
  let codexExitCode = null;
  let interruptedSignal = null;
  const handleSignal = (signal) => {
    interruptedSignal = signal;
    writeDurableControllerState("interrupted", { signal });
    bestEffortSyncEvidence();
    if (codexChild && codexChild.exitCode === null) codexChild.kill("SIGTERM");
  };
  const handleSigint = () => handleSignal("SIGINT");
  const handleSigterm = () => handleSignal("SIGTERM");
  process.once("SIGINT", handleSigint);
  process.once("SIGTERM", handleSigterm);
  const completedInitialQuality = new Set();
  const completedPostFaultQuality = new Set();
  let completedInitialControl = false;
  const transcriptPath = path.join(evidenceDir, "transcript", "events.ndjson");
  writeText(transcriptPath, "");
  syncEvidence();
  const evidenceSyncTimer = setInterval(bestEffortSyncEvidence, 1_000);
  evidenceSyncTimer.unref();

  try {
    const prepared = await prepareGoldenPathCandidateRegistry({
      runRoot,
      port: registryPort,
      commandEnv,
      run: runControllerCommand,
      onProgress,
    });
    registry = prepared.registry;

    const promptTemplate = fs.readFileSync(
      path.join(repoRoot, programState.promptTemplate),
      "utf8",
    );
    const agentPrompt = substitutePrompt({
      source: promptTemplate,
      candidateVersion: prepared.version,
      runId,
      stagingUrl: normalizedStagingUrl,
      evidenceDir,
    });
    writeText(
      path.join(evidenceDir, "inputs", "prompt.md"),
      normalizeEvidenceText(agentPrompt, { runRoot, registryUrl }),
    );
    writeJson(path.join(evidenceDir, "inputs", "scenario.json"), programState);
    const codexVersionResult = spawnSync("codex", ["--version"], {
      encoding: "utf8",
    });
    const codexVersion = codexVersionResult.stdout?.trim() || "unknown";
    const codexPermissions = buildCodexPermissionArgs({
      stagingUrl: normalizedStagingUrl,
      runRoot,
    });
    writeJson(
      path.join(evidenceDir, "environment", "toolchain.json"),
      collectToolchain({ codexVersion, registryUrl: "<candidate-registry>" }),
    );
    writeJson(path.join(evidenceDir, "environment", "isolation.json"), {
      runId,
      workspace: "<run>/workspace",
      evidenceDirectory: "<run>/evidence",
      stateDirectory: "<run>/state",
      candidateRegistry: "<candidate-registry>",
      airJamUpstreamFallback: false,
      stagingPlatform: normalizedStagingUrl,
      productionAllowed: false,
      arcadeVisibility: "hidden",
      privateRepositoryContextProvided: false,
      workspaceOutsideAirJamMonorepo: workspaceOutsideRepo,
      inheritedCredentialEnvironment: false,
      childAirJamRepositoryReadAccess: false,
      networkAllowlist: codexPermissions.profile.network.allowedDomains,
      localServerBindingAllowed: true,
      maintainerEditsAfterStart: ["declared-win-score-fault-only"],
    });
    writeJson(path.join(evidenceDir, "project", "git", "initial.json"), {
      capturedAt: new Date().toISOString(),
      state: "empty-workspace-before-primary-agent",
    });

    writeJson(
      path.join(evidenceDir, "environment", "codex-permissions.json"),
      codexPermissions.profile,
    );
    syncEvidence();

    const codexArgs = [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      ...codexPermissions.args,
      "--cd",
      workspaceDir,
      "--json",
      ...(model ? ["--model", model] : []),
      agentPrompt,
    ];
    onProgress("primary-agent:start");
    writeDurableControllerState("primary-agent-running");
    codexChild = spawn("codex", codexArgs, {
      cwd: workspaceDir,
      env: commandEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const appendTranscript = (entry) => {
      const record = `${JSON.stringify(entry)}\n`;
      fs.appendFileSync(transcriptPath, record);
      fs.appendFileSync(
        path.join(retainedEvidenceDir, "transcript", "events.ndjson"),
        record,
      );
    };
    const processLine = (line) => {
      if (!line.trim()) return;
      const normalized = normalizeEvidenceText(line, { runRoot, registryUrl });
      let event;
      try {
        event = JSON.parse(normalized);
      } catch {
        appendTranscript({ type: "primary-agent.stdout", text: normalized });
        return;
      }
      appendTranscript(event);
      if (
        event.type === "item.completed" &&
        event.item?.type === "command_execution" &&
        event.item.exit_code === 0
      ) {
        const qualityCommands = detectQualityCommand(event.item.command ?? "");
        for (const id of qualityCommands) {
          if (fault) completedPostFaultQuality.add(id);
          else completedInitialQuality.add(id);
        }
      }
      if (!fault && isControlCheckpointEvent(event)) {
        completedInitialControl = true;
      }
      if (
        !fault &&
        completedInitialControl &&
        initialQualityCommands.every((id) => completedInitialQuality.has(id))
      ) {
        fault = injectDeclaredFault({
          projectDir,
          evidenceDir,
          runRoot,
          registryUrl,
        });
        if (fault) {
          onProgress("controller:fault-injected");
          syncEvidence();
          appendTranscript({
            type: "controller.fault-injected",
            faultId: fault.id,
            timestamp: fault.injectedAt,
          });
        }
      }
    };
    codexChild.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      while (stdoutBuffer.includes("\n")) {
        const newline = stdoutBuffer.indexOf("\n");
        processLine(stdoutBuffer.slice(0, newline));
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
      }
    });
    codexChild.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
      while (stderrBuffer.includes("\n")) {
        const newline = stderrBuffer.indexOf("\n");
        const line = stderrBuffer.slice(0, newline);
        stderrBuffer = stderrBuffer.slice(newline + 1);
        if (line.trim()) {
          appendTranscript({
            type: "primary-agent.stderr",
            text: normalizeEvidenceText(line, { runRoot, registryUrl }),
          });
        }
      }
    });
    codexExitCode = await new Promise((resolve, reject) => {
      codexChild.once("error", reject);
      codexChild.once("exit", (code) => resolve(code ?? 1));
    });
    if (stdoutBuffer.trim()) processLine(stdoutBuffer);
    if (stderrBuffer.trim()) {
      appendTranscript({
        type: "primary-agent.stderr",
        text: normalizeEvidenceText(stderrBuffer, { runRoot, registryUrl }),
      });
    }
    onProgress(`primary-agent:exit:${codexExitCode}`);
    if (interruptedSignal) {
      fs.appendFileSync(
        transcriptPath,
        `${JSON.stringify({
          type: "controller.interrupted",
          signal: interruptedSignal,
          timestamp: new Date().toISOString(),
        })}\n`,
      );
    }

    writeJson(path.join(evidenceDir, "commands", "controller.json"), {
      records: controllerCommands,
    });
    writeJson(path.join(evidenceDir, "project", "git", "final.json"), {
      capturedAt: new Date().toISOString(),
      project: projectName,
      git: readGitState(projectDir),
    });
    const report = verifyPrimaryRun({
      program: programState,
      evidenceDir,
      projectDir,
      fault,
      codexExitCode,
      postFaultQuality: completedPostFaultQuality,
      runRoot,
      registryUrl,
    });
    writeJson(path.join(evidenceDir, "verifier", "report.json"), report);
    const manifest = {
      format: evidenceFormat,
      runId,
      scenarioId: programState.id,
      candidateVersions: Object.fromEntries(
        resolvePublicPackages().map((entry) => [
          entry.packageName,
          entry.version,
        ]),
      ),
      clients: { primary: { profile: "codex", version: codexVersion } },
      staging: {
        url: normalizedStagingUrl,
        productionAllowed: false,
        arcadeVisibility: "hidden",
      },
      startedAt: fs.statSync(transcriptPath).birthtime.toISOString(),
      endedAt: new Date().toISOString(),
      terminalResult: report.result,
      primaryAgentExitCode: codexExitCode,
      declaredFault: fault,
      projectGit: readGitState(projectDir),
      cleanup: {
        registry: "removed",
        credentials: "removed-with-registry-state",
        workspace: keepWorkspace ? "retained" : "removed-after-indexing",
        evidence: "retained",
      },
      files: indexEvidenceFiles(evidenceDir),
    };
    writeJson(path.join(evidenceDir, "manifest.json"), manifest);
    syncEvidence();
    writeDurableControllerState("complete", {
      terminalResult: report.result,
      primaryAgentExitCode: codexExitCode,
    });
    return {
      ok: report.result === "passed",
      contract: evidenceFormat,
      runId,
      result: report.result,
      failures: report.failures,
      evidenceDirectory: retainedEvidenceDir,
      workspace: keepWorkspace ? workspaceDir : null,
      primaryAgentExitCode: codexExitCode,
      declaredFaultInjected: Boolean(fault),
    };
  } catch (error) {
    syncEvidence();
    writeDurableControllerState("failed", {
      error: normalizeEvidenceText(
        error instanceof Error ? error.message : String(error),
        { runRoot, registryUrl },
      ),
    });
    throw error;
  } finally {
    clearInterval(evidenceSyncTimer);
    process.removeListener("SIGINT", handleSigint);
    process.removeListener("SIGTERM", handleSigterm);
    if (codexChild && codexChild.exitCode === null) await stopChild(codexChild);
    if (registry) await stopChild(registry.child);
    if (fs.existsSync(evidenceDir)) {
      syncEvidence();
    }
    fs.rmSync(path.join(runRoot, "registry"), { recursive: true, force: true });
    fs.rmSync(path.join(runRoot, "state"), { recursive: true, force: true });
    fs.rmSync(path.join(runRoot, "packages"), { recursive: true, force: true });
    fs.rmSync(evidenceDir, { recursive: true, force: true });
    if (!keepWorkspace) {
      fs.rmSync(runRoot, { recursive: true, force: true });
    }
  }
};
