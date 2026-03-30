import {
  MAX_RELEASE_EXTRACTED_BYTES,
  MAX_RELEASE_FILE_BYTES,
  MAX_RELEASE_FILE_COUNT,
} from "@/lib/releases/release-policy";
import { contentType as formatMimeType, lookup as lookupMimeType } from "mime-types";
import path from "node:path";
import { Readable } from "node:stream";
import * as yauzl from "yauzl";

export type ValidatedReleaseArchiveFile = {
  archivePath: string;
  relativePath: string;
  sizeBytes: number;
  contentType: string;
  cacheControl: string;
};

export type ValidatedReleaseArchiveManifest = {
  fileCount: number;
  extractedSizeBytes: number;
  entryPath: "index.html";
  wrapperDirectory: string | null;
  files: ValidatedReleaseArchiveFile[];
};

type NormalizedArchiveEntryPath = {
  archivePath: string;
  isDirectory: boolean;
};

const TEXT_LIKE_MIME_TYPES = new Set([
  "application/javascript",
  "application/json",
  "application/manifest+json",
  "application/xml",
]);

const IGNORED_RELEASE_ARCHIVE_PATHS = [
  "__MACOSX/",
  ".DS_Store",
] as const;

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
): Promise<Readable> =>
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

const hasPathTraversal = (value: string): boolean => {
  const segments = value.split("/");
  return segments.some(
    (segment) => segment.length === 0 || segment === "." || segment === "..",
  );
};

export const normalizeReleaseArchiveEntryPath = (
  rawPath: string,
): NormalizedArchiveEntryPath => {
  const canonicalPath = rawPath.replaceAll("\\", "/").trim();
  if (!canonicalPath || canonicalPath.includes("\0")) {
    throw new Error("Release archive contains an invalid empty entry path.");
  }

  const isDirectory = canonicalPath.endsWith("/");
  const withoutLeadingRelativeSegments = canonicalPath.replace(/^(\.\/)+/, "");
  const normalizedPath = path.posix.normalize(
    isDirectory
      ? withoutLeadingRelativeSegments.slice(0, -1)
      : withoutLeadingRelativeSegments,
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

const isIgnoredReleaseArchiveEntry = (archivePath: string): boolean =>
  IGNORED_RELEASE_ARCHIVE_PATHS.some(
    (ignoredPath) =>
      archivePath === ignoredPath ||
      archivePath.startsWith(ignoredPath) ||
      archivePath.endsWith(`/${ignoredPath}`),
  );

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

const getReleaseAssetContentType = (relativePath: string): string => {
  const mimeType = lookupMimeType(relativePath);
  if (!mimeType) {
    return "application/octet-stream";
  }

  const formattedMimeType = formatMimeType(mimeType);
  if (formattedMimeType) {
    return formattedMimeType;
  }

  if (
    mimeType.startsWith("text/") ||
    TEXT_LIKE_MIME_TYPES.has(mimeType.toString())
  ) {
    return `${mimeType}; charset=utf-8`;
  }

  return mimeType.toString();
};

export const getReleaseAssetCacheControl = (relativePath: string): string => {
  const lowerCasePath = relativePath.toLowerCase();
  if (
    lowerCasePath.endsWith(".html") ||
    lowerCasePath.endsWith(".json") ||
    lowerCasePath.endsWith(".webmanifest")
  ) {
    return "no-cache";
  }

  return "public, max-age=31536000, immutable";
};

export const resolveReleaseArchiveRoot = (
  archivePaths: readonly string[],
): { entryPath: "index.html"; wrapperDirectory: string | null } => {
  if (archivePaths.includes("index.html")) {
    return {
      entryPath: "index.html",
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
  if (!archivePaths.includes(`${wrapperDirectory}/index.html`)) {
    throw new Error(
      "Release archive wrapper directory must contain an index.html entry.",
    );
  }

  return {
    entryPath: "index.html",
    wrapperDirectory,
  };
};

export const readReleaseArchiveManifest = async (
  archiveBuffer: Buffer,
): Promise<ValidatedReleaseArchiveManifest> => {
  const zipFile = await openZipFile(archiveBuffer);
  const archiveFiles: Array<{ archivePath: string; sizeBytes: number }> = [];

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        zipFile.close();
        reject(error);
      };

      zipFile.on("entry", (entry) => {
        try {
          const normalizedEntry = normalizeReleaseArchiveEntryPath(entry.fileName);
          if (isIgnoredReleaseArchiveEntry(normalizedEntry.archivePath)) {
            zipFile.readEntry();
            return;
          }

          if (normalizedEntry.isDirectory) {
            zipFile.readEntry();
            return;
          }

          if (isZipSymlink(entry)) {
            throw new Error(
              `Release archive contains a symbolic link entry: ${entry.fileName}`,
            );
          }

          if (entry.uncompressedSize > MAX_RELEASE_FILE_BYTES) {
            throw new Error(
              `Release archive file exceeds the ${MAX_RELEASE_FILE_BYTES} byte limit: ${entry.fileName}`,
            );
          }

          archiveFiles.push({
            archivePath: normalizedEntry.archivePath,
            sizeBytes: entry.uncompressedSize,
          });

          if (archiveFiles.length > MAX_RELEASE_FILE_COUNT) {
            throw new Error(
              `Release archive exceeds the ${MAX_RELEASE_FILE_COUNT} file limit.`,
            );
          }

          zipFile.readEntry();
        } catch (error) {
          fail(error);
        }
      });

      zipFile.once("end", () => {
        if (settled) {
          return;
        }

        settled = true;
        zipFile.close();
        resolve();
      });

      zipFile.once("error", fail);
      zipFile.readEntry();
    });
  } finally {
    zipFile.removeAllListeners();
  }

  if (archiveFiles.length === 0) {
    throw new Error("Release archive is empty.");
  }

  const extractedSizeBytes = archiveFiles.reduce(
    (totalSize, file) => totalSize + file.sizeBytes,
    0,
  );

  if (extractedSizeBytes > MAX_RELEASE_EXTRACTED_BYTES) {
    throw new Error(
      `Release archive exceeds the ${MAX_RELEASE_EXTRACTED_BYTES} extracted byte limit.`,
    );
  }

  const { entryPath, wrapperDirectory } = resolveReleaseArchiveRoot(
    archiveFiles.map((file) => file.archivePath),
  );

  const files = archiveFiles.map((file) => {
    const relativePath = wrapperDirectory
      ? file.archivePath.slice(wrapperDirectory.length + 1)
      : file.archivePath;

    if (!relativePath) {
      throw new Error(
        `Release archive contains an invalid wrapped file path: ${file.archivePath}`,
      );
    }

    return {
      archivePath: file.archivePath,
      relativePath,
      sizeBytes: file.sizeBytes,
      contentType: getReleaseAssetContentType(relativePath),
      cacheControl: getReleaseAssetCacheControl(relativePath),
    };
  });

  return {
    fileCount: files.length,
    extractedSizeBytes,
    entryPath,
    wrapperDirectory,
    files,
  };
};

