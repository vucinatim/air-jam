import fs from "fs-extra";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

export interface ScaffoldArchiveBudgets {
  maxCompressedBytes: number;
  maxEntries: number;
  maxTotalUncompressedBytes: number;
  maxSingleFileUncompressedBytes: number;
  maxCompressionRatio: number;
}

export interface ScaffoldArchiveInspection {
  archiveBytes: number;
  entryCount: number;
  fileCount: number;
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
  compressionRatio: number;
}

interface InspectedArchiveEntry {
  fileName: string;
  isDirectory: boolean;
  compressedSize: number;
  uncompressedSize: number;
}

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scaffoldResourceBudgetsPath = path.join(
  packageRoot,
  "scaffold-resource-budgets.json",
);

const assertPositiveSafeInteger = (
  value: unknown,
  key: keyof ScaffoldArchiveBudgets,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(
      `Invalid scaffold archive resource budget ${key} in ${scaffoldResourceBudgetsPath}`,
    );
  }
  return value as number;
};

export const loadScaffoldArchiveBudgets = (): ScaffoldArchiveBudgets => {
  const document = fs.readJsonSync(scaffoldResourceBudgetsPath) as {
    schemaVersion?: unknown;
    archive?: Partial<ScaffoldArchiveBudgets>;
  };
  if (document.schemaVersion !== 1 || !document.archive) {
    throw new Error(
      `Invalid scaffold archive resource budget document at ${scaffoldResourceBudgetsPath}`,
    );
  }

  const maxCompressionRatio = document.archive.maxCompressionRatio;
  if (
    typeof maxCompressionRatio !== "number" ||
    !Number.isFinite(maxCompressionRatio) ||
    maxCompressionRatio <= 0
  ) {
    throw new Error(
      `Invalid scaffold archive resource budget maxCompressionRatio in ${scaffoldResourceBudgetsPath}`,
    );
  }

  return {
    maxCompressedBytes: assertPositiveSafeInteger(
      document.archive.maxCompressedBytes,
      "maxCompressedBytes",
    ),
    maxEntries: assertPositiveSafeInteger(
      document.archive.maxEntries,
      "maxEntries",
    ),
    maxTotalUncompressedBytes: assertPositiveSafeInteger(
      document.archive.maxTotalUncompressedBytes,
      "maxTotalUncompressedBytes",
    ),
    maxSingleFileUncompressedBytes: assertPositiveSafeInteger(
      document.archive.maxSingleFileUncompressedBytes,
      "maxSingleFileUncompressedBytes",
    ),
    maxCompressionRatio,
  };
};

const assertArchiveEntryPath = (
  targetDir: string,
  entryName: string,
): { normalized: string; targetPath: string } => {
  const normalized = entryName.replace(/\\/g, "/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(`Unsafe scaffold template archive entry: ${entryName}`);
  }

  const resolvedTargetDir = path.resolve(targetDir);
  const targetPath = path.resolve(resolvedTargetDir, normalized);
  if (
    targetPath !== resolvedTargetDir &&
    !targetPath.startsWith(`${resolvedTargetDir}${path.sep}`)
  ) {
    throw new Error(`Unsafe scaffold template archive entry: ${entryName}`);
  }
  return { normalized, targetPath };
};

const walkArchiveEntries = async (
  archivePath: string,
  onEntry: (entry: yauzl.Entry, zipFile: yauzl.ZipFile) => Promise<void> | void,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    yauzl.open(
      archivePath,
      {
        lazyEntries: true,
        strictFileNames: true,
        validateEntrySizes: true,
      },
      (openError, zipFile) => {
        if (openError) {
          reject(openError);
          return;
        }
        if (!zipFile) {
          reject(
            new Error(
              `Unable to open scaffold template archive ${archivePath}`,
            ),
          );
          return;
        }

        let settled = false;
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          try {
            zipFile.close();
          } catch {
            // The original archive or stream error remains authoritative.
          }
          reject(error);
        };
        zipFile.on("error", fail);
        zipFile.on("end", () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        zipFile.on("entry", (entry) => {
          Promise.resolve()
            .then(() => onEntry(entry, zipFile))
            .then(() => {
              if (!settled) zipFile.readEntry();
            }, fail);
        });
        zipFile.readEntry();
      },
    );
  });

