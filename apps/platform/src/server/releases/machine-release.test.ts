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
import { assertOwnedRelease } from "./assert-owned-release";
import { finalizeReleaseUploadForMachine } from "./machine-release";
import { finalizeReleaseUpload } from "./release-artifact-service";

const makeRelease = (status: "uploading" | "failed") => ({
  id: "rel_1",
  gameId: "game_1",
  sourceKind: "upload" as const,
  status,
  versionLabel: null,
  createdAt: new Date("2026-04-25T10:00:00.000Z"),
  uploadedAt: null,
  checkedAt: null,
  publishedAt: null,
  quarantinedAt: null,
  archivedAt: null,
  artifact: null,
  checks: [],
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
      userId: "user_1",
    });

    expect(result.status).toBe("failed");
    expect(result.id).toBe("rel_1");
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
