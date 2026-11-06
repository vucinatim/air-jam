import { afterEach, expect, it, vi } from "vitest";
import {
  archivePlatformRelease,
  inspectPlatformRelease,
  listPlatformReleases,
} from "../src/release";

const release = {
  id: "hidden-release",
  gameId: "game",
  sourceKind: "upload",
  status: "live",
  candidateGenerationId: null,
  promotedGenerationId: null,
  versionLabel: "v1",
  createdAt: "2026-11-01T00:00:00Z",
  uploadedAt: null,
  checkedAt: null,
  publishedAt: "2026-11-01T00:00:00Z",
  quarantinedAt: null,
  archivedAt: null,
  game: {
    id: "game",
    name: "Hidden game",
    slug: "hidden-game",
    description: null,
    url: null,
    arcadeVisibility: "hidden",
    sourceUrl: null,
    templateId: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  },
  candidateGeneration: null,
  promotedGeneration: null,
  generations: [],
  checks: [],
  jobs: [],
  reports: [],
  playUrl: "https://platform.example/play/hidden-release",
  hostUrl: null,
  controllerUrl: null,
};

afterEach(() => vi.unstubAllGlobals());

it.each(["hidden", "listed"])(
  "preserves exact play links while inspecting, listing and archiving a %s release",
  async (arcadeVisibility) => {
    const fixture = { ...release, game: { ...release.game, arcadeVisibility } };
    const requests: { url: string; method: string }[] = [];
    const fetch = vi.fn(
      async (input: string | URL | Request, options?: RequestInit) => {
        const url = String(input);
        const method = options?.method ?? "GET";
        expect(new Headers(options?.headers).get("authorization")).toBe(
          "Bearer fixture-token",
        );
        requests.push({ url, method });
        if (url.endsWith("/archive"))
          return Response.json({
            release: {
              ...fixture,
              status: "archived",
              archivedAt: "2026-11-02T00:00:00Z",
            },
          });
        if (url.includes("/games/"))
          return Response.json({ game: fixture.game, releases: [fixture] });
        return Response.json({ release: fixture });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const auth = {
      platformUrl: "https://platform.example",
      token: "fixture-token",
    };
    expect(
      (await inspectPlatformRelease({ ...auth, releaseId: fixture.id })).release
        .playUrl,
    ).toBe(release.playUrl);
    expect(
      (await listPlatformReleases({ ...auth, slugOrId: "hidden-game" }))
        .releases[0].playUrl,
    ).toBe(release.playUrl);
    const archived = await archivePlatformRelease({
      ...auth,
      releaseId: fixture.id,
    });
    expect(archived.release.status).toBe("archived");
    expect(archived.release.playUrl).toBe(release.playUrl);
    expect(requests).toEqual([
      {
        url: "https://platform.example/api/cli/releases/hidden-release",
        method: "GET",
      },
      {
        url: "https://platform.example/api/cli/games/hidden-game/releases",
        method: "GET",
      },
      {
        url: "https://platform.example/api/cli/releases/hidden-release/archive",
        method: "POST",
      },
    ]);
  },
);

it("propagates archive refusal instead of reporting a retired release", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: "not_found", message: "Release not found." },
        { status: 404 },
      ),
    ),
  );
  await expect(
    archivePlatformRelease({
      platformUrl: "https://platform.example",
      token: "fixture-token",
      releaseId: "someone-elses-release",
    }),
  ).rejects.toThrow("Release not found");
});
