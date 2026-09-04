import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  loadWorkspacePackageIndex,
  preparePublicPackageManifest,
} from "../../release/public-package-manifest.mjs";
import {
  resolvePublicPackages,
  resolveUnifiedPublicVersion,
} from "../../release/public-packages.mjs";
import { repoRoot } from "./paths.mjs";

export const publicReleaseCandidateContract =
  "air-jam-public-release-candidate/v1";

const manifestFile = "manifest.json";
const evidenceFiles = Object.freeze({
  dependencies: "evidence/dependencies.json",
  licenses: "evidence/licenses.json",
  audit: "evidence/audit.json",
});
const commandMaxBuffer = 64 * 1024 * 1024;
const npmRegistry = "https://registry.npmjs.org";

const compareStrings = (left, right) => left.localeCompare(right);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha512Integrity = (value) =>
  `sha512-${createHash("sha512").update(value).digest("base64")}`;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

export const stableJson = (value) => JSON.stringify(canonicalize(value));

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
};

const run = (
  command,
  args,
  { cwd = repoRoot, allowFailure = false, timeout = 10 * 60 * 1_000 } = {},
) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
    maxBuffer: commandMaxBuffer,
    timeout,
    killSignal: "SIGTERM",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${[command, ...args].join(" ")} failed with exit code ${String(result.status)}${detail ? `:\n${detail}` : ""}`,
    );
  }
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const resolveCleanCommit = () => {
  const status = run("git", [
    "status",
    "--porcelain",
    "--untracked-files=all",
  ]).stdout.trim();
  if (status) {
    throw new Error(
      `Public release candidate creation requires a clean checkout:\n${status}`,
    );
  }
  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  const requested = process.env.GITHUB_SHA?.trim() || head;
  if (!/^[a-f0-9]{40}$/u.test(requested) || requested !== head) {
    throw new Error(
      `Candidate source ${requested} does not match checked-out HEAD ${head}.`,
    );
  }
  return head;
};

const readCommandVersion = (command, args) => run(command, args).stdout.trim();

const visitDependencyTree = (entry, packages) => {
  if (
    entry &&
    typeof entry.name === "string" &&
    typeof entry.version === "string"
  ) {
    packages.set(`${entry.name}@${entry.version}`, {
      name: entry.name,
      version: entry.version,
    });
  }
  for (const section of ["dependencies", "optionalDependencies"]) {
    for (const [name, dependency] of Object.entries(entry?.[section] ?? {})) {
      visitDependencyTree(
        {
          name: dependency.name ?? name,
          version: dependency.version,
          dependencies: dependency.dependencies,
          optionalDependencies: dependency.optionalDependencies,
        },
        packages,
      );
    }
  }
};

const collectDependencyInventory = (publicPackages) => {
  const packages = new Map();
  for (const pkg of publicPackages) {
    const result = run("pnpm", [
      "--filter",
      pkg.packageName,
      "list",
      "--prod",
      "--depth",
      "Infinity",
      "--json",
    ]);
    for (const root of JSON.parse(result.stdout))
      visitDependencyTree(root, packages);
  }
  return {
    contract: "air-jam-production-dependency-inventory/v1",
    roots: publicPackages.map((entry) => entry.packageName),
    packages: [...packages.values()].sort((left, right) =>
      compareStrings(
        `${left.name}@${left.version}`,
        `${right.name}@${right.version}`,
      ),
    ),
  };
};

const collectLicenseInventory = (dependencyInventory, workspacePackages) => {
  const selected = new Set(
    dependencyInventory.packages.map(
      (entry) => `${entry.name}@${entry.version}`,
    ),
  );
  const raw = JSON.parse(
    run("pnpm", ["licenses", "list", "--prod", "--json"]).stdout,
  );
  const packages = new Map();
  for (const [groupLicense, entries] of Object.entries(raw)) {
    for (const entry of entries) {
      for (const version of entry.versions ?? []) {
        const key = `${entry.name}@${version}`;
        if (!selected.has(key)) continue;
        packages.set(key, {
          name: entry.name,
          version,
          license: entry.license ?? groupLicense,
          source: "installed-package",
        });
      }
    }
  }
  for (const entry of dependencyInventory.packages) {
    const workspacePackage = workspacePackages.get(entry.name);
    if (workspacePackage?.license) {
      packages.set(`${entry.name}@${entry.version}`, {
        name: entry.name,
        version: entry.version,
        license: workspacePackage.license,
        source: "workspace-manifest",
      });
    }
  }
  for (const entry of dependencyInventory.packages) {
    const key = `${entry.name}@${entry.version}`;
    if (packages.has(key)) continue;
    const output = run(
      "npm",
      ["view", key, "license", "--json", "--registry", npmRegistry],
      { timeout: 30_000 },
    ).stdout;
    const license = JSON.parse(output);
    if (typeof license !== "string" || !license.trim()) continue;
    packages.set(key, {
      name: entry.name,
      version: entry.version,
      license: license.trim(),
      source: "npm-registry-metadata",
    });
  }
  const missing = [...selected]
    .filter((key) => !packages.has(key))
    .sort(compareStrings);
  return {
    contract: "air-jam-production-license-inventory/v1",
    packages: [...packages.values()].sort((left, right) =>
      compareStrings(
        `${left.name}@${left.version}`,
        `${right.name}@${right.version}`,
      ),
    ),
    missing,
  };
};

const collectDependencyAudit = (dependencyInventoryPath) => {
  const result = run(
    process.execPath,
    [
      path.join(repoRoot, "scripts/release/audit-production-inventory.mjs"),
      "--inventory",
      dependencyInventoryPath,
    ],
    { timeout: 45_000 },
  );
  const audit = JSON.parse(result.stdout);
  if (audit.vulnerabilityCount > 0) {
    throw new Error(
      `Production dependency audit found ${audit.vulnerabilityCount} known vulnerabilities.`,
    );
  }
  return audit;
};

const candidateIdentity = (manifest) => ({
  contract: manifest.contract,
  source: manifest.source,
  version: manifest.version,
  toolchain: manifest.toolchain,
  inputs: manifest.inputs,
  packages: manifest.packages,
  evidence: manifest.evidence,
});

export const computeCandidateDigest = (manifest) =>
  sha256(stableJson(candidateIdentity(manifest)));

export const resolveCandidatePublicationTag = (candidateDigest) => {
  if (!/^[a-f0-9]{64}$/u.test(candidateDigest)) {
    throw new Error("Candidate digest must be a SHA-256 value.");
  }
  return `airjam-candidate-${candidateDigest.slice(0, 16)}`;
};

const assertPlainRelativeFile = (value, label) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.split(/[\\/]/u).includes("..")
  ) {
    throw new Error(`${label} must be a safe relative file path.`);
  }
};

const assertExactEntries = (directory, expected, label) => {
  const observed = fs.readdirSync(directory).sort(compareStrings);
  const canonicalExpected = [...expected].sort(compareStrings);
  if (JSON.stringify(observed) !== JSON.stringify(canonicalExpected)) {
    throw new Error(
      `${label} entries differ. Expected ${canonicalExpected.join(", ")}; observed ${observed.join(", ")}.`,
    );
  }
};

const assertRegularFile = (filePath, label) => {
  if (!fs.lstatSync(filePath).isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
};

const assertDirectory = (directoryPath, label) => {
  if (!fs.lstatSync(directoryPath).isDirectory()) {
    throw new Error(`${label} must be a directory.`);
  }
};

const assertRecord = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
};

const assertSafeDependencySpecifiers = (value, label) => {
  assertRecord(value, label);
  for (const [name, specifier] of Object.entries(value)) {
    if (
      typeof specifier !== "string" ||
      /^(?:workspace|link|file):/u.test(specifier)
    ) {
      throw new Error(`${label}.${name} is not a public dependency specifier.`);
    }
  }
};

const validateCandidateEvidence = ({ root, manifest, expectedPackages }) => {
  const dependencies = readJson(path.join(root, evidenceFiles.dependencies));
  if (
    dependencies.contract !== "air-jam-production-dependency-inventory/v1" ||
    stableJson(dependencies.roots) !==
      stableJson(expectedPackages.map((entry) => entry.packageName)) ||
    !Array.isArray(dependencies.packages)
  ) {
    throw new Error("Candidate dependency inventory is invalid.");
  }
  const dependencyKeys = dependencies.packages.map((entry, index) => {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name ||
      typeof entry.version !== "string" ||
      !entry.version
    ) {
      throw new Error(
        `Candidate dependency inventory entry ${index} is invalid.`,
      );
    }
    return `${entry.name}@${entry.version}`;
  });
  if (new Set(dependencyKeys).size !== dependencyKeys.length) {
    throw new Error("Candidate dependency inventory contains duplicates.");
  }
  for (const expected of expectedPackages) {
    if (
      !dependencyKeys.includes(`${expected.packageName}@${expected.version}`)
    ) {
      throw new Error(
        `Candidate dependency inventory omits ${expected.packageName}@${expected.version}.`,
      );
    }
  }

  const licenses = readJson(path.join(root, evidenceFiles.licenses));
  if (
    licenses.contract !== "air-jam-production-license-inventory/v1" ||
    !Array.isArray(licenses.packages) ||
    !Array.isArray(licenses.missing) ||
    licenses.missing.length > 0
  ) {
    throw new Error("Candidate license inventory is invalid or incomplete.");
  }
  const licenseKeys = licenses.packages.map((entry, index) => {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name ||
      typeof entry.version !== "string" ||
      !entry.version ||
      typeof entry.license !== "string" ||
      !entry.license ||
      ![
        "installed-package",
        "npm-registry-metadata",
        "workspace-manifest",
      ].includes(entry.source)
    ) {
      throw new Error(`Candidate license inventory entry ${index} is invalid.`);
    }
    return `${entry.name}@${entry.version}`;
  });
  if (
    new Set(licenseKeys).size !== licenseKeys.length ||
    stableJson([...licenseKeys].sort(compareStrings)) !==
      stableJson([...dependencyKeys].sort(compareStrings))
  ) {
    throw new Error(
      "Candidate license inventory must cover the exact dependency inventory.",
    );
  }

  const audit = readJson(path.join(root, evidenceFiles.audit));
  if (
    audit.contract !== "air-jam-production-dependency-audit/v1" ||
    audit.method !== "osv-querybatch" ||
    audit.provider !== "OSV.dev" ||
    audit.endpoint !== "https://api.osv.dev/v1/querybatch" ||
    audit.inventorySha256 !== manifest.evidence.dependencies.sha256 ||
    !Number.isSafeInteger(audit.queriedPackages) ||
    !Number.isSafeInteger(audit.queriedVersions) ||
    !Number.isSafeInteger(audit.vulnerabilityCount) ||
    audit.vulnerabilityCount !== 0 ||
    !Array.isArray(audit.findings) ||
    audit.findings.length !== 0
  ) {
    throw new Error("Candidate production dependency audit is not releasable.");
  }

  const workspacePackages = loadWorkspacePackageIndex(repoRoot);
  const expectedMetadata = buildPackageMetadata({
    publicPackages: expectedPackages,
    workspacePackages,
  });
  for (const [index, artifact] of manifest.packages.entries()) {
    const expected = expectedMetadata[index];
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      assertSafeDependencySpecifiers(
        artifact[field],
        `packages[${index}].${field}`,
      );
      if (stableJson(artifact[field]) !== stableJson(expected[field])) {
        throw new Error(
          `Candidate ${artifact.name} ${field} do not match its prepared manifest.`,
        );
      }
    }
  }
};

export const validatePublicReleaseCandidate = (
  candidateDirectory,
  { expectedCommit } = {},
) => {
  const root = path.resolve(candidateDirectory);
  assertDirectory(root, "Candidate root");
  assertExactEntries(root, [manifestFile, "evidence", "packages"], "Candidate");
  assertRegularFile(path.join(root, manifestFile), "Candidate manifest");
  assertDirectory(path.join(root, "evidence"), "Candidate evidence");
  assertDirectory(path.join(root, "packages"), "Candidate packages");
  const manifest = readJson(path.join(root, manifestFile));
  if (manifest.contract !== publicReleaseCandidateContract) {
    throw new Error(
      `Candidate contract must be ${publicReleaseCandidateContract}.`,
    );
  }
  if (
    manifest.source?.repository !== "https://github.com/vucinatim/air-jam" ||
    typeof manifest.createdAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.createdAt))
  ) {
    throw new Error("Candidate source metadata is invalid.");
  }
  if (!/^[a-f0-9]{40}$/u.test(manifest.source?.commit ?? "")) {
    throw new Error("Candidate source commit must be a full Git SHA.");
  }
  if (expectedCommit && manifest.source.commit !== expectedCommit) {
    throw new Error(
      `Candidate commit ${manifest.source.commit} does not match ${expectedCommit}.`,
    );
  }
  if (manifest.version !== resolveUnifiedPublicVersion()) {
    throw new Error(
      "Candidate version does not match the public package graph.",
    );
  }
  for (const [name, value] of Object.entries(manifest.toolchain ?? {})) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Candidate toolchain.${name} is invalid.`);
    }
  }
  if (
    stableJson(Object.keys(manifest.toolchain ?? {}).sort(compareStrings)) !==
      stableJson(["node", "npm", "packageManager", "pnpm"]) ||
    !/^[a-f0-9]{64}$/u.test(manifest.inputs?.packageManifestSha256 ?? "") ||
    !/^[a-f0-9]{64}$/u.test(manifest.inputs?.lockfileSha256 ?? "")
  ) {
    throw new Error("Candidate toolchain or input identity is invalid.");
  }
  const expectedPackages = resolvePublicPackages();
  if (
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== expectedPackages.length
  ) {
    throw new Error(
      "Candidate must contain the complete public package graph.",
    );
  }

  assertExactEntries(
    path.join(root, "evidence"),
    ["audit.json", "dependencies.json", "licenses.json"],
    "Candidate evidence",
  );
  if (
    stableJson(Object.keys(manifest.evidence ?? {}).sort(compareStrings)) !==
    stableJson(Object.keys(evidenceFiles).sort(compareStrings))
  ) {
    throw new Error("Candidate evidence metadata contains unexpected entries.");
  }
  const expectedTarballs = [];
  for (const [index, artifact] of manifest.packages.entries()) {
    const expected = expectedPackages[index];
    if (
      artifact.id !== expected.id ||
      artifact.name !== expected.packageName ||
      artifact.version !== expected.version
    ) {
      throw new Error(
        `Candidate package ${index} does not match the canonical graph.`,
      );
    }
    assertPlainRelativeFile(artifact.file, `packages[${index}].file`);
    if (path.dirname(artifact.file) !== "packages") {
      throw new Error(`packages[${index}].file must be inside packages/.`);
    }
    expectedTarballs.push(path.basename(artifact.file));
    const artifactPath = path.join(root, artifact.file);
    assertRegularFile(artifactPath, `${artifact.name} candidate artifact`);
    const content = fs.readFileSync(artifactPath);
    if (
      content.length !== artifact.bytes ||
      sha256(content) !== artifact.sha256 ||
      sha512Integrity(content) !== artifact.integrity
    ) {
      throw new Error(
        `${artifact.name} candidate bytes do not match the manifest.`,
      );
    }
  }
  assertExactEntries(
    path.join(root, "packages"),
    expectedTarballs,
    "Candidate packages",
  );

  for (const [name, relativeFile] of Object.entries(evidenceFiles)) {
    const evidence = manifest.evidence?.[name];
    if (
      evidence?.file !== relativeFile ||
      !/^[a-f0-9]{64}$/u.test(evidence.sha256 ?? "")
    ) {
      throw new Error(`Candidate ${name} evidence metadata is invalid.`);
    }
    const evidencePath = path.join(root, relativeFile);
    assertRegularFile(evidencePath, `Candidate ${name} evidence`);
    const content = fs.readFileSync(evidencePath);
    if (sha256(content) !== evidence.sha256) {
      throw new Error(`Candidate ${name} evidence digest does not match.`);
    }
  }
  if (manifest.candidateDigest !== computeCandidateDigest(manifest)) {
    throw new Error("Candidate identity digest does not match its manifest.");
  }
  validateCandidateEvidence({ root, manifest, expectedPackages });
  return {
    root,
    manifest,
    candidateDigest: manifest.candidateDigest,
    packageArtifacts: manifest.packages.map((artifact) => ({
      name: artifact.name,
      version: artifact.version,
      tarballBytes: artifact.bytes,
      integrity: artifact.integrity,
      sha256: artifact.sha256,
      tarballPath: path.join(root, artifact.file),
    })),
  };
};