export const streamValidatedReleaseArchiveFiles = async ({
  archiveBuffer,
  files,
  onFile,
}: {
  archiveBuffer: Buffer;
  files: readonly ValidatedReleaseArchiveFile[];
  onFile: (
    file: ValidatedReleaseArchiveFile,
    stream: Readable,
  ) => Promise<void>;
}): Promise<void> => {
  const zipFile = await openZipFile(archiveBuffer);
  const filesByArchivePath = new Map(
    files.map((file) => [file.archivePath, file]),
  );

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let ended = false;
      let activeFileStreams = 0;

      const completeIfPossible = () => {
        if (settled || !ended || activeFileStreams > 0) {
          return;
        }

        settled = true;
        zipFile.close();
        resolve();
      };

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        zipFile.close();
        reject(error);
      };

      zipFile.on("entry", (entry) => {
        let normalizedEntry: NormalizedArchiveEntryPath;
        try {
          normalizedEntry = normalizeReleaseArchiveEntryPath(entry.fileName);
        } catch (error) {
          fail(error);
          return;
        }

        if (normalizedEntry.isDirectory) {
          zipFile.readEntry();
          return;
        }

        if (isIgnoredReleaseArchiveEntry(normalizedEntry.archivePath)) {
          zipFile.readEntry();
          return;
        }

        const file = filesByArchivePath.get(normalizedEntry.archivePath);
        if (!file) {
          zipFile.readEntry();
          return;
        }

        activeFileStreams += 1;
        void openZipEntryReadStream(zipFile, entry)
          .then((stream) => onFile(file, stream))
          .then(() => {
            activeFileStreams -= 1;
            zipFile.readEntry();
            completeIfPossible();
          })
          .catch(fail);
      });

      zipFile.once("end", () => {
        ended = true;
        completeIfPossible();
      });

      zipFile.once("error", fail);
      zipFile.readEntry();
    });
  } finally {
    zipFile.removeAllListeners();
  }
};
