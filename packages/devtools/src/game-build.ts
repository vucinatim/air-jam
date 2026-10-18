import type { ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, createWriteStream, openSync, writeSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { finished, pipeline } from "node:stream/promises";
import { ZipFile } from "yazl";
import type { installDependencies } from "./dependencies.js";
import {
  gameBuildManifestSchema,
  gameBuildMarkerSchema,
  gameBuildResultSchema,
  type PinnedGameBuild,
} from "./game-build-protocol.js";
import {
  MAXIMUM_GAME_RUN_BUILD_LOG_BYTES,
  type AirJamGameRunBuildLog,
} from "./game-run-protocol.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import { inspectInstalledDependencies } from "./installed-dependencies.js";
import {
  closeAfterProcessFailure,
  closeScopedProcess,
  spawnScopedProcess,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import { copySourceTree, readSourceTree } from "./source-tree.js";

const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export const GAME_BUILD_CACHE_MAXIMUM_BYTES = 2 * 1024 * 1024 * 1024;
const GAME_BUILD_CACHE_MAXIMUM_ENTRIES = 3;

async function directoryBytes(directory: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    bytes += entry.isDirectory()
      ? await directoryBytes(target)
      : (await lstat(target)).size;
  }
  return bytes;
}

/** Logical bytes include dependencies and evidence, without following package symlinks. */
export async function enforceGameBuildCacheLimits(
  cache: string,
  currentKey: string,
) {
  const currentBytes = await directoryBytes(path.join(cache, currentKey));
  if (currentBytes > GAME_BUILD_CACHE_MAXIMUM_BYTES)
    throw new Error(
      "build_cache_too_large: A sealed game exceeds the 2 GiB cache allowance.",
    );
  const older = (
    await Promise.all(
      (await readdir(cache))
        .filter((name) => /^[a-f0-9]{64}$/.test(name) && name !== currentKey)
        .map(async (name) => ({
          name,
          time: (await stat(path.join(cache, name))).mtimeMs,
          bytes: await directoryBytes(path.join(cache, name)),
        })),
    )
  ).sort(
    (left, right) =>
      left.time - right.time || left.name.localeCompare(right.name),
  );
  let bytes =
    currentBytes + older.reduce((total, entry) => total + entry.bytes, 0);
  let entries = older.length + 1;
  for (const entry of older) {
    if (
      entries <= GAME_BUILD_CACHE_MAXIMUM_ENTRIES &&
      bytes <= GAME_BUILD_CACHE_MAXIMUM_BYTES
    )
      break;
    await rm(path.join(cache, entry.name), { recursive: true });
    bytes -= entry.bytes;
    entries--;
  }
}

export async function distributionFiles(
  directory: string,
  relative = "",
): Promise<PinnedGameBuild["manifest"]["files"]> {
  const files: PinnedGameBuild["manifest"]["files"] = [];
  for (const entry of (
    await readdir(path.join(directory, relative), { withFileTypes: true })
  ).sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await distributionFiles(directory, name)));
    else if (entry.isFile()) {
      const content = await readFile(path.join(directory, name));
      files.push({
        path: name,
        bytes: content.length,
        sha256: digest(content),
      });
    } else
      throw new Error(`build_invalid_distribution: Unsupported entry: ${name}`);
  }
  return files;
}
export async function verifyPinnedGameBuild(build: PinnedGameBuild) {
  const installed = await inspectInstalledDependencies(
    build.rootDir,
    build.manifest.toolchain.projectRoot,
  );
  if (
    installed.installedTreeHash !==
      build.manifest.dependencies.installedTreeHash ||
    installed.installedLockfileHash !== build.manifest.lockfileHash
  )
    throw new Error(
      "build_integrity_changed: Installed dependencies were modified.",
    );
  if ((await readSourceTree(build.rootDir)).hash !== build.manifest.sourceHash)
    throw new Error("build_integrity_changed: The pinned source was modified.");
  if (
    digest(JSON.stringify(await distributionFiles(build.distDir))) !==
    build.manifest.distHash
  )
    throw new Error(
      "build_integrity_changed: The pinned distribution was modified.",
    );
}

