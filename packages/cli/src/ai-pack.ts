import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fs from "fs-extra";
import kleur from "kleur";

type AiPackFile = {
  path: string;
  kind: "docs-local" | "docs-generated";
  size: number;
  sha256: string;
};

type AiPackManifest = {
  schemaVersion: 2;
  packVersion: string;
  channel: "stable" | "canary";
  releaseDate: string;
  source: {
    mode: "packaged-snapshot";
    package: "@air-jam/cli";
  };
  scaffold: {
    template: string | null;
    createAirjamVersion: string | null;
  };
  managedFiles: AiPackFile[];
  contentDigest: string;
};

type AiPackDifference = {
  path: string;
  state: "missing" | "different" | "obsolete";
  kind: string;
  expectedSha256?: string;
  actualSha256?: string;
};

type AiPackComparison = {
  projectDir: string;
  localManifestPath: string;
  manifestSource: "packaged-snapshot";
  trustedPackage: "@air-jam/cli";
  localManifest: AiPackManifest;
  latestManifest: AiPackManifest;
  latestPackVersion: string;
  versionRelation: "behind" | "current" | "ahead";
  differingFiles: AiPackDifference[];
  missingCount: number;
  differentCount: number;
  obsoleteCount: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagedRoot = path.resolve(
  __dirname,
  "..",
  "template-assets",
  "managed",
);
const manifestRelativePath = ".airjam/ai-pack.json";
const manifestKeys = [
  "channel",
  "contentDigest",
  "managedFiles",
  "packVersion",
  "releaseDate",
  "scaffold",
  "schemaVersion",
  "source",
];
const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const assertExactKeys = (
  value: Record<string, unknown>,
  expected: string[],
  label: string,
) => {
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} contains unsupported or missing fields.`);
  }
};

const assertManagedPath = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("docs/airjam/") ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment === "" || segment === "..")
  ) {
    throw new Error(`Unsafe AI pack managed path: ${String(value)}.`);
  }
  return value;
};

const parseManifest = (value: unknown, label: string): AiPackManifest => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const manifest = value as Record<string, unknown>;
  assertExactKeys(manifest, manifestKeys, label);
  if (manifest.schemaVersion !== 2)
    throw new Error(`${label} schemaVersion must be 2.`);
  if (!semanticVersionPattern.test(String(manifest.packVersion))) {
    throw new Error(`${label} packVersion must be semantic.`);
  }
  if (manifest.channel !== "stable" && manifest.channel !== "canary") {
    throw new Error(`${label} channel must be stable or canary.`);
  }
  if (
    typeof manifest.releaseDate !== "string" ||
    !Number.isFinite(Date.parse(manifest.releaseDate))
  ) {
    throw new Error(`${label} releaseDate must be an ISO date.`);
  }
  const source = manifest.source as Record<string, unknown>;
  assertExactKeys(source, ["mode", "package"], `${label}.source`);
  if (
    source.mode !== "packaged-snapshot" ||
    source.package !== "@air-jam/cli"
  ) {
    throw new Error(`${label} must trust the packaged @air-jam/cli snapshot.`);
  }
  const scaffold = manifest.scaffold as Record<string, unknown>;
  assertExactKeys(
    scaffold,
    ["createAirjamVersion", "template"],
    `${label}.scaffold`,
  );
  for (const key of ["template", "createAirjamVersion"]) {
    if (scaffold[key] !== null && typeof scaffold[key] !== "string") {
      throw new Error(`${label}.scaffold.${key} must be a string or null.`);
    }
  }
  if (
    !Array.isArray(manifest.managedFiles) ||
    manifest.managedFiles.length === 0
  ) {
    throw new Error(`${label}.managedFiles must be a non-empty array.`);
  }
  const paths = new Set<string>();
  for (const [index, rawFile] of manifest.managedFiles.entries()) {
    if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      throw new Error(`${label}.managedFiles[${index}] must be an object.`);
    }
    const file = rawFile as Record<string, unknown>;
    assertExactKeys(
      file,
      ["kind", "path", "sha256", "size"],
      `${label}.managedFiles[${index}]`,
    );
    const relativePath = assertManagedPath(file.path);
    if (paths.has(relativePath))
      throw new Error(`${label} repeats ${relativePath}.`);
    paths.add(relativePath);
    if (file.kind !== "docs-local" && file.kind !== "docs-generated") {
      throw new Error(`${label} has an unsupported file kind.`);
    }
    if (!Number.isSafeInteger(file.size) || Number(file.size) < 0) {
      throw new Error(`${label} has an invalid file size.`);
    }
    if (!/^[a-f0-9]{64}$/u.test(String(file.sha256))) {
      throw new Error(`${label} has an invalid file digest.`);
    }
  }
  const files = manifest.managedFiles as AiPackFile[];
  if (manifest.contentDigest !== sha256(JSON.stringify(files))) {
    throw new Error(`${label} contentDigest does not match managedFiles.`);
  }
  return manifest as unknown as AiPackManifest;
};

const readManifest = async (filePath: string, label: string) =>
  parseManifest(await fs.readJson(filePath), label);

const readVerifiedPackagedSnapshot = async () => {
  const manifest = await readManifest(
    path.join(packagedRoot, manifestRelativePath),
    "Packaged AI pack manifest",
  );
  const contents = new Map<string, Buffer>();
  for (const file of manifest.managedFiles) {
    const absolutePath = path.join(packagedRoot, file.path);
    const content = await fs.readFile(absolutePath);
    if (content.length !== file.size || sha256(content) !== file.sha256) {
      throw new Error(`Packaged AI pack integrity failed for ${file.path}.`);
    }
    contents.set(file.path, content);
  }
  return { manifest, contents };
};

const parseVersion = (version: string) => {
  const match = semanticVersionPattern.exec(version);
  if (!match) throw new Error(`Invalid semantic version: ${version}.`);
  return {
    numbers: match.slice(1, 4).map((part) => Number.parseInt(part, 10)),
    prerelease: match[4]?.split(".") ?? null,
  };
};

const compareVersions = (left: string, right: string): number => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) {
      return a.numbers[index] < b.numbers[index] ? -1 : 1;
    }
  }
  if (JSON.stringify(a.prerelease) === JSON.stringify(b.prerelease)) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  for (
    let index = 0;
    index < Math.max(a.prerelease.length, b.prerelease.length);
    index += 1
  ) {
    const leftIdentifier = a.prerelease[index];
    const rightIdentifier = b.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/u.test(leftIdentifier);
    const rightNumeric = /^\d+$/u.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) < Number(rightIdentifier) ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }
  return 0;
};

const normalizedManifest = (manifest: AiPackManifest) => ({
  ...manifest,
  scaffold: { template: null, createAirjamVersion: null },
});

const compareAgainstPackagedSnapshot = async (
  projectDir: string,
): Promise<AiPackComparison> => {
  const localManifestPath = path.join(projectDir, manifestRelativePath);
  if (!(await fs.pathExists(localManifestPath))) {
    throw new Error(`Missing local AI pack manifest at ${localManifestPath}.`);
  }
  const localManifest = await readManifest(
    localManifestPath,
    "Local AI pack manifest",
  );
  const latest = await readVerifiedPackagedSnapshot();
  const relation = compareVersions(
    localManifest.packVersion,
    latest.manifest.packVersion,
  );
  const differingFiles: AiPackDifference[] = [];

  if (
    JSON.stringify(normalizedManifest(localManifest)) !==
    JSON.stringify(normalizedManifest(latest.manifest))
  ) {
    differingFiles.push({
      path: manifestRelativePath,
      state: "different",
      kind: "manifest",
      expectedSha256: latest.manifest.contentDigest,
      actualSha256: sha256(await fs.readFile(localManifestPath)),
    });
  }

  const latestPaths = new Set(
    latest.manifest.managedFiles.map((file) => file.path),
  );
  for (const file of latest.manifest.managedFiles) {
    const localPath = path.join(projectDir, file.path);
    if (!(await fs.pathExists(localPath))) {
      differingFiles.push({
        path: file.path,
        state: "missing",
        kind: file.kind,
        expectedSha256: file.sha256,
      });
      continue;
    }
    const stats = await fs.lstat(localPath);
    const actualSha256 = stats.isFile()
      ? sha256(await fs.readFile(localPath))
      : undefined;
    if (
      !stats.isFile() ||
      stats.size !== file.size ||
      actualSha256 !== file.sha256
    ) {
      differingFiles.push({
        path: file.path,
        state: "different",
        kind: file.kind,
        expectedSha256: file.sha256,
        actualSha256,
      });
    }
  }
  for (const file of localManifest.managedFiles) {
    if (!latestPaths.has(file.path)) {
      differingFiles.push({
        path: file.path,
        state: "obsolete",
        kind: file.kind,
        actualSha256: (await fs.pathExists(path.join(projectDir, file.path)))
          ? sha256(await fs.readFile(path.join(projectDir, file.path)))
          : undefined,
      });
    }
  }

  return {
    projectDir,
    localManifestPath,
    manifestSource: "packaged-snapshot",
    trustedPackage: "@air-jam/cli",
    localManifest,
    latestManifest: latest.manifest,
    latestPackVersion: latest.manifest.packVersion,
    versionRelation:
      relation < 0 ? "behind" : relation > 0 ? "ahead" : "current",
    differingFiles,
    missingCount: differingFiles.filter((file) => file.state === "missing")
      .length,
    differentCount: differingFiles.filter((file) => file.state === "different")
      .length,
    obsoleteCount: differingFiles.filter((file) => file.state === "obsolete")
      .length,
  };
};

const printSummary = (comparison: AiPackComparison) => {
  console.log(kleur.bold("AI Pack"));
  console.log(`Project: ${comparison.projectDir}`);
  console.log(
    `Local pack: ${comparison.localManifest.channel}@${comparison.localManifest.packVersion}`,
  );
  console.log(
    `Installed CLI pack: ${comparison.latestManifest.channel}@${comparison.latestPackVersion}`,
  );
  console.log(
    "Trusted source: provenance-backed @air-jam/cli package snapshot",
  );
};

const statusDocument = (comparison: AiPackComparison) => ({
  upToDate:
    comparison.versionRelation === "current" &&
    comparison.differingFiles.length === 0,
  updateAvailable: comparison.versionRelation === "behind",
  rollbackBlocked: comparison.versionRelation === "ahead",
  drifted:
    comparison.versionRelation === "current" &&
    comparison.differingFiles.length > 0,
  comparison,
});

export async function runAiPackStatus({
  dir,
  json = false,
}: {
  dir?: string;
  json?: boolean;
}): Promise<void> {
  const comparison = await compareAgainstPackagedSnapshot(
    path.resolve(dir ?? process.cwd()),
  );
  if (json) {
    process.stdout.write(
      `${JSON.stringify(statusDocument(comparison), null, 2)}\n`,
    );
    return;
  }
  printSummary(comparison);
  console.log(
    `Managed differences: ${comparison.differingFiles.length} (${comparison.missingCount} missing, ${comparison.differentCount} different, ${comparison.obsoleteCount} obsolete)`,
  );
  if (comparison.versionRelation === "ahead") {
    console.log(
      kleur.yellow(
        "The installed CLI is older; rollback is blocked. Upgrade the CLI.",
      ),
    );
  } else if (comparison.versionRelation === "behind") {
    console.log(
      kleur.yellow(
        "A trusted AI pack update is available from the installed CLI.",
      ),
    );
  } else if (comparison.differingFiles.length > 0) {
    console.log(
      kleur.yellow(
        'Managed files drifted. Inspect with "airjam ai-pack diff".',
      ),
    );
  } else {
    console.log(
      kleur.green("Managed AI pack files match the installed CLI snapshot."),
    );
  }
}

export async function runAiPackDiff({
  dir,
  json = false,
}: {
  dir?: string;
  json?: boolean;
}): Promise<void> {
  const comparison = await compareAgainstPackagedSnapshot(
    path.resolve(dir ?? process.cwd()),
  );
  if (json) {
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    return;
  }
  printSummary(comparison);
  if (comparison.differingFiles.length === 0) {
    console.log(kleur.green("No managed AI pack files differ."));
    return;
  }
  console.log("");
  for (const file of comparison.differingFiles) {
    console.log(`- [${file.state}] ${file.path} (${file.kind})`);
  }
}

const assertTreeHasNoSymlinks = async (root: string) => {
  if (!(await fs.pathExists(root))) return;
  const stats = await fs.lstat(root);
  if (stats.isSymbolicLink())
    throw new Error(`AI pack target may not be a symlink: ${root}.`);
  if (!stats.isDirectory()) return;
  for (const entry of await fs.readdir(root)) {
    await assertTreeHasNoSymlinks(path.join(root, entry));
  }
};

const applyPackagedSnapshot = async (comparison: AiPackComparison) => {
  const latest = await readVerifiedPackagedSnapshot();
  const transactionId = randomUUID();
  const stageRoot = path.join(
    comparison.projectDir,
    `.airjam-pack-stage-${transactionId}`,
  );
  const backupRoot = path.join(
    comparison.projectDir,
    `.airjam-pack-backup-${transactionId}`,
  );
  const targetDocs = path.join(comparison.projectDir, "docs", "airjam");
  const stagedDocs = path.join(stageRoot, "docs", "airjam");
  const backupDocs = path.join(backupRoot, "docs-airjam");
  const targetManifest = comparison.localManifestPath;
  const stagedManifest = path.join(stageRoot, manifestRelativePath);
  const backupManifest = path.join(backupRoot, "ai-pack.json");
  let docsBackedUp = false;
  let docsPublished = false;
  let manifestBackedUp = false;
  let manifestPublished = false;
  let preserveBackup = false;

  await assertTreeHasNoSymlinks(targetDocs);
  if (await fs.pathExists(targetManifest)) {
    const stats = await fs.lstat(targetManifest);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Local AI pack manifest must be a regular file.");
    }
  }

  try {
    if (await fs.pathExists(targetDocs)) await fs.copy(targetDocs, stagedDocs);
    else await fs.ensureDir(stagedDocs);

    const latestPaths = new Set(
      latest.manifest.managedFiles.map((file) => file.path),
    );
    for (const previous of comparison.localManifest.managedFiles) {
      if (!latestPaths.has(previous.path)) {
        await fs.remove(path.join(stageRoot, previous.path));
      }
    }
    for (const file of latest.manifest.managedFiles) {
      const target = path.join(stageRoot, file.path);
      await fs.ensureDir(path.dirname(target));
      await fs.remove(target);
      await fs.writeFile(target, latest.contents.get(file.path)!);
    }
    const nextManifest: AiPackManifest = {
      ...latest.manifest,
      scaffold: comparison.localManifest.scaffold,
    };
    await fs.ensureDir(path.dirname(stagedManifest));
    await fs.writeJson(stagedManifest, nextManifest, { spaces: 2 });

    for (const file of latest.manifest.managedFiles) {
      const content = await fs.readFile(path.join(stageRoot, file.path));
      if (content.length !== file.size || sha256(content) !== file.sha256) {
        throw new Error(`Staged AI pack integrity failed for ${file.path}.`);
      }
    }
    parseManifest(await fs.readJson(stagedManifest), "Staged AI pack manifest");

    await fs.ensureDir(backupRoot);
    if (await fs.pathExists(targetDocs)) {
      await fs.move(targetDocs, backupDocs);
      docsBackedUp = true;
    }
    await fs.ensureDir(path.dirname(targetDocs));
    await fs.move(stagedDocs, targetDocs);
    docsPublished = true;

    await fs.move(targetManifest, backupManifest);
    manifestBackedUp = true;
    await fs.move(stagedManifest, targetManifest);
    manifestPublished = true;
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    const attemptRollback = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    };
    if (docsPublished) await attemptRollback(() => fs.remove(targetDocs));
    if (docsBackedUp) {
      await attemptRollback(() =>
        fs.move(backupDocs, targetDocs, { overwrite: true }),
      );
    }
    if (manifestPublished) {
      await attemptRollback(() => fs.remove(targetManifest));
    }
    if (manifestBackedUp) {
      await attemptRollback(() =>
        fs.move(backupManifest, targetManifest, { overwrite: true }),
      );
    }
    if (rollbackErrors.length > 0) {
      preserveBackup = true;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `AI pack update failed and rollback was incomplete. Recovery backup preserved at ${backupRoot}.`,
      );
    }
    throw error;
  } finally {
    await fs.remove(stageRoot);
    if (!preserveBackup) await fs.remove(backupRoot);
  }
};

const writeUpdateResult = (
  result: Record<string, unknown>,
  json: boolean,
  message: string,
) => {
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else console.log(message);
};

export async function runAiPackUpdate({
  dir,
  json = false,
}: {
  dir?: string;
  json?: boolean;
}): Promise<void> {
  const projectDir = path.resolve(dir ?? process.cwd());
  const comparison = await compareAgainstPackagedSnapshot(projectDir);
  if (comparison.versionRelation === "ahead") {
    throw new Error(
      "Refusing to roll an AI pack back. Upgrade @air-jam/cli first.",
    );
  }
  if (comparison.versionRelation === "current") {
    const reason =
      comparison.differingFiles.length === 0 ? "already-current" : "use-repair";
    writeUpdateResult(
      { updated: false, reason, comparison },
      json,
      reason === "already-current"
        ? kleur.green("Managed AI pack files already match the installed CLI.")
        : kleur.yellow(
            'Same-version drift requires explicit "airjam ai-pack repair".',
          ),
    );
    if (reason === "use-repair") process.exitCode = 1;
    return;
  }
  await applyPackagedSnapshot(comparison);
  const refreshed = await compareAgainstPackagedSnapshot(projectDir);
  if (
    refreshed.differingFiles.length > 0 ||
    refreshed.versionRelation !== "current"
  ) {
    throw new Error("AI pack transaction completed without converging.");
  }
  writeUpdateResult(
    {
      updated: true,
      previousPackVersion: comparison.localManifest.packVersion,
      packVersion: refreshed.latestPackVersion,
      comparison: refreshed,
    },
    json,
    kleur.green(
      `Updated managed AI pack files to ${refreshed.latestPackVersion}.`,
    ),
  );
}

export async function runAiPackRepair({
  dir,
  json = false,
}: {
  dir?: string;
  json?: boolean;
}): Promise<void> {
  const projectDir = path.resolve(dir ?? process.cwd());
  const comparison = await compareAgainstPackagedSnapshot(projectDir);
  if (comparison.versionRelation !== "current") {
    throw new Error(
      comparison.versionRelation === "ahead"
        ? "Refusing to roll an AI pack back. Upgrade @air-jam/cli first."
        : 'A newer trusted pack is available; run "airjam ai-pack update".',
    );
  }
  if (comparison.differingFiles.length === 0) {
    writeUpdateResult(
      { repaired: false, reason: "already-current", comparison },
      json,
      kleur.green("Managed AI pack files already match the installed CLI."),
    );
    return;
  }
  await applyPackagedSnapshot(comparison);
  const refreshed = await compareAgainstPackagedSnapshot(projectDir);
  if (refreshed.differingFiles.length > 0) {
    throw new Error("AI pack repair transaction completed without converging.");
  }
  writeUpdateResult(
    {
      repaired: true,
      repairedFileCount: comparison.differingFiles.length,
      packVersion: refreshed.latestPackVersion,
      comparison: refreshed,
    },
    json,
    kleur.green(
      `Repaired ${comparison.differingFiles.length} managed AI pack file(s).`,
    ),
  );
}
