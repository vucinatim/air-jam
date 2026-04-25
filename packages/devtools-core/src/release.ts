import {
  platformMachineCreateReleaseDraftResultSchema,
  platformMachineFinalizeReleaseUploadResultSchema,
  platformMachineGetReleaseResultSchema,
  platformMachineListOwnedGamesResultSchema,
  platformMachineListReleasesResultSchema,
  platformMachinePublishReleaseResultSchema,
  platformMachineRequestReleaseUploadTargetResultSchema,
} from "@air-jam/sdk/platform-machine";
import {
  HOSTED_RELEASE_CONTROLLER_PATH,
  HOSTED_RELEASE_ENTRY_PATH,
  HOSTED_RELEASE_HOST_PATH,
  HOSTED_RELEASE_MANIFEST_PATH,
  createHostedReleaseArtifactManifest,
  hostedReleaseArtifactManifestSchema,
  type HostedReleaseArtifactManifest,
} from "@air-jam/sdk/release";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import * as yauzl from "yauzl";
import yazl from "yazl";
import { runCommandResult } from "./commands.js";
import { detectProjectContext } from "./context.js";
import { pathExists, readPackageJson } from "./fs-utils.js";
import { inspectGame } from "./games.js";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";
import type {
  AirJamLocalReleaseDoctor,
  AirJamLocalReleaseIssue,
  AirJamLocalReleaseValidation,
  AirJamPackageManager,
  BundleLocalReleaseOptions,
  BundleLocalReleaseResult,
  CommandResult,
  InspectLocalReleaseOptions,
  InspectPlatformReleaseOptions,
  ListPlatformReleaseTargetsOptions,
  ListPlatformReleasesOptions,
  PublishPlatformReleaseOptions,
  SubmitPlatformReleaseOptions,
  SubmitPlatformReleaseResult,
  ValidateLocalReleaseOptions,
} from "./types.js";

const IGNORED_ARCHIVE_PATHS = ["__MACOSX/", ".DS_Store"] as const;

const sanitizePathSegment = (value: string): string =>
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");

const parsePackageManagerField = (
  value: string | undefined,
): AirJamPackageManager => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("pnpm@")) {
    return "pnpm";
  }
  if (normalized.startsWith("npm@")) {
    return "npm";
  }
  if (normalized.startsWith("yarn@")) {
    return "yarn";
  }
  if (normalized.startsWith("bun@")) {
    return "bun";
  }
  return "unknown";
};

const resolvePackageManager = async (
  targetDir: string,
): Promise<AirJamPackageManager> => {
  const packageJson = await readPackageJson(targetDir);
  const packageManagerFromField = parsePackageManagerField(
    packageJson?.value.packageManager,
  );

  if (packageManagerFromField !== "unknown") {
    return packageManagerFromField;
  }

  const context = await detectProjectContext({ cwd: targetDir });
  return context.packageManager;
};

const getDefaultReleaseBundlePath = ({
  projectDir,
  packageName,
  packageVersion,
}: {
  projectDir: string;
  packageName?: string | null;
  packageVersion?: string | null;
}): string => {
  const normalizedReleaseLabel = sanitizePathSegment(packageVersion || "dev");
  const normalizedPackageName = sanitizePathSegment(
    packageName || "airjam-game",
  );

  return path.join(
    projectDir,
    ".airjam",
    "releases",
    normalizedReleaseLabel,
    `${normalizedPackageName}-hosted-release.zip`,
  );
};

