import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/operations/production-control-service", () => ({
  assertOperationalLaneAccepting: vi.fn().mockResolvedValue(undefined),
  OperationalAdmissionDeniedError: class OperationalAdmissionDeniedError extends Error {},
}));

vi.mock("@/server/jobs/operational-job-service", () => ({
  enqueueOperationalJob: vi.fn(),
}));

vi.mock("./assert-owned-release", () => ({
  assertOwnedRelease: vi.fn(),
}));

vi.mock("./assert-release-exists", () => ({
  assertReleaseExists: vi.fn(),
}));

vi.mock("./release-artifact-service", () => ({
  requestReleaseUploadTarget: vi.fn(),
}));

vi.mock("./release-status-service", () => ({
  archiveRelease: vi.fn(),
  publishRelease: vi.fn(),
  quarantineRelease: vi.fn(),
}));

import { enqueueOperationalJob } from "@/server/jobs/operational-job-service";
import { assertOwnedRelease } from "./assert-owned-release";
import { assertReleaseExists } from "./assert-release-exists";
import {
  finalizeOwnedReleaseUpload,
  publishOwnedRelease,
  quarantineReleaseForOperations,
  requestOwnedReleaseUploadTarget,
} from "./release-application-service";
import { requestReleaseUploadTarget } from "./release-artifact-service";
import { publishRelease, quarantineRelease } from "./release-status-service";

const now = new Date("2026-04-25T10:01:00.000Z");
const generation = {
  id: "generation_1",
  releaseId: "release_1",
  sequence: 1,
  status: "awaiting_upload" as const,
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
  createdAt: now,
  uploadObservedAt: null,
  processingStartedAt: null,
  readyAt: null,
  failedAt: null,
  abandonedAt: null,
};

const releaseJob = {
  id: "job_1",
  kind: "release_artifact_processing" as const,
  status: "queued" as const,
  releaseId: "release_1",
  generationId: generation.id,
  correlationId: "correlation_1",
  attemptCount: 0,
  maxAttempts: 3,
  progressStage: null,
  progressMessage: null,
  lastErrorCode: null,
  lastErrorRetryable: null,
  availableAt: now,
  deadlineAt: new Date("2026-04-25T11:01:00.000Z"),
  createdAt: now,
  startedAt: null,
  finishedAt: null,
  updatedAt: now,
};

const upload = {
  key: "generation-upload",
  method: "PUT" as const,
  url: "https://uploads.airjam.test/generation.zip",
  headers: { "content-type": "application/zip" },
  expiresAt: "2026-04-25T10:10:00.000Z",
};

const makeRelease = ({
  status,
  jobs = [],
}: {
  status: "ready" | "live" | "uploading" | "failed";
  jobs?: (typeof releaseJob)[];
}) =>
  ({
    id: "release_1",
    gameId: "game_1",
    status,
    candidateGenerationId: status === "uploading" ? generation.id : null,
    promotedGenerationId:
      status === "ready" || status === "live" ? generation.id : null,
    generations: [generation],
    jobs,
  }) as Awaited<ReturnType<typeof assertOwnedRelease>>;

describe("release application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes before publishing and returns the authoritative read-back", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease({ status: "ready" }))
      .mockResolvedValueOnce(makeRelease({ status: "live" }));

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

  it("enqueues one generation-scoped artifact job and returns its durable handle", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease({ status: "uploading" }))
      .mockResolvedValueOnce(
        makeRelease({ status: "uploading", jobs: [releaseJob] }),
      );
    vi.mocked(enqueueOperationalJob).mockResolvedValueOnce({
      job: { id: releaseJob.id } as never,
      replayed: false,
    });

    const result = await finalizeOwnedReleaseUpload({
      actor: { userId: "user_1" },
      releaseId: "release_1",
      generationId: generation.id,
    });

    expect(result.job).toEqual(releaseJob);
    expect(enqueueOperationalJob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "release_artifact_processing",
        creatorId: "user_1",
        gameId: "game_1",
        releaseId: "release_1",
        generationId: generation.id,
        idempotencyKey: `release-finalize:release_1:${generation.id}`,
        payload: { contractVersion: 1, generationId: generation.id },
      }),
    );
  });

  it("reuses an existing generation job without enqueueing duplicate work", async () => {
    vi.mocked(assertOwnedRelease).mockResolvedValueOnce(
      makeRelease({ status: "failed", jobs: [releaseJob] }),
    );

    const result = await finalizeOwnedReleaseUpload({
      actor: { userId: "user_1" },
      releaseId: "release_1",
      generationId: generation.id,
    });

    expect(result.job.id).toBe(releaseJob.id);
    expect(enqueueOperationalJob).not.toHaveBeenCalled();
  });

  it("rejects a generation outside the owned release", async () => {
    vi.mocked(assertOwnedRelease).mockResolvedValueOnce(
      makeRelease({ status: "uploading" }),
    );

    await expect(
      finalizeOwnedReleaseUpload({
        actor: { userId: "user_1" },
        releaseId: "release_1",
        generationId: "stale_generation",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(enqueueOperationalJob).not.toHaveBeenCalled();
  });

  it("returns an explicit immutable generation and redacted upload target", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease({ status: "failed" }))
      .mockResolvedValueOnce(makeRelease({ status: "uploading" }));
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