async function archiveSource(rootDir: string, target: string) {
  const source = await readSourceTree(rootDir);
  const archive = new ZipFile();
  const writing = pipeline(
    archive.outputStream,
    createWriteStream(target, { flags: "wx", mode: 0o600 }),
  );
  const mtime = new Date("2000-01-01T00:00:00Z");
  for (const entry of source.entries) {
    if (entry.kind === "directory")
      archive.addEmptyDirectory(entry.path, {
        mode: 0o40000 | entry.mode,
        mtime,
      });
    else if (entry.kind === "link")
      archive.addBuffer(Buffer.from(entry.target), entry.path, {
        mode: 0o120000 | entry.mode,
        mtime,
      });
    else
      archive.addFile(path.join(rootDir, entry.path), entry.path, {
        mode: 0o100000 | entry.mode,
        mtime,
      });
  }
  archive.end();
  await writing;
  const content = await readFile(target);
  if (content.length > 16 * 1024 * 1024)
    throw new Error(
      "build_source_archive_too_large: Compressed source exceeds the 16 MiB evidence limit.",
    );
  return { bytes: content.length, sha256: digest(content) };
}

/** Called inside the admitted build scope; IO and arbitrary build scripts stay contained. */
export async function materializeGameBuild(options: {
  projectDir: string;
  configRelative: string;
  toolchain: PinnedGameBuild["manifest"]["toolchain"];
  install: (rootDir: string) => ReturnType<typeof installDependencies>;
  build: (rootDir: string) => Promise<void>;
}): Promise<PinnedGameBuild> {
  const cache = path.join(options.projectDir, ".airjam/devtools/game-builds");
  await mkdir(cache, { recursive: true });
  // The broker admits one project run; its process guardian has closed any previous build scope.
  for (const name of await readdir(cache)) {
    if (/^\.building-[a-f0-9-]{36}$/.test(name))
      await rm(path.join(cache, name), { recursive: true, force: true });
    else if (/^[a-f0-9]{64}$/.test(name)) {
      try {
        await readFile(path.join(cache, name, "build.json"));
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ENOENT"
        )
          throw error;
        const marker = gameBuildMarkerSchema.parse(
          JSON.parse(
            await readFile(path.join(cache, name, "building.json"), "utf8"),
          ),
        );
        if (
          marker.buildKey !== name ||
          marker.projectRoot !== options.projectDir
        )
          throw new Error(
            "build_cache_invalid: Unknown incomplete cache owner.",
          );
        await rm(path.join(cache, name), { recursive: true });
      }
    }
  }
  const temporary = path.join(cache, `.building-${randomUUID()}`);
  await mkdir(temporary);
  let completed = false;
  let ownedDirectory: string | undefined;
  try {
    let rootDir = path.join(temporary, "source");
    const source = await copySourceTree(options.projectDir, rootDir);
    const lockfileHash = digest(
      await readFile(path.join(rootDir, "pnpm-lock.yaml")),
    );
    const key = digest(
      JSON.stringify({
        sourceHash: source.hash,
        lockfileHash,
        configRelative: options.configRelative,
        toolchain: options.toolchain,
      }),
    );
    const directory = path.join(cache, key);
    const paths = (base: string) => ({
      rootDir: path.join(base, "source"),
      distDir: path.join(base, "source/dist"),
      configPath: path.join(base, "source", options.configRelative),
      manifestPath: path.join(base, "build.json"),
      sourceArchivePath: path.join(base, "source.zip"),
    });
    let cached: string;
    try {
      cached = await readFile(path.join(directory, "build.json"), "utf8");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      cached = "";
    }
    if (cached) {
      const manifest = gameBuildManifestSchema.parse(JSON.parse(cached));
      if (manifest.buildKey !== key || manifest.sourceHash !== source.hash)
        throw new Error(
          "build_cache_invalid: Cache identity does not match its key.",
        );
      const result = { ...paths(directory), manifest, reused: true };
      await verifyPinnedGameBuild(result);
      const archive = await readFile(result.sourceArchivePath);
      if (
        digest(archive) !== manifest.sourceArchive.sha256 ||
        archive.length !== manifest.sourceArchive.bytes
      )
        throw new Error(
          "build_cache_invalid: The original source archive was modified.",
        );
      await enforceGameBuildCacheLimits(cache, key);
      return result;
    }
    // Install at the final stable path: pnpm command shims contain absolute paths.
    await writeFile(
      path.join(temporary, "building.json"),
      JSON.stringify({ buildKey: key, projectRoot: options.projectDir }),
      { flag: "wx", mode: 0o600 },
    );
    await rename(temporary, directory);
    ownedDirectory = directory;
    rootDir = paths(directory).rootDir;
    const installation = await options.install(rootDir);
    const dependencies = {
      ...(await inspectInstalledDependencies(rootDir, options.projectDir)),
      installation,
    };
    if (dependencies.installedLockfileHash !== lockfileHash)
      throw new Error(
        "build_dependencies_invalid: The installed lockfile differs from the pinned graph.",
      );
    await options.build(rootDir);
    if ((await readSourceTree(rootDir)).hash !== source.hash)
      throw new Error(
        "build_source_changed: Installation or build changed the pinned source.",
      );
    const files = await distributionFiles(path.join(rootDir, "dist"));
    const manifest = gameBuildManifestSchema.parse({
      version: 1,
      buildKey: key,
      sourceHash: source.hash,
      lockfileHash,
      distHash: digest(JSON.stringify(files)),
      toolchain: options.toolchain,
      dependencies,
      createdAt: new Date().toISOString(),
      files,
      sourceArchive: await archiveSource(
        rootDir,
        path.join(directory, "source.zip"),
      ),
    });
    await writeFile(
      path.join(directory, "build.pending.json"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await verifyPinnedGameBuild({
      ...paths(directory),
      manifest,
      reused: false,
    });
    await enforceGameBuildCacheLimits(cache, key);
    await rename(
      path.join(directory, "build.pending.json"),
      path.join(directory, "build.json"),
    );
    completed = true;
    return { ...paths(directory), manifest, reused: false };
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (!completed && ownedDirectory)
      await rm(ownedDirectory, { recursive: true, force: true });
  }
}

export async function sealGameBuild(options: {
  projectDir: string;
  configRelative: string;
  runDirectory: string;
  signal: AbortSignal;
  onScope?: ProcessScopeObserver;
  onBuildLog?: (receipt: Omit<AirJamGameRunBuildLog, "path">) => void;
}) {
  options.signal.throwIfAborted();
  const helper = resolveDevtoolsHelperScript("seal-game-build.ts");
  const logPath = path.join(options.runDirectory, "build.log");
  const descriptor = openSync(logPath, "wx", 0o600);
  const closeBuildProcess = async (child: ChildProcess) => {
    await closeScopedProcess(child);
    await Promise.all(
      [child.stdout, child.stderr].map((stream) =>
        stream
          ? finished(stream, { readable: true, writable: false, cleanup: true })
          : undefined,
      ),
    );
  };
  let child: ChildProcess | null = null;
  let cancel = () => {};
  let bytesWritten = 0;
  let truncated = false;
  let receiveLog: ((value: Buffer | string) => void) | undefined;
  try {
    child = await spawnScopedProcess(
      [
        ...resolveDevtoolsHelperArgs(helper),
        JSON.stringify({
          projectDir: options.projectDir,
          configRelative: options.configRelative,
        }),
      ],
      { cwd: options.projectDir, onScope: options.onScope },
    );
    const ownedChild = child;
    const build = await new Promise<PinnedGameBuild>((resolve, reject) => {
      let logFailed = false;
      receiveLog = (value) => {
        if (logFailed) return;
        try {
          const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
          const remaining = Math.max(
            0,
            MAXIMUM_GAME_RUN_BUILD_LOG_BYTES - bytesWritten,
          );
          const length = Math.min(remaining, bytes.length);
          let offset = 0;
          while (offset < length)
            offset += writeSync(descriptor, bytes, offset, length - offset);
          bytesWritten += length;
          truncated ||= length < bytes.length;
        } catch (error) {
          logFailed = true;
          reject(error);
        }
      };
      ownedChild.stdout?.on("data", receiveLog);
      ownedChild.stderr?.on("data", receiveLog);
      ownedChild.on("message", (value: unknown) => {
        const result = gameBuildResultSchema.safeParse(value);
        if (!result.success) return;
        if (result.data.ok) resolve(result.data.build);
        else reject(new Error(result.data.error));
      });
      ownedChild.once("error", reject);
      ownedChild.once("exit", () =>
        reject(
          new Error(
            "build_process_ended: The build scope ended without a sealed result.",
          ),
        ),
      );
      cancel = () => reject(options.signal.reason);
      options.signal.addEventListener("abort", cancel, { once: true });
      if (options.signal.aborted) cancel();
    });
    await closeBuildProcess(ownedChild);
    await verifyPinnedGameBuild(build);
    await Promise.all([
      copyFile(
        build.manifestPath,
        path.join(options.runDirectory, "build.json"),
      ),
      copyFile(
        build.sourceArchivePath,
        path.join(options.runDirectory, "source.zip"),
      ),
    ]);
    return build;
  } catch (error) {
    if (child) {
      const failedChild = child;
      return await closeAfterProcessFailure(
        () => closeBuildProcess(failedChild),
        error,
      );
    }
    throw error;
  } finally {
    options.signal.removeEventListener("abort", cancel);
    if (receiveLog) {
      child?.stdout?.off("data", receiveLog);
      child?.stderr?.off("data", receiveLog);
    }
    child?.stdout?.resume();
    child?.stderr?.resume();
    closeSync(descriptor);
    const bytes = await readFile(logPath);
    options.onBuildLog?.({
      sha256: digest(bytes),
      bytes: bytes.length,
      truncated,
    });
  }
}