const readConfiguredControllerPath = async (
  configPath: string | null,
): Promise<string | null> => {
  if (!configPath || !(await pathExists(configPath))) {
    return null;
  }

  const source = await readFile(configPath, "utf8");
  const match = source.match(/controllerPath\s*:\s*["'`](?<path>[^"'`]+)["'`]/);
  return match?.groups?.path?.trim() || null;
};

const collectDirectoryFiles = async (sourceDir: string): Promise<string[]> => {
  const entries = await readdir(sourceDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(sourceDir, entry);
    const entryStats = await stat(absolutePath);

    if (entryStats.isDirectory()) {
      files.push(...(await collectDirectoryFiles(absolutePath)));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
};

const isIgnoredArchiveEntry = (archivePath: string): boolean =>
  IGNORED_ARCHIVE_PATHS.some(
    (ignoredPath) =>
      archivePath === ignoredPath ||
      archivePath.startsWith(ignoredPath) ||
      archivePath.endsWith(`/${ignoredPath}`),
  );

const hasPathTraversal = (value: string): boolean => {
  const segments = value.split("/");
  return segments.some(
    (segment) => segment.length === 0 || segment === "." || segment === "..",
  );
};

const normalizeArchiveEntryPath = (
  rawPath: string,
): { archivePath: string; isDirectory: boolean } => {
  const canonicalPath = rawPath.replaceAll("\\", "/").trim();
  if (!canonicalPath || canonicalPath.includes("\0")) {
    throw new Error("Release archive contains an invalid empty entry path.");
  }

  const isDirectory = canonicalPath.endsWith("/");
  const normalizedPath = path.posix.normalize(
    isDirectory ? canonicalPath.slice(0, -1) : canonicalPath,
  );

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    path.posix.isAbsolute(normalizedPath) ||
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    hasPathTraversal(normalizedPath)
  ) {
    throw new Error(
      `Release archive entry escapes the allowed root: ${rawPath}`,
    );
  }

  return {
    archivePath: normalizedPath,
    isDirectory,
  };
};

const getUnixMode = (entry: yauzl.Entry): number | null => {
  const mode = entry.externalFileAttributes >>> 16;
  return mode === 0 ? null : mode;
};

const isZipSymlink = (entry: yauzl.Entry): boolean => {
  const unixMode = getUnixMode(entry);
  if (unixMode === null) {
    return false;
  }

  return (unixMode & 0o170000) === 0o120000;
};

const resolveBuildCommand = (
  packageManager: AirJamPackageManager,
): { command: string; args: string[] } | null => {
  if (packageManager === "npm") {
    return { command: "npm", args: ["run", "build"] };
  }
  if (packageManager === "pnpm") {
    return { command: "pnpm", args: ["build"] };
  }
  if (packageManager === "yarn") {
    return { command: "yarn", args: ["build"] };
  }
  if (packageManager === "bun") {
    return { command: "bun", args: ["run", "build"] };
  }
  return null;
};

const runBuild = async ({
  projectDir,
  packageManager,
}: {
  projectDir: string;
  packageManager: AirJamPackageManager;
}): Promise<CommandResult> => {
  const buildCommand = resolveBuildCommand(packageManager);
  if (!buildCommand) {
    return {
      command: "unknown",
      args: [],
      cwd: projectDir,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "Unknown package manager. Cannot run build script.",
      durationMs: 0,
      ok: false,
    };
  }

  return runCommandResult({
    command: buildCommand.command,
    args: buildCommand.args,
    cwd: projectDir,
  });
};

const createIssue = (
  code: string,
  severity: AirJamLocalReleaseIssue["severity"],
  message: string,
  issuePath: string | null = null,
): AirJamLocalReleaseIssue => ({
  code,
  severity,
  message,
  path: issuePath,
});

const openZipFile = async (archiveBuffer: Buffer): Promise<yauzl.ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      archiveBuffer,
      {
        lazyEntries: true,
        validateEntrySizes: true,
        strictFileNames: false,
      },
      (error, zipFile) => {
        if (error) {
          reject(error);
          return;
        }

        if (!zipFile) {
          reject(new Error("Could not open release archive."));
          return;
        }

        resolve(zipFile);
      },
    );
  });

const openZipEntryReadStream = async (
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      if (!stream) {
        reject(new Error(`Could not open zip entry stream: ${entry.fileName}`));
        return;
      }

      resolve(stream);
    });
  });

const readStreamBuffer = async (
  stream: NodeJS.ReadableStream,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

const resolveArchiveRoot = (
  archivePaths: readonly string[],
): {
  entryPath: typeof HOSTED_RELEASE_ENTRY_PATH;
  wrapperDirectory: string | null;
} => {
  if (archivePaths.includes(HOSTED_RELEASE_ENTRY_PATH)) {
    return {
      entryPath: HOSTED_RELEASE_ENTRY_PATH,
      wrapperDirectory: null,
    };
  }

  const topLevelSegments = new Set(
    archivePaths.map((archivePath) => archivePath.split("/")[0]),
  );

  if (topLevelSegments.size !== 1) {
    throw new Error(
      "Release archive must contain a root index.html or a single top-level wrapper directory.",
    );
  }

  const [wrapperDirectory] = [...topLevelSegments];
  if (
    !archivePaths.includes(`${wrapperDirectory}/${HOSTED_RELEASE_ENTRY_PATH}`)
  ) {
    throw new Error(
      "Release archive wrapper directory must contain index.html at its root.",
    );
  }

  return {
    entryPath: HOSTED_RELEASE_ENTRY_PATH,
    wrapperDirectory,
  };
};

const inspectProjectRelease = async ({
  projectDir,
  distDir,
  packageManager,
}: {
  projectDir: string;
  distDir: string;
  packageManager: AirJamPackageManager;
}): Promise<AirJamLocalReleaseDoctor> => {
  const packageJson = await readPackageJson(projectDir);
  const gameInspection = await inspectGame({ cwd: projectDir }).catch(
    () => null,
  );
  const configPath = gameInspection?.configPath ?? null;
  const controllerPath =
    gameInspection?.controllerPathLikely ??
    (await readConfiguredControllerPath(configPath));
  const distExists = await pathExists(distDir);
  const distEntryExists = distExists
    ? await pathExists(path.join(distDir, HOSTED_RELEASE_ENTRY_PATH))
    : false;
  const issues: AirJamLocalReleaseIssue[] = [];

  if (!configPath) {
    issues.push(
      createIssue(
        "missing-config",
        "error",
        "Hosted releases require src/airjam.config.ts so tooling can inspect the game contract.",
      ),
    );
  }

  if (!packageJson?.value.scripts?.build) {
    issues.push(
      createIssue(
        "missing-build-script",
        "error",
        'Hosted releases require a "build" script in package.json.',
        packageJson?.path ?? null,
      ),
    );
  }

  if (controllerPath && controllerPath !== HOSTED_RELEASE_CONTROLLER_PATH) {
    issues.push(
      createIssue(
        "invalid-controller-path",
        "error",
        `Hosted Air Jam bundles require controllerPath to be ${HOSTED_RELEASE_CONTROLLER_PATH}. This project is configured for ${controllerPath}.`,
        configPath,
      ),
    );
  }

  if (!gameInspection?.metadataExportLikely) {
    issues.push(
      createIssue(
        "missing-game-metadata",
        "warning",
        "No gameMetadata export was detected in airjam.config.ts. Hosted release submission can still bundle locally, but dashboard prefill and catalog metadata will be incomplete.",
        configPath,
      ),
    );
  }

  if (distExists && !distEntryExists) {
    issues.push(
      createIssue(
        "invalid-dist-entry",
        "warning",
        `Current build output is missing ${HOSTED_RELEASE_ENTRY_PATH} at ${distDir}. Run the build before validating or bundling.`,
        distDir,
      ),
    );
  }

  return {
    projectDir,
    packageJsonPath: packageJson?.path ?? null,
    packageName: packageJson?.value.name ?? null,
    packageVersion: packageJson?.value.version ?? null,
    packageManager,
    configPath,
    buildScript: packageJson?.value.scripts?.build ?? null,
    metadataExportLikely: Boolean(gameInspection?.metadataExportLikely),
    controllerPath,
    distDir,
    distExists,
    distEntryExists,
    recommendedBundlePath: getDefaultReleaseBundlePath({
      projectDir,
      packageName: packageJson?.value.name ?? null,
      packageVersion: packageJson?.value.version ?? null,
    }),
    canBundle: !issues.some((issue) => issue.severity === "error"),
    issues,
    hostedContract: {
      entryPath: HOSTED_RELEASE_ENTRY_PATH,
      manifestPath: HOSTED_RELEASE_MANIFEST_PATH,
      hostPath: HOSTED_RELEASE_HOST_PATH,
      controllerPath: HOSTED_RELEASE_CONTROLLER_PATH,
    },
  };
};

const validateProjectBuildOutput = async ({
  projectDir,
  distDir,
  packageManager,
  skipBuild,
}: {
  projectDir: string;
  distDir: string;
  packageManager: AirJamPackageManager;
  skipBuild: boolean;
}): Promise<{
  buildResult: CommandResult | null;
  validation: AirJamLocalReleaseValidation;
}> => {
  const doctor = await inspectProjectRelease({
    projectDir,
    distDir,
    packageManager,
  });
  const issues = [...doctor.issues];
  let buildResult: CommandResult | null = null;

  if (!skipBuild && doctor.buildScript) {
    buildResult = await runBuild({ projectDir, packageManager });
    if (!buildResult.ok) {
      issues.push(
        createIssue(
          "build-failed",
          "error",
          `Build failed for hosted release validation.\n${buildResult.stderr || buildResult.stdout || "Unknown build failure."}`,
          doctor.packageJsonPath,
        ),
      );
    }
  }

  const distExists = await pathExists(distDir);
  const distEntryExists = distExists
    ? await pathExists(path.join(distDir, HOSTED_RELEASE_ENTRY_PATH))
    : false;

  if (!distExists) {
    issues.push(
      createIssue(
        "missing-dist",
        "error",
        `Build output directory not found at ${distDir}. Run the build first or pass --dist-dir.`,
        distDir,
      ),
    );
  }

  if (distExists && !distEntryExists) {
    issues.push(
      createIssue(
        "missing-dist-entry",
        "error",
        `Hosted bundle build output must contain ${HOSTED_RELEASE_ENTRY_PATH} at ${distDir}.`,
        distDir,
      ),
    );
  }

  let fileCount = 0;
  let extractedSizeBytes = 0;

  if (distExists) {
    const files = await collectDirectoryFiles(distDir);
    fileCount = files.length + 1;

    for (const filePath of files) {
      const fileStats = await stat(filePath);
      extractedSizeBytes += fileStats.size;
    }

    extractedSizeBytes += Buffer.byteLength(
      `${JSON.stringify(createHostedReleaseArtifactManifest(), null, 2)}\n`,
      "utf8",
    );
  }

  return {
    buildResult,
    validation: {
      source: {
        kind: "project",
        projectDir,
        distDir,
        bundlePath: null,
      },
      ok: !issues.some((issue) => issue.severity === "error"),
      issues,
      manifest: createHostedReleaseArtifactManifest(),
      entryPath: distEntryExists ? HOSTED_RELEASE_ENTRY_PATH : null,
      wrapperDirectory: null,
      fileCount,
      extractedSizeBytes,
    },
  };
};

const validateBundleArchive = async (
  bundlePath: string,
): Promise<AirJamLocalReleaseValidation> => {
  const issues: AirJamLocalReleaseIssue[] = [];

  if (!(await pathExists(bundlePath))) {
    return {
      source: {
        kind: "bundle",
        projectDir: null,
        distDir: null,
        bundlePath,
      },
      ok: false,
      issues: [
        createIssue(
          "missing-bundle",
          "error",
          `Hosted release bundle not found at ${bundlePath}.`,
          bundlePath,
        ),
      ],
      manifest: null,
      entryPath: null,
      wrapperDirectory: null,
      fileCount: 0,
      extractedSizeBytes: 0,
    };
  }

  const archiveBuffer = await readFile(bundlePath);
  const zipFile = await openZipFile(archiveBuffer);
  const archivePaths: string[] = [];
  const manifestCandidates = new Map<string, Buffer>();
  let fileCount = 0;
  let extractedSizeBytes = 0;

  await new Promise<void>((resolve, reject) => {
    zipFile.readEntry();

    zipFile.on("entry", (entry) => {
      try {
        if (isZipSymlink(entry)) {
          reject(
            new Error(
              `Release archive cannot contain symbolic links: ${entry.fileName}`,
            ),
          );
          return;
        }

        const normalized = normalizeArchiveEntryPath(entry.fileName);
        if (isIgnoredArchiveEntry(normalized.archivePath)) {
          zipFile.readEntry();
          return;
        }

        if (normalized.isDirectory) {
          zipFile.readEntry();
          return;
        }

        archivePaths.push(normalized.archivePath);
        fileCount += 1;
        extractedSizeBytes += entry.uncompressedSize;

        if (
          normalized.archivePath.endsWith(`/${HOSTED_RELEASE_MANIFEST_PATH}`) ||
          normalized.archivePath === HOSTED_RELEASE_MANIFEST_PATH
        ) {
          void openZipEntryReadStream(zipFile, entry)
            .then(readStreamBuffer)
            .then((buffer) => {
              manifestCandidates.set(normalized.archivePath, buffer);
              zipFile.readEntry();
            })
            .catch(reject);
          return;
        }

        zipFile.readEntry();
      } catch (error) {
        reject(error);
      }
    });

    zipFile.once("end", resolve);
    zipFile.once("error", reject);
  }).finally(() => {
    zipFile.close();
  });

  try {
    const root = resolveArchiveRoot(
      archivePaths.filter((archivePath) => !archivePath.endsWith("/")),
    );
    const manifestPath = root.wrapperDirectory
      ? `${root.wrapperDirectory}/${HOSTED_RELEASE_MANIFEST_PATH}`
      : HOSTED_RELEASE_MANIFEST_PATH;
    const manifestBuffer = manifestCandidates.get(manifestPath);

    if (!manifestBuffer) {
      issues.push(
        createIssue(
          "missing-manifest",
          "error",
          `Release archive must include ${HOSTED_RELEASE_MANIFEST_PATH} for Air Jam hosted releases.`,
          bundlePath,
        ),
      );
    }

    let manifest: HostedReleaseArtifactManifest | null = null;
    if (manifestBuffer) {
      try {
        manifest = hostedReleaseArtifactManifestSchema.parse(
          JSON.parse(manifestBuffer.toString("utf8")) as unknown,
        );
      } catch {
        issues.push(
          createIssue(
            "invalid-manifest",
            "error",
            `Hosted release manifest must match the Air Jam hosted artifact contract at ${HOSTED_RELEASE_MANIFEST_PATH}.`,
            bundlePath,
          ),
        );
      }
    }

    return {
      source: {
        kind: "bundle",
        projectDir: null,
        distDir: null,
        bundlePath,
      },
      ok: !issues.some((issue) => issue.severity === "error"),
      issues,
      manifest,
      entryPath: root.entryPath,
      wrapperDirectory: root.wrapperDirectory,
      fileCount,
      extractedSizeBytes,
    };
  } catch (error) {
    issues.push(
      createIssue(
        "invalid-bundle-layout",
        "error",
        error instanceof Error
          ? error.message
          : "Invalid hosted release archive.",
        bundlePath,
      ),
    );

    return {
      source: {
        kind: "bundle",
        projectDir: null,
        distDir: null,
        bundlePath,
      },
      ok: false,
      issues,
      manifest: null,
      entryPath: null,
      wrapperDirectory: null,
      fileCount,
      extractedSizeBytes,
    };
  }
};

const writeHostedReleaseBundle = async ({
  sourceDir,
  outputFile,
}: {
  sourceDir: string;
  outputFile: string;
}): Promise<void> => {
  const files = await collectDirectoryFiles(sourceDir);
  const zipFile = new yazl.ZipFile();
  await mkdir(path.dirname(outputFile), { recursive: true });
  const output = createWriteStream(outputFile);

  const closePromise = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    if (!relativePath || relativePath === HOSTED_RELEASE_MANIFEST_PATH) {
      continue;
    }

    zipFile.addFile(filePath, relativePath);
  }

  zipFile.addBuffer(
    Buffer.from(
      `${JSON.stringify(createHostedReleaseArtifactManifest(), null, 2)}\n`,
      "utf8",
    ),
    HOSTED_RELEASE_MANIFEST_PATH,
  );
  zipFile.end();

  await closePromise;
};

export const inspectLocalRelease = async ({
  cwd = process.cwd(),
  distDir,
}: InspectLocalReleaseOptions = {}): Promise<AirJamLocalReleaseDoctor> => {
  const projectDir = path.resolve(cwd);
  const resolvedDistDir = path.resolve(projectDir, distDir || "dist");
  const packageManager = await resolvePackageManager(projectDir);

  return inspectProjectRelease({
    projectDir,
    distDir: resolvedDistDir,
    packageManager,
  });
};

export const validateLocalRelease = async ({
  cwd = process.cwd(),
  distDir,
  bundlePath,
  skipBuild = false,
}: ValidateLocalReleaseOptions = {}): Promise<AirJamLocalReleaseValidation> => {
  if (bundlePath) {
    return validateBundleArchive(path.resolve(cwd, bundlePath));
  }

  const projectDir = path.resolve(cwd);
  const resolvedDistDir = path.resolve(projectDir, distDir || "dist");
  const packageManager = await resolvePackageManager(projectDir);
  const { validation } = await validateProjectBuildOutput({
    projectDir,
    distDir: resolvedDistDir,
    packageManager,
    skipBuild,
  });

  return validation;
};

export const bundleLocalRelease = async ({
  cwd = process.cwd(),
  distDir,
  out,
  skipBuild = false,
}: BundleLocalReleaseOptions = {}): Promise<BundleLocalReleaseResult> => {
  const projectDir = path.resolve(cwd);
  const resolvedDistDir = path.resolve(projectDir, distDir || "dist");
  const doctor = await inspectLocalRelease({
    cwd: projectDir,
    distDir: resolvedDistDir,
  });

  if (!doctor.canBundle) {
    const summary = doctor.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `- ${issue.message}`)
      .join("\n");
    throw new Error(`Hosted release bundle cannot be created:\n${summary}`);
  }

  const { buildResult, validation: projectValidation } =
    await validateProjectBuildOutput({
      projectDir,
      distDir: resolvedDistDir,
      packageManager: doctor.packageManager,
      skipBuild,
    });

  if (!projectValidation.ok) {
    const summary = projectValidation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `- ${issue.message}`)
      .join("\n");
    throw new Error(`Hosted release bundle validation failed:\n${summary}`);
  }

  const outputFile = out
    ? path.resolve(projectDir, out)
    : doctor.recommendedBundlePath;

  await writeHostedReleaseBundle({
    sourceDir: resolvedDistDir,
    outputFile,
  });

  const bundleValidation = await validateBundleArchive(outputFile);
  if (!bundleValidation.ok) {
    const summary = bundleValidation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `- ${issue.message}`)
      .join("\n");
    throw new Error(`Hosted release bundle validation failed:\n${summary}`);
  }

  return {
    projectDir,
    distDir: resolvedDistDir,
    outputFile,
    built: !skipBuild,
    buildResult,
    validation: bundleValidation,
  };
};

const uploadReleaseBundle = async ({
  bundlePath,
  upload,
}: {
  bundlePath: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
  };
}) => {
  const archive = await readFile(bundlePath);
  const response = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: archive,
  });

  if (!response.ok) {
    throw new Error(
      `Release artifact upload failed with status ${response.status}.`,
    );
  }
};

export const listPlatformReleaseTargets = async ({
  platformUrl,
  token,
}: ListPlatformReleaseTargetsOptions = {}) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/games",
    token: resolved.token,
    schema: platformMachineListOwnedGamesResultSchema,
  });
};

export const listPlatformReleases = async ({
  platformUrl,
  token,
  slugOrId,
}: ListPlatformReleasesOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/releases`,
    token: resolved.token,
    schema: platformMachineListReleasesResultSchema,
  });
};

