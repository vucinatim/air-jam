import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archivePlatformGameMediaAsset,
  inspectPlatformGameMedia,
  uploadPlatformGameMediaFile,
} from "../src/index.js";

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-platform-media-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0, tempRoots.length)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
  vi.unstubAllGlobals();
});

describe("platform game media tooling", () => {
  it("inspects media assets and uploads one media file through the machine API", async () => {
    const root = await createTempRoot();
    const thumbnailPath = path.join(root, "thumbnail.png");
    await writeFile(thumbnailPath, Buffer.from("image-bytes"));

    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (
        url === "https://platform.airjam.test/api/cli/games/minimal/media" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: null,
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:10:00.000Z",
            },
            active: {
              thumbnailMediaAssetId: null,
              coverMediaAssetId: null,
              previewVideoMediaAssetId: null,
            },
            assets: [],
          }),
          { status: 200 },
        );
      }

      if (
        url === "https://platform.airjam.test/api/cli/games/minimal/media" &&
        init?.method === "POST"
      ) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          kind: "thumbnail",
          originalFilename: "thumbnail.png",
          contentType: "image/png",
          sizeBytes: "image-bytes".length,
        });

        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: null,
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:10:00.000Z",
            },
            asset: {
              id: "asset_1",
              gameId: "game_1",
              kind: "thumbnail",
              status: "uploading",
              originalFilename: "thumbnail.png",
              mimeType: "image/png",
              sizeBytes: "image-bytes".length,
              checksum: null,
              width: null,
              height: null,
              durationSeconds: null,
              createdAt: "2026-05-03T12:11:00.000Z",
              updatedAt: "2026-05-03T12:11:00.000Z",
              activeAssetId: null,
              isActive: false,
              publicUrl: null,
            },
            upload: {
              key: "media-key",
              method: "PUT",
              url: "https://uploads.airjam.test/asset_1",
              headers: {
                "content-type": "image/png",
              },
              expiresAt: "2026-05-03T12:21:00.000Z",
            },
          }),
          { status: 200 },
        );
      }

      if (url === "https://uploads.airjam.test/asset_1" && init?.method === "PUT") {
        expect(init.body).toBeTruthy();
        return new Response(null, { status: 200 });
      }

      if (
        url ===
          "https://platform.airjam.test/api/cli/games/minimal/media/asset_1/finalize" &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: null,
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:10:00.000Z",
            },
            active: {
              thumbnailMediaAssetId: null,
              coverMediaAssetId: null,
              previewVideoMediaAssetId: null,
            },
            asset: {
              id: "asset_1",
              gameId: "game_1",
              kind: "thumbnail",
              status: "ready",
              originalFilename: "thumbnail.png",
              mimeType: "image/png",
              sizeBytes: "image-bytes".length,
              checksum: "abc123",
              width: null,
              height: null,
              durationSeconds: null,
              createdAt: "2026-05-03T12:11:00.000Z",
              updatedAt: "2026-05-03T12:12:00.000Z",
              activeAssetId: null,
              isActive: false,
              publicUrl: "https://platform.airjam.test/media/g/game_1/thumbnail",
            },
          }),
          { status: 200 },
        );
      }

      if (
        url ===
          "https://platform.airjam.test/api/cli/games/minimal/media/asset_1/assign" &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: null,
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:13:00.000Z",
            },
            active: {
              thumbnailMediaAssetId: "asset_1",
              coverMediaAssetId: null,
              previewVideoMediaAssetId: null,
            },
            asset: {
              id: "asset_1",
              gameId: "game_1",
              kind: "thumbnail",
              status: "ready",
              originalFilename: "thumbnail.png",
              mimeType: "image/png",
              sizeBytes: "image-bytes".length,
              checksum: "abc123",
              width: null,
              height: null,
              durationSeconds: null,
              createdAt: "2026-05-03T12:11:00.000Z",
              updatedAt: "2026-05-03T12:13:00.000Z",
              activeAssetId: "asset_1",
              isActive: true,
              publicUrl: "https://platform.airjam.test/media/g/game_1/thumbnail",
            },
          }),
          { status: 200 },
        );
      }

      if (
        url ===
          "https://platform.airjam.test/api/cli/games/minimal/media/asset_1/archive" &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: null,
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:14:00.000Z",
            },
            active: {
              thumbnailMediaAssetId: null,
              coverMediaAssetId: null,
              previewVideoMediaAssetId: null,
            },
            asset: {
              id: "asset_1",
              gameId: "game_1",
              kind: "thumbnail",
              status: "archived",
              originalFilename: "thumbnail.png",
              mimeType: "image/png",
              sizeBytes: "image-bytes".length,
              checksum: "abc123",
              width: null,
              height: null,
              durationSeconds: null,
              createdAt: "2026-05-03T12:11:00.000Z",
              updatedAt: "2026-05-03T12:14:00.000Z",
              activeAssetId: null,
              isActive: false,
              publicUrl: "https://platform.airjam.test/media/g/game_1/thumbnail",
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const inspected = await inspectPlatformGameMedia({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      slugOrId: "minimal",
    });
    expect(inspected.assets).toHaveLength(0);

    const uploaded = await uploadPlatformGameMediaFile({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      slugOrId: "minimal",
      kind: "thumbnail",
      filePath: thumbnailPath,
    });
    expect(uploaded.assigned.asset.isActive).toBe(true);
    expect(uploaded.contentType).toBe("image/png");

    const archived = await archivePlatformGameMediaAsset({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      slugOrId: "minimal",
      assetId: "asset_1",
    });
    expect(archived.asset.status).toBe("archived");
  });
});
