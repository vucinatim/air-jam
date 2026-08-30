import { beforeEach, describe, expect, it, vi } from "vitest";

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
  publishOwnedRelease,
  quarantineReleaseForOperations,
} from "./release-application-service";
import { finalizeReleaseUpload } from "./release-artifact-service";
import { publishRelease, quarantineRelease } from "./release-status-service";

const makeRelease = (status: "ready" | "live" | "uploading" | "failed") =>
  ({
    id: "release_1",
    gameId: "game_1",
    status,
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
    });

    expect(result.status).toBe("failed");
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