const buildPackageMetadata = ({ publicPackages, workspacePackages }) =>
  publicPackages.map((pkg) => {
    const source = readJson(
      path.join(repoRoot, pkg.workingDirectory, "package.json"),
    );
    const prepared = preparePublicPackageManifest({
      manifest: source,
      workspacePackages,
    });
    return {
      id: pkg.id,
      name: pkg.packageName,
      version: pkg.version,
      dependencies: prepared.dependencies ?? {},
      optionalDependencies: prepared.optionalDependencies ?? {},
      peerDependencies: prepared.peerDependencies ?? {},
    };
  });

export const createPublicReleaseCandidate = ({
  outputDirectory,
  onProgress = () => {},
}) => {
  if (!outputDirectory)
    throw new Error("Candidate output directory is required.");
  const output = path.resolve(outputDirectory);
  if (fs.existsSync(output))
    throw new Error(`Candidate output already exists: ${output}`);

  const commit = resolveCleanCommit();
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const staging = path.join(
    parent,
    `.${path.basename(output)}.staging-${process.pid}`,
  );
  if (fs.existsSync(staging))
    fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.join(staging, "packages"), { recursive: true });

  try {
    onProgress("gate:release-publish");
    run("pnpm", ["check:release:publish"]);
    const publicPackages = resolvePublicPackages();
    for (const pkg of publicPackages) {
      onProgress(`build:${pkg.packageName}`);
      run("pnpm", ["--filter", pkg.packageFilter, "build"]);
    }

    onProgress("inventory:dependencies");
    const workspacePackages = loadWorkspacePackageIndex(repoRoot);
    const dependencies = collectDependencyInventory(publicPackages);
    onProgress("inventory:licenses");
    const licenses = collectLicenseInventory(dependencies, workspacePackages);
    if (licenses.missing.length > 0) {
      throw new Error(
        `License inventory is incomplete for: ${licenses.missing.join(", ")}.`,
      );
    }
    const dependencyInventoryPath = path.join(
      staging,
      evidenceFiles.dependencies,
    );
    writeJson(dependencyInventoryPath, dependencies);
    onProgress("audit:production-dependencies");
    const audit = collectDependencyAudit(dependencyInventoryPath);

    const evidence = { licenses, audit };
    const evidenceMetadata = {};
    evidenceMetadata.dependencies = {
      file: evidenceFiles.dependencies,
      sha256: sha256(fs.readFileSync(dependencyInventoryPath)),
    };
    for (const [name, value] of Object.entries(evidence)) {
      const relativeFile = evidenceFiles[name];
      const filePath = path.join(staging, relativeFile);
      writeJson(filePath, value);
      evidenceMetadata[name] = {
        file: relativeFile,
        sha256: sha256(fs.readFileSync(filePath)),
      };
    }

    const packageMetadata = buildPackageMetadata({
      publicPackages,
      workspacePackages,
    });
    const artifacts = [];
    for (const [index, pkg] of publicPackages.entries()) {
      onProgress(`pack:${pkg.packageName}`);
      const packageDirectory = path.join(repoRoot, pkg.workingDirectory);
      const result = run(
        "pnpm",
        ["pack", "--pack-destination", path.join(staging, "packages")],
        {
          cwd: packageDirectory,
        },
      );
      const filename = result.stdout
        .trim()
        .split(/\r?\n/u)
        .map((entry) => path.basename(entry.trim()))
        .find((entry) => entry.endsWith(".tgz"));
      if (!filename)
        throw new Error(`Unable to resolve tarball for ${pkg.packageName}.`);
      const relativeFile = path.posix.join("packages", filename);
      const content = fs.readFileSync(path.join(staging, relativeFile));
      artifacts.push({
        ...packageMetadata[index],
        file: relativeFile,
        bytes: content.length,
        sha256: sha256(content),
        integrity: sha512Integrity(content),
      });
    }

    const rootManifest = fs.readFileSync(path.join(repoRoot, "package.json"));
    const lockfile = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"));
    const finalCommit = resolveCleanCommit();
    if (finalCommit !== commit) {
      throw new Error(
        `Candidate source changed during creation: expected ${commit}, observed ${finalCommit}.`,
      );
    }
    const manifest = {
      contract: publicReleaseCandidateContract,
      createdAt: new Date().toISOString(),
      source: {
        repository: "https://github.com/vucinatim/air-jam",
        commit,
      },
      version: resolveUnifiedPublicVersion(),
      toolchain: {
        node: process.versions.node,
        npm: readCommandVersion("npm", ["--version"]),
        pnpm: readCommandVersion("pnpm", ["--version"]),
        packageManager: readJson(path.join(repoRoot, "package.json"))
          .packageManager,
      },
      inputs: {
        packageManifestSha256: sha256(rootManifest),
        lockfileSha256: sha256(lockfile),
      },
      packages: artifacts,
      evidence: evidenceMetadata,
    };
    manifest.candidateDigest = computeCandidateDigest(manifest);
    writeJson(path.join(staging, manifestFile), manifest);
    validatePublicReleaseCandidate(staging, { expectedCommit: commit });
    fs.renameSync(staging, output);
    return validatePublicReleaseCandidate(output, { expectedCommit: commit });
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
};

