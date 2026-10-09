import {
  platformMachineGetOwnedGameMediaResultSchema,
  platformMachineMutateOwnedGameMediaAssetResultSchema,
  platformMachineRequestOwnedGameMediaUploadTargetResultSchema,
} from "@air-jam/sdk/platform-machine";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";
import type {
  InspectPlatformGameMediaOptions,
  MutatePlatformGameMediaAssetOptions,
  RequestPlatformGameMediaUploadTargetOptions,
  UploadPlatformGameMediaFileOptions,
} from "./types.js";

const MEDIA_FILE_CONTENT_TYPES: Record<
  "thumbnail" | "cover" | "preview_video",
  Record<string, string>
> = {
  thumbnail: {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  },
  cover: {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  },
  preview_video: {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  },
};

const inferMediaContentType = ({
  kind,
  filePath,
}: {
  kind: "thumbnail" | "cover" | "preview_video";
  filePath: string;
}): string => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MEDIA_FILE_CONTENT_TYPES[kind][extension];

  if (!contentType) {
    throw new Error(
      `Unsupported file extension for ${kind.replaceAll("_", " ")}: ${extension || "(none)"}`,
    );
  }

  return contentType;
};

export const inspectPlatformGameMedia = async ({
  platformUrl,
  token,
  slugOrId,
}: InspectPlatformGameMediaOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/media`,
    token: resolved.token,
    schema: platformMachineGetOwnedGameMediaResultSchema,
  });
};

export const requestPlatformGameMediaUploadTarget = async ({
  platformUrl,
  token,
  slugOrId,
  input,
}: RequestPlatformGameMediaUploadTargetOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/media`,
    method: "POST",
    token: resolved.token,
    body: input,
    schema: platformMachineRequestOwnedGameMediaUploadTargetResultSchema,
  });
};

const mutatePlatformGameMediaAsset = async ({
  platformUrl,
  token,
  slugOrId,
  assetId,
  action,
}: MutatePlatformGameMediaAssetOptions & {
  action: "finalize" | "assign" | "archive";
}) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });

  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/media/${encodeURIComponent(assetId)}/${action}`,
    method: "POST",
    token: resolved.token,
    schema: platformMachineMutateOwnedGameMediaAssetResultSchema,
  });
};

export const finalizePlatformGameMediaUpload = (
  options: MutatePlatformGameMediaAssetOptions,
) =>
  mutatePlatformGameMediaAsset({
    ...options,
    action: "finalize",
  });

export const assignPlatformGameMediaAsset = (
  options: MutatePlatformGameMediaAssetOptions,
) =>
  mutatePlatformGameMediaAsset({
    ...options,
    action: "assign",
  });

export const archivePlatformGameMediaAsset = (
  options: MutatePlatformGameMediaAssetOptions,
) =>
  mutatePlatformGameMediaAsset({
    ...options,
    action: "archive",
  });

export const uploadPlatformGameMediaFile = async ({
  platformUrl,
  token,
  slugOrId,
  kind,
  filePath,
}: UploadPlatformGameMediaFileOptions) => {
  const resolvedFilePath = path.resolve(filePath);
  const fileStats = await stat(resolvedFilePath);

  if (!fileStats.isFile()) {
    throw new Error(`Media path is not a file: ${resolvedFilePath}`);
  }

  const contentType = inferMediaContentType({
    kind,
    filePath: resolvedFilePath,
  });

  const created = await requestPlatformGameMediaUploadTarget({
    platformUrl,
    token,
    slugOrId,
    input: {
      kind,
      originalFilename: path.basename(resolvedFilePath),
      contentType,
      sizeBytes: fileStats.size,
    },
  });

  const uploadResponse = await fetch(created.upload.url, {
    method: created.upload.method,
    headers: created.upload.headers,
    body: await readFile(resolvedFilePath),
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Media upload failed with status ${uploadResponse.status}.`,
    );
  }

  const finalized = await finalizePlatformGameMediaUpload({
    platformUrl,
    token,
    slugOrId,
    assetId: created.asset.id,
  });

  const assigned = await assignPlatformGameMediaAsset({
    platformUrl,
    token,
    slugOrId,
    assetId: created.asset.id,
  });

  return {
    requested: created,
    finalized,
    assigned,
    filePath: resolvedFilePath,
    sizeBytes: fileStats.size,
    contentType,
  };
};
