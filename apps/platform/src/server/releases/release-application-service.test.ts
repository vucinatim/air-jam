import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/operations/production-control-service", () => ({
  assertOperationalLaneAccepting: vi.fn().mockResolvedValue(undefined),
  OperationalAdmissionDeniedError: class OperationalAdmissionDeniedError extends Error {},
}));

vi.mock("./assert-owned-release", () => ({
  assertOwnedRelease: vi.fn(),
}));

vi.mock("./assert-release-exists", () => ({
  assertReleaseExists: vi.fn(),
}));

vi.mock("./release-artifact-service", () => ({
  finalizeReleaseUpload: vi.fn(),
  requestReleaseUploadTarget: vi.fn(),
}));

vi.mock("./release-moderation-service", () => ({
  runReleaseModeration: vi.fn(),
}));

vi.mock("./release-status-service", () => ({
  archiveRelease: vi.fn(),
  publishRelease: vi.fn(),
  quarantineRelease: vi.fn(),
}));

import { assertOwnedRelease } from "./assert-owned-release";
import { assertReleaseExists } from "./assert-release-exists";
import {
  finalizeOwnedReleaseUpload,
  moderateReleaseForOperations,
  publishOwnedRelease,
  quarantineReleaseForOperations,
  requestOwnedReleaseUploadTarget,
} from "./release-application-service";
import {
  finalizeReleaseUpload,
  requestReleaseUploadTarget,
} from "./release-artifact-service";
import { runReleaseModeration } from "./release-moderation-service";
import { publishRelease, quarantineRelease } from "./release-status-service";

const generation = {
  id: "generation_1",
  releaseId: "release_1",
  sequence: 1,
  status: "failed" as const,
  originalFilename: "game.zip",
  contentType: "application/zip",
  declaredSizeBytes: 100,
  zipObjectKey: "private-generation-zip-key",
  siteRootKey: null,
  observedSizeBytes: null,
  observedContentType: null,
  observedEtag: null,
  observedLastModifiedAt: null,
  extractedSizeBytes: null,
  fileCount: null,
  entryPath: null,
  contentHash: null,
  createdAt: new Date("2026-04-25T10:01:00.000Z"),
  uploadObservedAt: null,
  processingStartedAt: null,
  readyAt: null,
  failedAt: new Date("2026-04-25T10:02:00.000Z"),
  abandonedAt: null,
};

const upload = {
  key: "generation-upload",
  method: "PUT" as const,
  url: "https://uploads.airjam.test/generation.zip",
  headers: { "content-type": "application/zip" },
  expiresAt: "2026-04-25T10:10:00.000Z",
};

const makeRelease = (status: "ready" | "live" | "uploading" | "failed") =>
  ({
    id: "release_1",
    gameId: "game_1",
    status,
    promotedGenerationId:
      status === "ready" || status === "live" ? generation.id : null,
    generations: [generation],
  }) as Awaited<ReturnType<typeof assertOwnedRelease>>;

describe("release application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes before publishing and returns the authoritative read-back", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("ready"))
      .mockResolvedValueOnce(makeRelease("live"));

    const result = await publishOwnedRelease({
      actor: { userId: "user_1" },
      releaseId: "release_1",
    });

    expect(result.status).toBe("live");
    expect(assertOwnedRelease).toHaveBeenNthCalledWith(
      1,
      "release_1",
      "user_1",
    );
    expect(publishRelease).toHaveBeenCalledWith({ releaseId: "release_1" });
    expect(assertOwnedRelease).toHaveBeenCalledTimes(2);
  });

  it("returns a terminal failed state when finalization records failure before throwing", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("uploading"))
      .mockResolvedValueOnce(makeRelease("failed"));
    vi.mocked(finalizeReleaseUpload).mockRejectedValueOnce(
      new Error("storage read failed"),
    );

    const result = await finalizeOwnedReleaseUpload({
      actor: { userId: "user_1" },
      releaseId: "release_1",
      generationId: "generation_1",
    });

    expect(result.release.status).toBe("failed");
    expect(result.generation.id).toBe("generation_1");
    expect(finalizeReleaseUpload).toHaveBeenCalledWith({
      release: expect.objectContaining({ id: "release_1" }),
      generationId: "generation_1",
    });
  });

  it("does not treat a different generation's terminal release as a successful retry", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("uploading"))
      .mockResolvedValueOnce(makeRelease("failed"));
    vi.mocked(finalizeReleaseUpload).mockRejectedValueOnce(
      new Error("generation changed"),
    );

    await expect(
      finalizeOwnedReleaseUpload({
        actor: { userId: "user_1" },
        releaseId: "release_1",
        generationId: "stale_generation",
      }),
    ).rejects.toThrow("generation changed");
  });

  it("returns the explicit immutable generation with a new upload target", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("failed"))
      .mockResolvedValueOnce(makeRelease("uploading"));
    vi.mocked(requestReleaseUploadTarget).mockResolvedValueOnce({
      generation,
      upload,
    });

    const result = await requestOwnedReleaseUploadTarget({
      actor: { userId: "user_1" },
      releaseId: "release_1",
      originalFilename: "game.zip",
      sizeBytes: 100,
    });

    expect(result.generation.id).toBe(generation.id);
    expect(result.generation).not.toHaveProperty("zipObjectKey");
    expect(result.upload).toEqual({
      method: upload.method,
      url: upload.url,
      headers: upload.headers,
      expiresAt: upload.expiresAt,
    });
    expect(result.upload).not.toHaveProperty("key");
    expect(result.release.status).toBe("uploading");
  });

  it("moderates only the release's promoted generation", async () => {
    vi.mocked(assertReleaseExists)
      .mockResolvedValueOnce(makeRelease("ready"))
      .mockResolvedValueOnce(makeRelease("ready"));
    vi.mocked(runReleaseModeration).mockResolvedValueOnce({
      generationId: "generation_1",
      screenshot: null,
      moderation: null,
      skipped: false,
      reason: null,
      outcome: "passed",
    });

    await moderateReleaseForOperations({
      actor: { userId: "ops_1", role: "ops_admin" },
      releaseId: "release_1",
    });

    expect(runReleaseModeration).toHaveBeenCalledWith({
      releaseId: "release_1",
      generationId: "generation_1",
    });
    expect(quarantineRelease).not.toHaveBeenCalled();
  });

  it("quarantines a release when operations moderation flags its promoted generation", async () => {
    vi.mocked(assertReleaseExists)
      .mockResolvedValueOnce(makeRelease("live"))
      .mockResolvedValueOnce(makeRelease("ready"));
    vi.mocked(runReleaseModeration).mockResolvedValueOnce({
      generationId: "generation_1",
      screenshot: null,
      moderation: null,
      skipped: false,
      reason: null,
      outcome: "flagged",
    });

    await moderateReleaseForOperations({
      actor: { userId: "ops_1", role: "ops_admin" },
      releaseId: "release_1",
    });

    expect(quarantineRelease).toHaveBeenCalledWith({ releaseId: "release_1" });
  });

  it("enforces the operations actor inside the application boundary", async () => {
    await expect(
      quarantineReleaseForOperations({
        actor: { userId: "user_1", role: "creator" },
        releaseId: "release_1",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    expect(assertReleaseExists).not.toHaveBeenCalled();
    expect(quarantineRelease).not.toHaveBeenCalled();
  });
});