const readPublishedPackage = (name, version) => {
  const result = run(
    "npm",
    [
      "view",
      `${name}@${version}`,
      "dist.integrity",
      "dist.attestations",
      "--json",
    ],
    { allowFailure: true, timeout: 60_000 },
  );
  if (result.status !== 0) {
    if (/E404|is not in this registry|No match found/iu.test(result.stderr)) {
      return null;
    }
    throw new Error(
      `Unable to inspect ${name}@${version} on npm:\n${result.stderr.trim()}`,
    );
  }
  const value = JSON.parse(result.stdout);
  return {
    integrity: value["dist.integrity"] ?? value.integrity ?? null,
    attestations: value["dist.attestations"] ?? value.attestations ?? null,
  };
};

const assertPublishedPackage = ({ artifact, published }) => {
  if (!published) {
    throw new Error(
      `${artifact.name}@${artifact.version} is not visible on npm.`,
    );
  }
  if (published.integrity !== artifact.integrity) {
    throw new Error(
      `${artifact.name}@${artifact.version} exists with different bytes. Expected ${artifact.integrity}; observed ${String(published.integrity)}.`,
    );
  }
  if (
    published.attestations?.provenance?.predicateType !==
      "https://slsa.dev/provenance/v1" ||
    typeof published.attestations?.url !== "string"
  ) {
    throw new Error(
      `${artifact.name}@${artifact.version} has no npm provenance attestation.`,
    );
  }
};

