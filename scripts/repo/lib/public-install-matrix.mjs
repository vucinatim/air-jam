import crossSpawn from "cross-spawn";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolvePublicPackages } from "../../release/public-packages.mjs";
import { runGoldenPathBootstrap } from "./golden-path-bootstrap.mjs";
import { repoRoot } from "./paths.mjs";

export const defaultPublicInstallMatrixPath = path.join(
  repoRoot,
  "scripts/repo/programs/public-install-matrix.json",
);

const matrixCellContract = "air-jam-public-install-matrix-cell/v1";
const matrixAggregateContract = "air-jam-public-install-matrix-aggregate/v1";
const scaffoldResourceBudgetsRelativePath =
  "packages/create-airjam/scaffold-resource-budgets.json";

const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
};

const assertUniqueStrings = (value, label) => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "string" || entry.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must contain unique non-empty strings.`);
  }
  return value;
};

const assertPositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
};

const sortStrings = (values) =>
  [...values].sort((left, right) => left.localeCompare(right));

export const readScaffoldResourceBudgets = () => {
  const document = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, scaffoldResourceBudgetsRelativePath),
      "utf8",
    ),
  );
  if (document.schemaVersion !== 1) {
    throw new Error("Scaffold resource budget schemaVersion must be 1.");
  }
  const archive = assertObject(document.archive, "Scaffold archive budgets");
  for (const key of [
    "maxCompressedBytes",
    "maxEntries",
    "maxTotalUncompressedBytes",
    "maxSingleFileUncompressedBytes",
  ]) {
    assertPositiveInteger(archive[key], `Scaffold archive budgets.${key}`);
  }
  if (
    typeof archive.maxCompressionRatio !== "number" ||
    !Number.isFinite(archive.maxCompressionRatio) ||
    archive.maxCompressionRatio <= 0
  ) {
    throw new Error(
      "Scaffold archive budgets.maxCompressionRatio must be positive.",
    );
  }
  return document;
};

export const readPublicInstallMatrix = (
  manifestPath = defaultPublicInstallMatrixPath,
) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validatePublicInstallMatrix(manifest);
  return manifest;
};

export const validatePublicInstallMatrix = (manifest) => {
  assertObject(manifest, "Public install matrix");
  if (manifest.schemaVersion !== 1) {
    throw new Error("Public install matrix schemaVersion must be 1.");
  }
  if (manifest.contract !== "air-jam-public-install-matrix/v1") {
    throw new Error(
      "Public install matrix contract must be air-jam-public-install-matrix/v1.",
    );
  }
  if (manifest.source?.kind !== "candidate-isolated-registry") {
    throw new Error(
      "Public install matrix must use the candidate isolated registry.",
    );
  }
  if (manifest.source?.airJamFallback !== false) {
    throw new Error(
      "Public install matrix must disable Air Jam package fallback.",
    );
  }

  const support = assertObject(manifest.support, "support");
  if (
    !Array.isArray(support.nodeMajors) ||
    support.nodeMajors.length === 0 ||
    support.nodeMajors.some((entry) => !Number.isInteger(entry) || entry < 1) ||
    new Set(support.nodeMajors).size !== support.nodeMajors.length
  ) {
    throw new Error(
      "support.nodeMajors must contain unique positive integers.",
    );
  }
  if (
    !Array.isArray(support.operatingSystems) ||
    support.operatingSystems.length === 0
  ) {
    throw new Error(
      "support.operatingSystems must contain at least one operating system.",
    );
  }
  const osIds = new Set();
  const nodePlatforms = new Set();
  for (const [index, entry] of support.operatingSystems.entries()) {
    assertObject(entry, `support.operatingSystems[${index}]`);
    for (const key of ["id", "nodePlatform", "githubRunner"]) {
      if (typeof entry[key] !== "string" || entry[key].length === 0) {
        throw new Error(
          `support.operatingSystems[${index}].${key} must be a non-empty string.`,
        );
      }
    }
    if (osIds.has(entry.id) || nodePlatforms.has(entry.nodePlatform)) {
      throw new Error(
        "Support operating-system ids and Node platforms must be unique.",
      );
    }
    osIds.add(entry.id);
    nodePlatforms.add(entry.nodePlatform);
  }

  const expectedPackages = resolvePublicPackages().map(
    (entry) => entry.packageName,
  );
  const packages = assertUniqueStrings(manifest.packages, "packages");
  if (
    JSON.stringify(sortStrings(packages)) !==
    JSON.stringify(sortStrings(expectedPackages))
  ) {
    throw new Error(
      "Public install matrix packages must exactly match the canonical public package graph.",
    );
  }

  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  if (manifest.toolchain?.packageManager !== rootPackage.packageManager) {
    throw new Error(
      "Public install matrix packageManager must match the repository packageManager.",
    );
  }
  if (
    !String(manifest.toolchain?.bootstrap ?? "").startsWith(
      "npx --yes create-airjam@",
    )
  ) {
    throw new Error(
      "Public install matrix must exercise the documented npx create-airjam bootstrap.",
    );
  }

  assertUniqueStrings(
    manifest.scaffold?.requiredScripts,
    "scaffold.requiredScripts",
  );
  assertUniqueStrings(
    manifest.scaffold?.requiredMcpTools,
    "scaffold.requiredMcpTools",
  );
  if (
    typeof manifest.scaffold?.template !== "string" ||
    manifest.scaffold.template.length === 0
  ) {
    throw new Error("scaffold.template must be a non-empty string.");
  }
  if (
    manifest.scaffold.resourceBudgetsFile !==
    scaffoldResourceBudgetsRelativePath
  ) {
    throw new Error(
      `scaffold.resourceBudgetsFile must be ${scaffoldResourceBudgetsRelativePath}.`,
    );
  }
  readScaffoldResourceBudgets();

  const budgets = assertObject(manifest.budgets, "budgets");
  const tarballBudgets = assertObject(
    budgets.tarballBytes,
    "budgets.tarballBytes",
  );
  if (
    JSON.stringify(sortStrings(Object.keys(tarballBudgets))) !==
    JSON.stringify(sortStrings(expectedPackages))
  ) {
    throw new Error(
      "Tarball budgets must exactly cover the canonical public package graph.",
    );
  }
  for (const packageName of expectedPackages) {
    assertPositiveInteger(
      tarballBudgets[packageName],
      `budgets.tarballBytes[${packageName}]`,
    );
  }
  assertPositiveInteger(budgets.totalTarballBytes, "budgets.totalTarballBytes");
  assertPositiveInteger(budgets.scaffoldInstallMs, "budgets.scaffoldInstallMs");
  assertPositiveInteger(budgets.cellTotalMs, "budgets.cellTotalMs");

  return manifest;
};

export const summarizePublicInstallMatrix = (manifest) => {
  const scaffoldResourceBudgets = readScaffoldResourceBudgets();
  return {
    id: manifest.id,
    contract: manifest.contract,
    source: manifest.source,
    packages: manifest.packages,
    toolchain: manifest.toolchain,
    scaffold: {
      ...manifest.scaffold,
      resourceBudgets: scaffoldResourceBudgets,
    },
    budgets: manifest.budgets,
    cells: manifest.support.operatingSystems.flatMap((operatingSystem) =>
      manifest.support.nodeMajors.map((nodeMajor) => ({
        id: `${operatingSystem.id}-node-${nodeMajor}`,
        operatingSystem: operatingSystem.id,
        nodePlatform: operatingSystem.nodePlatform,
        githubRunner: operatingSystem.githubRunner,
        nodeMajor,
      })),
    ),
  };
};

const resolveObservedCell = (manifest) => {
  const operatingSystem = manifest.support.operatingSystems.find(
    (entry) => entry.nodePlatform === process.platform,
  );
  if (!operatingSystem) {
    throw new Error(
      `Unsupported operating system platform ${process.platform}.`,
    );
  }
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!manifest.support.nodeMajors.includes(nodeMajor)) {
    throw new Error(`Unsupported Node.js major ${nodeMajor}.`);
  }
  return {
    id: `${operatingSystem.id}-node-${nodeMajor}`,
    operatingSystem: operatingSystem.id,
    nodePlatform: operatingSystem.nodePlatform,
    githubRunner: operatingSystem.githubRunner,
    nodeMajor,
  };
};

export const readCommandVersion = (command, args) => {
  const result = crossSpawn.sync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const detail =
      String(result.stderr ?? "").trim() ||
      result.error?.message ||
      `exit code ${String(result.status)}`;
    throw new Error(`Unable to read ${command} version: ${detail}`);
  }
  return String(result.stdout ?? "").trim();
};

const resolveCleanCommit = () => {
  const status = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  ).trim();
  if (status) {
    throw new Error(
      `Public install matrix evidence requires a clean tracked worktree:\n${status}`,
    );
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const commit = process.env.GITHUB_SHA || head;
  if (!/^[a-f0-9]{40}$/u.test(commit) || commit !== head) {
    throw new Error(
      `Public install matrix commit ${commit} does not match checked-out HEAD ${head}.`,
    );
  }
  return commit;
};

const assertExpectedCell = ({
  cell,
  expectedOperatingSystem,
  expectedNodeMajor,
}) => {
  if (
    expectedOperatingSystem &&
    cell.operatingSystem !== expectedOperatingSystem
  ) {
    throw new Error(
      `Observed operating system ${cell.operatingSystem}; expected ${expectedOperatingSystem}.`,
    );
  }
  if (expectedNodeMajor && cell.nodeMajor !== expectedNodeMajor) {
    throw new Error(
      `Observed Node.js ${cell.nodeMajor}; expected ${expectedNodeMajor}.`,
    );
  }
};

const enforceBudgets = ({ manifest, bootstrap, totalDurationMs }) => {
  const packages = bootstrap.registry.published;
  const observedNames = packages.map((entry) => entry.name);
  if (
    JSON.stringify(sortStrings(observedNames)) !==
    JSON.stringify(sortStrings(manifest.packages))
  ) {
    throw new Error(
      "Bootstrap evidence does not cover the exact public package graph.",
    );
  }

  const packageResults = packages.map((entry) => {
    const maximumBytes = manifest.budgets.tarballBytes[entry.name];
    if (entry.tarballBytes > maximumBytes) {
      throw new Error(
        `${entry.name} tarball is ${entry.tarballBytes} bytes; budget is ${maximumBytes} bytes.`,
      );
    }
    return {
      name: entry.name,
      observedBytes: entry.tarballBytes,
      maximumBytes,
      remainingBytes: maximumBytes - entry.tarballBytes,
    };
  });
  const totalTarballBytes = packages.reduce(
    (total, entry) => total + entry.tarballBytes,
    0,
  );
  if (totalTarballBytes > manifest.budgets.totalTarballBytes) {
    throw new Error(
      `Public package graph is ${totalTarballBytes} bytes; budget is ${manifest.budgets.totalTarballBytes} bytes.`,
    );
  }

  const scaffoldCommand = bootstrap.commands.find(
    (entry) => entry.id === "scaffold:create",
  );
  if (!scaffoldCommand) {
    throw new Error("Bootstrap evidence is missing scaffold:create timing.");
  }
  if (scaffoldCommand.durationMs > manifest.budgets.scaffoldInstallMs) {
    throw new Error(
      `Scaffold install took ${scaffoldCommand.durationMs}ms; budget is ${manifest.budgets.scaffoldInstallMs}ms.`,
    );
  }
  if (totalDurationMs > manifest.budgets.cellTotalMs) {
    throw new Error(
      `Matrix cell took ${totalDurationMs}ms; budget is ${manifest.budgets.cellTotalMs}ms.`,
    );
  }

  return {
    packages: packageResults,
    totalTarballBytes: {
      observed: totalTarballBytes,
      maximum: manifest.budgets.totalTarballBytes,
    },
    scaffoldInstallMs: {
      observed: scaffoldCommand.durationMs,
      maximum: manifest.budgets.scaffoldInstallMs,
    },
    cellTotalMs: {
      observed: totalDurationMs,
      maximum: manifest.budgets.cellTotalMs,
    },
  };
};

export const writeJsonAtomically = (outputPath, value) => {
  const absolutePath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (fs.existsSync(absolutePath)) {
    throw new Error(`Refusing to replace existing evidence: ${absolutePath}`);
  }
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
  fs.renameSync(temporaryPath, absolutePath);
  return absolutePath;
};

export const runPublicInstallMatrixCell = async ({
  manifestPath = defaultPublicInstallMatrixPath,
  expectedOperatingSystem,
  expectedNodeMajor,
  onProgress = () => {},
} = {}) => {
  const manifest = readPublicInstallMatrix(manifestPath);
  const cell = resolveObservedCell(manifest);
  assertExpectedCell({ cell, expectedOperatingSystem, expectedNodeMajor });
  const commit = resolveCleanCommit();
  const startedAt = Date.now();
  const bootstrap = await runGoldenPathBootstrap({
    template: manifest.scaffold.template,
    bootstrapClient: "npx",
    onProgress,
  });
  const totalDurationMs = Date.now() - startedAt;
  const budgets = enforceBudgets({ manifest, bootstrap, totalDurationMs });
  const verifiedCommit = resolveCleanCommit();
  if (verifiedCommit !== commit) {
    throw new Error(
      `Public install matrix HEAD changed from ${commit} to ${verifiedCommit} during verification.`,
    );
  }

  return {
    ok: true,
    contract: matrixCellContract,
    matrix: manifest.id,
    source: manifest.source,
    commit,
    cell,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      release: os.release(),
      node: process.versions.node,
      pnpm: readCommandVersion("pnpm", ["--version"]),
      npm: readCommandVersion("npm", ["--version"]),
      runner: {
        name: process.env.RUNNER_NAME ?? null,
        os: process.env.RUNNER_OS ?? null,
        architecture: process.env.RUNNER_ARCH ?? null,
        imageOs: process.env.ImageOS ?? null,
        imageVersion: process.env.ImageVersion ?? null,
      },
    },
    scaffoldResourceBudgets: readScaffoldResourceBudgets(),
    budgets,
    proof: bootstrap,
  };
};

export const aggregatePublicInstallMatrixEvidence = ({
  evidenceRoot,
  manifestPath = defaultPublicInstallMatrixPath,
}) => {
  const manifest = readPublicInstallMatrix(manifestPath);
  const summary = summarizePublicInstallMatrix(manifest);
  const evidenceFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        evidenceFiles.push(absolutePath);
    }
  };
  visit(path.resolve(evidenceRoot));

  const cells = evidenceFiles.map((filePath) => {
    const evidence = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (evidence.contract !== matrixCellContract || evidence.ok !== true) {
      throw new Error(
        `${filePath} is not passing ${matrixCellContract} evidence.`,
      );
    }
    if (evidence.matrix !== manifest.id) {
      throw new Error(`${filePath} belongs to a different install matrix.`);
    }
    if (
      JSON.stringify(evidence.scaffoldResourceBudgets) !==
      JSON.stringify(summary.scaffold.resourceBudgets)
    ) {
      throw new Error(
        `${filePath} does not prove the canonical scaffold resource budgets.`,
      );
    }
    return evidence;
  });
  const cellsById = new Map();
  for (const evidence of cells) {
    if (cellsById.has(evidence.cell.id)) {
      throw new Error(
        `Duplicate evidence for matrix cell ${evidence.cell.id}.`,
      );
    }
    cellsById.set(evidence.cell.id, evidence);
  }
  const expectedIds = summary.cells.map((entry) => entry.id);
  const missing = expectedIds.filter((id) => !cellsById.has(id));
  const unexpected = [...cellsById.keys()].filter(
    (id) => !expectedIds.includes(id),
  );
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Install matrix evidence mismatch. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }
  const commits = new Set(cells.map((entry) => entry.commit));
  if (commits.size !== 1) {
    throw new Error("Install matrix cells do not prove one exact commit.");
  }

  return {
    ok: true,
    contract: matrixAggregateContract,
    matrix: manifest.id,
    commit: [...commits][0],
    source: manifest.source,
    scaffoldResourceBudgets: summary.scaffold.resourceBudgets,
    cells: expectedIds.map((id) => {
      const evidence = cellsById.get(id);
      return {
        id,
        environment: evidence.environment,
        budgets: evidence.budgets,
        packageVersion: evidence.proof.packageVersion,
        mcpToolCount: evidence.proof.discovery.mcpTools.length,
        quality: evidence.proof.quality,
      };
    }),
  };
};
