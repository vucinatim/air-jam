import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./assert-owned-release", () => ({
  assertOwnedRelease: vi.fn(),
}));

vi.mock("./release-artifact-service", () => ({
  finalizeReleaseUpload: vi.fn(),
  requestReleaseUploadTarget: vi.fn(),
}));

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
});