const assertArchiveEntryKind = (entry: yauzl.Entry): void => {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const unixFileType = unixMode & 0o170000;
  if (
    unixFileType !== 0 &&
    unixFileType !== 0o100000 &&
    unixFileType !== 0o040000
  ) {
    throw new Error(
      `Unsupported scaffold template archive entry type: ${entry.fileName}`,
    );
  }
};

const assertPortableArchiveEntry = (
  entry: yauzl.Entry,
  targetDir: string,
  portablePaths: Map<string, { fileName: string; isDirectory: boolean }>,
): { isDirectory: boolean } => {
  assertArchiveEntryKind(entry);
  const { normalized } = assertArchiveEntryPath(targetDir, entry.fileName);
  const withoutTrailingSlash = normalized.replace(/\/+$/u, "");
  if (!withoutTrailingSlash) {
    throw new Error(
      `Unsafe scaffold template archive entry: ${entry.fileName}`,
    );
  }

  const isDirectory = normalized.endsWith("/");
  const portableKey = withoutTrailingSlash.normalize("NFC").toLowerCase();
  const existing = portablePaths.get(portableKey);
  if (existing) {
    throw new Error(
      `Conflicting scaffold template archive entries: ${existing.fileName} and ${entry.fileName}`,
    );
  }

  const segments = portableKey.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const parent = portablePaths.get(segments.slice(0, index).join("/"));
    if (parent && !parent.isDirectory) {
      throw new Error(
        `Conflicting scaffold template archive entries: ${parent.fileName} and ${entry.fileName}`,
      );
    }
  }
  if (!isDirectory) {
    for (const [seenPath, seen] of portablePaths.entries()) {
      if (seenPath.startsWith(`${portableKey}/`)) {
        throw new Error(
          `Conflicting scaffold template archive entries: ${entry.fileName} and ${seen.fileName}`,
        );
      }
    }
  }

  portablePaths.set(portableKey, { fileName: entry.fileName, isDirectory });
  return { isDirectory };
};