export const inspectPlatformRelease = async ({
  platformUrl,
  token,
  releaseId,
}: InspectPlatformReleaseOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/releases/${encodeURIComponent(releaseId)}`,
    token: resolved.token,
    schema: platformMachineGetReleaseResultSchema,
  });
};

export const publishPlatformRelease = async ({
  platformUrl,
  token,
  releaseId,
}: PublishPlatformReleaseOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/releases/${encodeURIComponent(releaseId)}/publish`,
    method: "POST",
    token: resolved.token,
    schema: platformMachinePublishReleaseResultSchema,
  });
};

export const submitPlatformRelease = async ({
  platformUrl,
  token,
  slugOrId,
  versionLabel,
  cwd = process.cwd(),
  distDir,
  bundlePath,
  skipBuild = false,
  publish = false,
}: SubmitPlatformReleaseOptions): Promise<SubmitPlatformReleaseResult> => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  const effectiveBundlePath = bundlePath
    ? path.resolve(cwd, bundlePath)
    : (
        await bundleLocalRelease({
          cwd,
          distDir,
          skipBuild,
        })
      ).outputFile;

  const archive = await stat(effectiveBundlePath);

  const createdDraft = await requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/releases",
    method: "POST",
    token: resolved.token,
    body: {
      slugOrId,
      ...(versionLabel?.trim() ? { versionLabel: versionLabel.trim() } : {}),
    },
    schema: platformMachineCreateReleaseDraftResultSchema,
  });

  const uploadTarget = await requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/releases/${encodeURIComponent(createdDraft.release.id)}/upload-target`,
    method: "POST",
    token: resolved.token,
    body: {
      originalFilename: path.basename(effectiveBundlePath),
      sizeBytes: archive.size,
    },
    schema: platformMachineRequestReleaseUploadTargetResultSchema,
  });

  await uploadReleaseBundle({
    bundlePath: effectiveBundlePath,
    upload: uploadTarget.upload,
  });

  const finalized = await requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/releases/${encodeURIComponent(createdDraft.release.id)}/finalize`,
    method: "POST",
    token: resolved.token,
    schema: platformMachineFinalizeReleaseUploadResultSchema,
  });

  let publishedRelease = null;
  if (publish) {
    if (finalized.release.status !== "ready") {
      throw new Error(
        `Release ${finalized.release.id} is ${finalized.release.status} and cannot be published.`,
      );
    }

    const published = await requestPlatformMachineApi({
      baseUrl: resolved.baseUrl,
      pathname: `/api/cli/releases/${encodeURIComponent(createdDraft.release.id)}/publish`,
      method: "POST",
      token: resolved.token,
      schema: platformMachinePublishReleaseResultSchema,
    });
    publishedRelease = published.release;
  }

  return {
    bundlePath: effectiveBundlePath,
    createdRelease: createdDraft.release,
    finalizedRelease: finalized.release,
    publishedRelease,
  };
};
