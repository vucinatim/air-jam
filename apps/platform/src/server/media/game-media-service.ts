import { db } from "@/db";
import { gameMediaAssets, gameMediaAssignments } from "@/db/schema";
import type { GameMediaKind } from "@/lib/games/game-media-contract";
import {
  ALLOWED_GAME_MEDIA_CONTENT_TYPES,
  ALLOWED_GAME_MEDIA_FILENAME_EXTENSIONS,
  MAX_GAME_MEDIA_BYTES,
} from "@/lib/games/game-media-policy";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  getActiveGameMediaAssetId,
  loadGameMediaActive,
} from "./game-media-assignments";
import { getGameMediaStorage } from "./game-media-storage";
import { buildGameMediaStorageKeys } from "./game-media-storage-keys";

const trimFilename = (value: string): string => value.trim();

const assertValidMediaFilename = ({
  kind,
  filename,
}: {
  kind: GameMediaKind;
  filename: string;
}): string => {
  const trimmedFilename = trimFilename(filename);
  if (!trimmedFilename) {
    throw new Error("Media upload filename is required.");
  }

  if (
    trimmedFilename.includes("/") ||
    trimmedFilename.includes("\\") ||
    trimmedFilename.includes("\0")
  ) {
    throw new Error("Media upload filename must be a plain file name.");
  }

  const lowerCaseFilename = trimmedFilename.toLowerCase();
  const hasAllowedExtension = ALLOWED_GAME_MEDIA_FILENAME_EXTENSIONS[kind].some(
    (extension) => lowerCaseFilename.endsWith(extension),
  );

  if (!hasAllowedExtension) {
    throw new Error(
      `Unsupported file extension for ${kind.replace("_", " ")}.`,
    );
  }

  return trimmedFilename;
};

const assertValidMediaContentType = ({
  kind,
  contentType,
}: {
  kind: GameMediaKind;
  contentType: string;
}) => {
  const normalizedContentType = contentType.trim().toLowerCase();
  if (!ALLOWED_GAME_MEDIA_CONTENT_TYPES[kind].includes(normalizedContentType)) {
    throw new Error(
      `Unsupported content type for ${kind.replace("_", " ")}: ${contentType}`,
    );
  }

  return normalizedContentType;
};

export const requestGameMediaUploadTarget = async ({
  gameId,
  kind,
  originalFilename,
  contentType,
  sizeBytes,
}: {
  gameId: string;
  kind: GameMediaKind;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}) => {
  const validatedFilename = assertValidMediaFilename({
    kind,
    filename: originalFilename,
  });
  const validatedContentType = assertValidMediaContentType({
    kind,
    contentType,
  });
  const maxBytes = MAX_GAME_MEDIA_BYTES[kind];

  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw new Error(
      `${kind.replace("_", " ")} uploads must be between 1 byte and ${maxBytes} bytes.`,
    );
  }

  const assetId = crypto.randomUUID();
  const storageKeys = buildGameMediaStorageKeys({
    gameId,
    kind,
    assetId,
    originalFilename: validatedFilename,
  });
  const storage = getGameMediaStorage();

  const upload = await storage.createArtifactUploadTarget({
    key: storageKeys.objectKey,
    contentType: validatedContentType,
    originalFilename: validatedFilename,
  });

  const [asset] = await db
    .insert(gameMediaAssets)
    .values({
      id: assetId,
      gameId,
      kind,
      status: "uploading",
      originalFilename: validatedFilename,
      mimeType: validatedContentType,
      sizeBytes,
      storageKey: storageKeys.objectKey,
    })
    .returning();

  return {
    asset,
    upload,
  };
};