const assertArchiveSize = (
  value: number,
  label: string,
  entryName: string,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Invalid ${label} for scaffold template archive entry ${entryName}`,
    );
  }
};

const calculateCompressionRatio = (
  uncompressedBytes: number,
  compressedBytes: number,
): number =>
  uncompressedBytes === 0
    ? 0
    : uncompressedBytes / Math.max(1, compressedBytes);

const inspectArchiveEntries = async ({
  archivePath,
  targetDir,
  budgets,
}: {
  archivePath: string;
  targetDir: string;
  budgets: ScaffoldArchiveBudgets;
}): Promise<{
  inspection: ScaffoldArchiveInspection;
  entries: InspectedArchiveEntry[];
}> => {
  const stats = await fs.stat(archivePath);
  if (!stats.isFile()) {
    throw new Error(`Scaffold template archive is not a file: ${archivePath}`);
  }
  if (stats.size > budgets.maxCompressedBytes) {
    throw new Error(
      `Scaffold template archive exceeds the ${budgets.maxCompressedBytes}-byte compressed-size budget: ${stats.size} bytes`,
    );
  }

  const entries: InspectedArchiveEntry[] = [];
  const portablePaths = new Map<
    string,
    { fileName: string; isDirectory: boolean }
  >();
  let fileCount = 0;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  await walkArchiveEntries(archivePath, (entry) => {
    const { isDirectory } = assertPortableArchiveEntry(
      entry,
      targetDir,
      portablePaths,
    );
    assertArchiveSize(entry.compressedSize, "compressed size", entry.fileName);
    assertArchiveSize(
      entry.uncompressedSize,
      "uncompressed size",
      entry.fileName,
    );

    entries.push({
      fileName: entry.fileName,
      isDirectory,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
    });
    if (entries.length > budgets.maxEntries) {
      throw new Error(
        `Scaffold template archive exceeds the ${budgets.maxEntries}-entry budget`,
      );
    }

    if (!isDirectory) {
      fileCount += 1;
      if (entry.uncompressedSize > budgets.maxSingleFileUncompressedBytes) {
        throw new Error(
          `Scaffold template archive entry ${entry.fileName} exceeds the ${budgets.maxSingleFileUncompressedBytes}-byte single-file budget`,
        );
      }
      const entryCompressionRatio = calculateCompressionRatio(
        entry.uncompressedSize,
        entry.compressedSize,
      );
      if (entryCompressionRatio > budgets.maxCompressionRatio) {
        throw new Error(
          `Scaffold template archive entry ${entry.fileName} exceeds the ${budgets.maxCompressionRatio}:1 compression-ratio budget`,
        );
      }
    }

    totalCompressedBytes += entry.compressedSize;
    totalUncompressedBytes += entry.uncompressedSize;
    if (totalUncompressedBytes > budgets.maxTotalUncompressedBytes) {
      throw new Error(
        `Scaffold template archive exceeds the ${budgets.maxTotalUncompressedBytes}-byte uncompressed-size budget`,
      );
    }
    if (
      calculateCompressionRatio(totalUncompressedBytes, totalCompressedBytes) >
      budgets.maxCompressionRatio
    ) {
      throw new Error(
        `Scaffold template archive exceeds the ${budgets.maxCompressionRatio}:1 aggregate compression-ratio budget`,
      );
    }
  });

  if (fileCount === 0) {
    throw new Error("Scaffold template archive contains no files");
  }

  return {
    inspection: {
      archiveBytes: stats.size,
      entryCount: entries.length,
      fileCount,
      totalCompressedBytes,
      totalUncompressedBytes,
      compressionRatio: calculateCompressionRatio(
        totalUncompressedBytes,
        totalCompressedBytes,
      ),
    },
    entries,
  };
};

export const inspectScaffoldTemplateArchive = async ({
  archivePath,
  targetDir,
  budgets = loadScaffoldArchiveBudgets(),
}: {
  archivePath: string;
  targetDir: string;
  budgets?: ScaffoldArchiveBudgets;
}): Promise<ScaffoldArchiveInspection> =>
  (await inspectArchiveEntries({ archivePath, targetDir, budgets })).inspection;

const openEntryStream = (
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Readable> =>
  new Promise<Readable>((resolve, reject) => {
    zipFile.openReadStream(entry, (streamError, stream) => {
      if (streamError) {
        reject(streamError);
        return;
      }
      if (!stream) {
        reject(
          new Error(
            `Unable to read scaffold template archive entry ${entry.fileName}`,
          ),
        );
        return;
      }
      resolve(stream);
    });
  });

export const extractScaffoldTemplateArchive = async ({
  archivePath,
  targetDir,
  budgets = loadScaffoldArchiveBudgets(),
}: {
  archivePath: string;
  targetDir: string;
  budgets?: ScaffoldArchiveBudgets;
}): Promise<void> => {
  const resolvedTargetDir = path.resolve(targetDir);
  if (await fs.pathExists(resolvedTargetDir)) {
    throw new Error(
      `Scaffold extraction target already exists: ${resolvedTargetDir}`,
    );
  }

  const { entries } = await inspectArchiveEntries({
    archivePath,
    targetDir: resolvedTargetDir,
    budgets,
  });
  const targetParent = path.dirname(resolvedTargetDir);
  await fs.ensureDir(targetParent);
  const stagingDir = await fs.mkdtemp(
    path.join(
      targetParent,
      `.${path.basename(resolvedTargetDir)}.airjam-scaffold-`,
    ),
  );

  try {
    let entryIndex = 0;
    await walkArchiveEntries(archivePath, async (entry, zipFile) => {
      const expected = entries[entryIndex];
      entryIndex += 1;
      if (
        !expected ||
        expected.fileName !== entry.fileName ||
        expected.compressedSize !== entry.compressedSize ||
        expected.uncompressedSize !== entry.uncompressedSize
      ) {
        throw new Error(
          `Scaffold template archive changed during extraction at ${entry.fileName}`,
        );
      }

      const { targetPath } = assertArchiveEntryPath(stagingDir, entry.fileName);
      if (expected.isDirectory) {
        await fs.ensureDir(targetPath);
        return;
      }

      await fs.ensureDir(path.dirname(targetPath));
      await pipeline(
        await openEntryStream(zipFile, entry),
        fs.createWriteStream(targetPath),
      );
      const extractedStats = await fs.stat(targetPath);
      if (extractedStats.size !== expected.uncompressedSize) {
        throw new Error(
          `Scaffold template archive entry ${entry.fileName} extracted ${extractedStats.size} bytes; expected ${expected.uncompressedSize}`,
        );
      }
    });

    if (entryIndex !== entries.length) {
      throw new Error("Scaffold template archive changed during extraction");
    }
    if (await fs.pathExists(resolvedTargetDir)) {
      throw new Error(
        `Scaffold extraction target appeared during extraction: ${resolvedTargetDir}`,
      );
    }
    await fs.move(stagingDir, resolvedTargetDir, { overwrite: false });
  } catch (error) {
    await fs.remove(stagingDir);
    throw error;
  }
};
