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

vi.mock("@/server/games/owned-game-access", () => ({
  resolveOwnedGame: vi.fn(),
}));

vi.mock("./get-release-details", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./get-release-details")>()),
  listReleaseDetailsByGame: vi.fn(),
}));

vi.mock("./release-artifact-service", () => ({
  requestReleaseUploadTarget: vi.fn(),
}));

vi.mock("./release-status-service", () => ({
  archiveRelease: vi.fn(),
  publishRelease: vi.fn(),
  quarantineRelease: vi.fn(),
}));

import { resolveOwnedGame } from "@/server/games/owned-game-access";
import { enqueueOperationalJob } from "@/server/jobs/operational-job-service";
import { assertOwnedRelease } from "./assert-owned-release";
import { assertReleaseExists } from "./assert-release-exists";
import {
  listReleaseDetailsByGame,
  projectReleaseGeneration,
} from "./get-release-details";
import {
  finalizeOwnedReleaseUpload,
  getOwnedRelease,
  listOwnedGameReleases,
  listReleasesForOperations,
  publishOwnedRelease,
  quarantineReleaseForOperations,
  requestOwnedReleaseUploadTarget,
} from "./release-application-service";
import { requestReleaseUploadTarget } from "./release-artifact-service";
import { publishRelease, quarantineRelease } from "./release-status-service";

const now = new Date("2026-04-25T10:01:00.000Z");
const reportMetadata = {
  id: "report_1",
  releaseId: "release_1",
  status: "open" as const,
  source: "play_page" as const,
  createdAt: now,
  reviewedAt: null,
};
const privateReport = {
  ...reportMetadata,
  submissionId: crypto.randomUUID(),
  reason: "Private reporter name in reason",
  details: "Private reporter address in details",
  reporterEmail: "private-reporter@example.test",
  reviewRevision: 0,
  futurePrivateField: "Do not spread future report fields",
};
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
  storageInactiveAt: null,
  storageRetentionWarnedAt: null,
  storageRetentionEligibleAt: null,
  storageCleanupStartedAt: null,
  storageDeletedAt: null,
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
}): Awaited<ReturnType<typeof assertOwnedRelease>> => ({
  id: "release_1",
  gameId: "game_1",
  sourceKind: "upload",
  versionLabel: null,
  createdAt: now,
  uploadedAt: null,
  checkedAt: null,
  publishedAt: null,
  quarantinedAt: null,
  archivedAt: null,
  status,
  candidateGenerationId: status === "uploading" ? generation.id : null,
  promotedGenerationId:
    status === "ready" || status === "live" ? generation.id : null,
  generations: [projectReleaseGeneration(generation, now)],
  candidateGeneration: null,
  promotedGeneration: null,
  checks: [],
  owner: null,
  game: {
    id: "game_1",
    userId: "user_1",
    name: "Pong",
    slug: "pong",
    url: null,
    description: null,
    arcadeVisibility: "hidden",
    config: {},
    createdAt: now,
    updatedAt: now,
  },
  jobs,
  reports: [privateReport],
});

describe("release application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects only report status for creator reads without mutating private records", async () => {
    const release = makeRelease({ status: "live" });
    vi.mocked(assertOwnedRelease).mockResolvedValueOnce(release);
    const result = await getOwnedRelease({
      actor: { userId: "user_1" },
      releaseId: release.id,
    });
    expect(result.reports).toEqual([reportMetadata]);
    expect(release.reports).toEqual([privateReport]);
  });

  it("uses the same report projection for creator list responses", async () => {
    const game = { id: "game_1", userId: "user_1" } as Awaited<
      ReturnType<typeof resolveOwnedGame>
    >;
    vi.mocked(resolveOwnedGame).mockResolvedValueOnce(game);
    vi.mocked(listReleaseDetailsByGame).mockResolvedValueOnce([
      makeRelease({ status: "live" }),
    ]);
    const result = await listOwnedGameReleases({
      actor: { userId: "user_1" },
      gameReference: { kind: "id", gameId: game.id },
    });
    expect(resolveOwnedGame).toHaveBeenCalledWith({
      actor: { userId: "user_1" },
      reference: { kind: "id", gameId: game.id },
    });
    expect(result.releases[0]?.reports).toEqual([reportMetadata]);
  });

  it("does not return an owned release when ownership validation fails", async () => {
    vi.mocked(assertOwnedRelease).mockRejectedValueOnce(
      new Error("Unauthorized"),
    );
    await expect(
      getOwnedRelease({
        actor: { userId: "other_user" },
        releaseId: "release_1",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects creator access to the private operations list in the service itself", async () => {
    await expect(
      listReleasesForOperations({
        actor: { userId: "user_1", role: "creator" },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
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
    expect(result.reports).toEqual([reportMetadata]);
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
    expect(result.release.reports).toEqual([reportMetadata]);
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
    expect(result.release.reports).toEqual([reportMetadata]);
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
    expect(result.release.reports).toEqual([reportMetadata]);
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