export const finalizeGameMediaUpload = async ({
  assetId,
  gameId,
}: {
  assetId: string;
  gameId: string;
}) => {
  const asset = await db.query.gameMediaAssets.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, assetId), eq(table.gameId, gameId)),
  });

  if (!asset) {
    throw new Error("Media asset not found.");
  }

  if (asset.status !== "uploading") {
    throw new Error("Only uploading media assets can be finalized.");
  }

  const storage = getGameMediaStorage();
  const objectHead = await storage.headObject(asset.storageKey);
  if (!objectHead) {
    await db
      .update(gameMediaAssets)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(gameMediaAssets.id, asset.id));

    throw new Error("Uploaded media asset was not found in storage.");
  }

  const maxBytes = MAX_GAME_MEDIA_BYTES[asset.kind];
  if (objectHead.sizeBytes <= 0 || objectHead.sizeBytes > maxBytes) {
    await db
      .update(gameMediaAssets)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(gameMediaAssets.id, asset.id));

    throw new Error(
      `${asset.kind.replace("_", " ")} exceeds the ${maxBytes} byte limit.`,
    );
  }

  const contentType = (objectHead.contentType ?? asset.mimeType).toLowerCase();
  assertValidMediaContentType({
    kind: asset.kind,
    contentType,
  });

  const buffer = await storage.readObject(asset.storageKey);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  return db.transaction(async (tx) => {
    const [updatedAsset] = await tx
      .update(gameMediaAssets)
      .set({
        status: "ready",
        mimeType: contentType,
        sizeBytes: objectHead.sizeBytes,
        checksum,
        updatedAt: new Date(),
      })
      .where(eq(gameMediaAssets.id, asset.id))
      .returning();

    await tx
      .insert(gameMediaAssignments)
      .values({
        gameId,
        kind: asset.kind,
        assetId: asset.id,
        assetStatus: "ready",
      })
      .onConflictDoUpdate({
        target: [gameMediaAssignments.gameId, gameMediaAssignments.kind],
        set: {
          assetId: asset.id,
          assetStatus: "ready",
          assignedAt: new Date(),
        },
      });

    return updatedAsset;
  });
};

export const assignGameMediaAssetWithDatabase = async ({
  database,
  gameId,
  assetId,
}: {
  database: typeof db;
  gameId: string;
  assetId: string;
}) => {
  return database.transaction(async (tx) => {
    const asset = await tx.query.gameMediaAssets.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, assetId), eq(table.gameId, gameId)),
    });

    if (!asset) {
      throw new Error("Media asset not found.");
    }

    if (asset.status !== "ready") {
      throw new Error("Only ready media assets can be assigned.");
    }

    await tx
      .insert(gameMediaAssignments)
      .values({
        gameId,
        kind: asset.kind,
        assetId: asset.id,
        assetStatus: "ready",
      })
      .onConflictDoUpdate({
        target: [gameMediaAssignments.gameId, gameMediaAssignments.kind],
        set: {
          assetId: asset.id,
          assetStatus: "ready",
          assignedAt: new Date(),
        },
      });

    return asset;
  });
};

export const assignGameMediaAsset = ({
  gameId,
  assetId,
}: {
  gameId: string;
  assetId: string;
}) => assignGameMediaAssetWithDatabase({ database: db, gameId, assetId });

export const archiveGameMediaAssetWithDatabase = async ({
  database,
  gameId,
  assetId,
}: {
  database: typeof db;
  gameId: string;
  assetId: string;
}) => {
  return database.transaction(async (tx) => {
    const asset = await tx.query.gameMediaAssets.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, assetId), eq(table.gameId, gameId)),
    });

    if (!asset) {
      throw new Error("Media asset not found.");
    }

    if (asset.status === "archived") {
      return asset;
    }

    await tx
      .delete(gameMediaAssignments)
      .where(
        and(
          eq(gameMediaAssignments.gameId, gameId),
          eq(gameMediaAssignments.kind, asset.kind),
          eq(gameMediaAssignments.assetId, asset.id),
        ),
      );

    const [updatedAsset] = await tx
      .update(gameMediaAssets)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(gameMediaAssets.id, asset.id))
      .returning();

    return updatedAsset;
  });
};

export const archiveGameMediaAsset = ({
  gameId,
  assetId,
}: {
  gameId: string;
  assetId: string;
}) => archiveGameMediaAssetWithDatabase({ database: db, gameId, assetId });

export const getGameMediaAssetForKind = async ({
  gameId,
  kind,
}: {
  gameId: string;
  kind: GameMediaKind;
}) => {
  const active = await loadGameMediaActive({ gameId });
  const assetId = getActiveGameMediaAssetId(active, kind);
  if (!assetId) {
    return null;
  }

  return db.query.gameMediaAssets.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.id, assetId),
        eq(table.gameId, gameId),
        eq(table.kind, kind),
        eq(table.status, "ready"),
      ),
  });
};

export const inspectGameMedia = async ({ gameId }: { gameId: string }) => {
  const [active, assets] = await Promise.all([
    loadGameMediaActive({ gameId }),
    db.query.gameMediaAssets.findMany({
      where: (table, { eq }) => eq(table.gameId, gameId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
  ]);

  return { active, assets };
};
