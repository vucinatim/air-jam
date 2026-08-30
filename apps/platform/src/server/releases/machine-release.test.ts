import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/operations/production-control-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/operations/production-control-service")
  >("@/server/operations/production-control-service");
  return {
    ...actual,
    assertOperationalLaneAccepting: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./assert-owned-release", () => ({
  assertOwnedRelease: vi.fn(),
}));

vi.mock("./release-artifact-service", () => ({
  finalizeReleaseUpload: vi.fn(),
  requestReleaseUploadTarget: vi.fn(),
}));

import {
  assertOperationalLaneAccepting,
  OperationalAdmissionDeniedError,
} from "@/server/operations/production-control-service";
import {
  platformMachineFinalizeReleaseUploadResultSchema,
  platformMachineRequestReleaseUploadTargetResultSchema,
} from "@air-jam/sdk/platform-machine";
import { assertOwnedRelease } from "./assert-owned-release";
import {
  finalizeReleaseUploadForMachine,
  requestReleaseUploadTargetForMachine,
} from "./machine-release";
import {
  finalizeReleaseUpload,
  requestReleaseUploadTarget,
} from "./release-artifact-service";

const generation = {
  id: "generation_1",
  releaseId: "rel_1",
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

const makeRelease = (status: "uploading" | "failed") => ({
  id: "rel_1",
  gameId: "game_1",
  sourceKind: "upload" as const,
  status,
  candidateGenerationId: status === "uploading" ? generation.id : null,
  promotedGenerationId: null,
  versionLabel: null,
  createdAt: new Date("2026-04-25T10:00:00.000Z"),
  uploadedAt: null,
  checkedAt: null,
  publishedAt: null,
  quarantinedAt: null,
  archivedAt: null,
  candidateGeneration: status === "uploading" ? generation : null,
  promotedGeneration: null,
  generations: [generation],
  checks: [
    {
      id: "check_1",
      releaseId: "rel_1",
      generationId: generation.id,
      jobId: null,
      jobAttempt: null,
      kind: "artifact_validation" as const,
      status: "passed" as const,
      summary: "validated",
      payload: {
        zipObjectKey: "private-generation-zip-key",
        siteRootKey: "private-generation-site-key",
      },
      createdAt: new Date("2026-04-25T10:03:00.000Z"),
    },
  ],
  reports: [],
  game: {
    id: "game_1",
    slug: "pong",
    name: "Pong",
    description: null,
    url: null,
    arcadeVisibility: "hidden" as const,
    userId: "user_1",
    config: {},
    createdAt: new Date("2026-04-25T09:00:00.000Z"),
    updatedAt: new Date("2026-04-25T09:30:00.000Z"),
  },
});

describe("finalizeReleaseUploadForMachine", () => {
  beforeEach(() => {
    vi.mocked(assertOwnedRelease).mockReset();
    vi.mocked(finalizeReleaseUpload).mockReset();
    vi.mocked(requestReleaseUploadTarget).mockReset();
    vi.mocked(assertOperationalLaneAccepting).mockReset();
    vi.mocked(assertOperationalLaneAccepting).mockResolvedValue(undefined);
  });

  it("returns the failed release summary when finalize leaves the release in failed state", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("uploading"))
      .mockResolvedValueOnce(makeRelease("failed"));
    vi.mocked(finalizeReleaseUpload).mockRejectedValueOnce(
      new Error("fetch failed"),
    );

    const result = await finalizeReleaseUploadForMachine({
      releaseId: "rel_1",
      generationId: "generation_1",
      userId: "user_1",
    });

    expect(result.release.status).toBe("failed");
    expect(result.release.id).toBe("rel_1");
    expect(result.generation.id).toBe("generation_1");
    expect(result.generation).not.toHaveProperty("zipObjectKey");
    expect(() =>
      platformMachineFinalizeReleaseUploadResultSchema.parse(result),
    ).not.toThrow();
  });

  it("returns a public generation beside the upload target", async () => {
    vi.mocked(assertOwnedRelease)
      .mockResolvedValueOnce(makeRelease("failed"))
      .mockResolvedValueOnce(makeRelease("uploading"));
    vi.mocked(requestReleaseUploadTarget).mockResolvedValueOnce({
      generation,
      upload: {
        key: "generation-upload",
        method: "PUT",
        url: "https://uploads.airjam.test/generation.zip",
        headers: { "content-type": "application/zip" },
        expiresAt: "2026-04-25T10:10:00.000Z",
      },
    });

    const result = await requestReleaseUploadTargetForMachine({
      releaseId: "rel_1",
      userId: "user_1",
      originalFilename: "game.zip",
      sizeBytes: 100,
    });

    expect(result.generation.id).toBe("generation_1");
    expect(result.generation).not.toHaveProperty("zipObjectKey");
    expect(result.release).not.toHaveProperty("artifact");
    expect(result.release.hostUrl).toBeNull();
    expect(result.upload).not.toHaveProperty("key");
    expect(JSON.stringify(result)).not.toContain("private-generation-zip-key");
    expect(JSON.stringify(result)).not.toContain("private-generation-site-key");
    expect(() =>
      platformMachineRequestReleaseUploadTargetResultSchema.parse(result),
    ).not.toThrow();
  });

  it("preserves structured lane denial for machine callers", async () => {
    vi.mocked(assertOwnedRelease).mockResolvedValueOnce(
      makeRelease("uploading"),
    );
    const decision = {
      contractVersion: 1 as const,
      decisionId: "decision-1",
      lane: "release_processing" as const,
      controlStatus: "available" as const,
      mode: "paused" as const,
      outcome: "denied" as const,
      reason: "lane_paused" as const,
      retryAfterSeconds: 90,
      controlRevision: 2,
    };
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(
      new OperationalAdmissionDeniedError(decision),
    );

    await expect(
      finalizeReleaseUploadForMachine({
        releaseId: "rel_1",
        generationId: "generation_1",
        userId: "user_1",
      }),
    ).rejects.toMatchObject({
      code: "rate_limited",
      status: 503,
      retryAfterSeconds: 90,
      details: { decision },
    });
    expect(finalizeReleaseUpload).not.toHaveBeenCalled();
  });
});