const waitForVerifiedPublishedPackage = (artifact) => {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const published = readPublishedPackage(artifact.name, artifact.version);
    if (published?.integrity && published.integrity !== artifact.integrity) {
      assertPublishedPackage({ artifact, published });
    }
    if (
      published?.attestations?.provenance?.predicateType ===
        "https://slsa.dev/provenance/v1" &&
      typeof published.attestations?.url === "string"
    ) {
      assertPublishedPackage({ artifact, published });
      return published;
    }
    if (attempt < 12) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
    }
  }
  return null;
};

const readDistTags = (name) => {
  const result = run("npm", ["view", name, "dist-tags", "--json"], {
    timeout: 60_000,
  });
  return JSON.parse(result.stdout);
};

export const publishPublicReleaseCandidate = ({
  candidateDirectory,
  channel,
  expectedCommit,
  emergencyReason = null,
  apply = false,
  outputPath,
  onProgress = () => {},
}) => {
  if (channel !== "latest" && channel !== "next") {
    throw new Error(`Unsupported npm channel "${channel}".`);
  }
  if (emergencyReason !== null && emergencyReason.trim().length < 12) {
    throw new Error("Emergency reason must contain at least 12 characters.");
  }
  const validated = validatePublicReleaseCandidate(candidateDirectory, {
    expectedCommit,
  });
  const publicationTag = resolveCandidatePublicationTag(
    validated.candidateDigest,
  );
  const observations = [];
  for (const artifact of validated.manifest.packages) {
    onProgress(`inspect:${artifact.name}`);
    const published = readPublishedPackage(artifact.name, artifact.version);
    if (published) {
      assertPublishedPackage({ artifact, published });
    }
    observations.push({
      artifact,
      published,
      status: published ? "already-published" : "planned",
    });
  }

  if (apply) {
    for (const observation of observations) {
      if (observation.published) continue;
      const { artifact } = observation;
      onProgress(`publish:${artifact.name}`);
      run(
        "npm",
        [
          "publish",
          path.join(validated.root, artifact.file),
          "--registry",
          npmRegistry,
          "--access",
          "public",
          "--tag",
          publicationTag,
          "--provenance",
          "--ignore-scripts",
        ],
        { timeout: 5 * 60 * 1_000 },
      );
      const published = waitForVerifiedPublishedPackage(artifact);
      assertPublishedPackage({ artifact, published });
      observation.published = published;
      observation.status = "published";
    }
  }

  // Only expose the requested public channel after the complete graph exists
  // with exact candidate integrity and provenance. A failed publish can leave
  // an immutable version and candidate-specific tag behind, but never a
  // partially coordinated latest/next graph.
  const packages = [];
  for (const observation of observations) {
    const { artifact, published, status } = observation;
    let channelStatus = "planned";
    if (published) {
      const tags = readDistTags(artifact.name);
      if (tags[channel] === artifact.version) {
        channelStatus = "verified";
      } else if (apply) {
        onProgress(`dist-tag:${artifact.name}`);
        run("npm", [
          "dist-tag",
          "add",
          `${artifact.name}@${artifact.version}`,
          channel,
          "--registry",
          npmRegistry,
        ]);
        const reconciledTags = readDistTags(artifact.name);
        if (reconciledTags[channel] !== artifact.version) {
          throw new Error(
            `npm dist-tag ${channel} did not converge for ${artifact.name}.`,
          );
        }
        channelStatus = "reconciled";
      }
    }
    packages.push({
      name: artifact.name,
      version: artifact.version,
      integrity: artifact.integrity,
      status,
      channelStatus,
      provenanceUrl: published?.attestations?.url ?? null,
    });
  }

  if (apply) {
    for (const observation of observations) {
      const tags = readDistTags(observation.artifact.name);
      if (tags[publicationTag] === observation.artifact.version) {
        onProgress(`dist-tag-cleanup:${observation.artifact.name}`);
        run("npm", [
          "dist-tag",
          "rm",
          observation.artifact.name,
          publicationTag,
          "--registry",
          npmRegistry,
        ]);
        const cleanedTags = readDistTags(observation.artifact.name);
        if (cleanedTags[publicationTag] !== undefined) {
          throw new Error(
            `Temporary npm dist-tag ${publicationTag} was not removed for ${observation.artifact.name}.`,
          );
        }
      }
    }
  }

  const result = {
    ok: true,
    contract: "air-jam-public-release-publication/v1",
    mode: apply ? "apply" : "preview",
    candidateDigest: validated.candidateDigest,
    commit: validated.manifest.source.commit,
    version: validated.manifest.version,
    channel,
    publicationTag,
    emergency: emergencyReason
      ? { active: true, reason: emergencyReason.trim() }
      : { active: false, reason: null },
    packages,
  };
  if (outputPath) writeJson(path.resolve(outputPath), result);
  return result;
};
