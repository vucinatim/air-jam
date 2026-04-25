import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bundleLocalRelease,
  inspectLocalRelease,
  listPlatformReleaseTargets,
  submitPlatformRelease,
  validateLocalRelease,
} from "../src/index.js";

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-release-"));
  tempRoots.push(root);
  return root;
};

const createReleaseFixture = async ({
  controllerPath = "/controller",
  metadata = true,
}: {
  controllerPath?: string;
  metadata?: boolean;
} = {}) => {
  const root = await createTempRoot();
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "dist", "assets"), { recursive: true });

  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "release-fixture",
        version: "1.2.3",
        packageManager: "pnpm@10.19.0",
        scripts: {
          build: 'node -e "process.exit(0)"',
        },
        dependencies: {
          "@air-jam/sdk": "^1.0.0",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    path.join(root, "src", "airjam.config.ts"),
    `${metadata ? 'export const gameMetadata = { title: "Fixture" };\n' : ""}export const airjam = { game: { controllerPath: "${controllerPath}" } };\n`,
    "utf8",
  );

  await writeFile(
    path.join(root, "dist", "index.html"),
    "<!doctype html><html><body>fixture</body></html>\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "dist", "assets", "app.js"),
    'console.log("fixture");\n',
    "utf8",
  );

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

describe("local release tooling", () => {
  it("inspects hosted release readiness from project config", async () => {
    const root = await createReleaseFixture();

    const doctor = await inspectLocalRelease({ cwd: root });

    expect(doctor.canBundle).toBe(true);
    expect(doctor.metadataExportLikely).toBe(true);
    expect(doctor.distEntryExists).toBe(true);
    expect(doctor.recommendedBundlePath).toContain(
      ".airjam/releases/1.2.3/release-fixture-hosted-release.zip",
    );
    expect(doctor.configPath).toBe(path.join(root, "src", "airjam.config.ts"));
  });

  it("reports invalid hosted controller paths", async () => {
    const root = await createReleaseFixture({
      controllerPath: "/play",
      metadata: false,
    });

    const doctor = await inspectLocalRelease({ cwd: root });

    expect(doctor.canBundle).toBe(false);
    expect(doctor.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-controller-path",
          severity: "error",
        }),
        expect.objectContaining({
          code: "missing-game-metadata",
          severity: "warning",
        }),
      ]),
    );
  });

  it("bundles and validates a hosted release archive", async () => {
    const root = await createReleaseFixture();

    const bundled = await bundleLocalRelease({
      cwd: root,
      skipBuild: true,
    });

    expect(bundled.outputFile).toContain(
      ".airjam/releases/1.2.3/release-fixture-hosted-release.zip",
    );
    expect(bundled.validation.ok).toBe(true);

    const validation = await validateLocalRelease({
      cwd: root,
      bundlePath: bundled.outputFile,
    });

    expect(validation.ok).toBe(true);
    expect(validation.fileCount).toBe(3);
    expect(validation.manifest).toEqual({
      schemaVersion: 1,
      kind: "airjam-hosted-release",
      routes: {
        host: "/",
        controller: "/controller",
      },
    });
  });

  it("lists owned hosted release targets through the machine API", async () => {
    const fetchMock = vi.fn(async (input) => {
      expect(String(input)).toBe("https://platform.airjam.test/api/cli/games");

      return new Response(
        JSON.stringify({
          games: [
            {
              id: "game_1",
              slug: "pong",
              name: "Pong",
              sourceUrl: null,
              templateId: "pong",
              createdAt: "2026-04-25T10:00:00.000Z",
              updatedAt: "2026-04-25T11:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listPlatformReleaseTargets({
      platformUrl: "https://platform.airjam.test",
      token: "machine-token",
    });

    expect(result.games).toHaveLength(1);
    expect(result.games[0]?.slug).toBe("pong");
  });

  it("submits and publishes a hosted release through the machine API", async () => {
    const root = await createReleaseFixture();
    const bundled = await bundleLocalRelease({
      cwd: root,
      skipBuild: true,
    });

    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (url === "https://platform.airjam.test/api/cli/releases") {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            release: {
              id: "rel_1",
              gameId: "game_1",
              sourceKind: "upload",
              status: "draft",
              versionLabel: "v1",
              createdAt: "2026-04-25T10:00:00.000Z",
              uploadedAt: null,
              checkedAt: null,
              publishedAt: null,
              quarantinedAt: null,
              archivedAt: null,
              game: {
                id: "game_1",
                slug: "pong",
                name: "Pong",
                sourceUrl: null,
                templateId: "pong",
                createdAt: "2026-04-25T09:00:00.000Z",
                updatedAt: "2026-04-25T09:30:00.000Z",
              },
              artifact: null,
              checks: [],
              reports: [],
              hostUrl: null,
              controllerUrl: null,
            },
          }),
          { status: 200 },
        );
      }

      if (
        url ===
        "https://platform.airjam.test/api/cli/releases/rel_1/upload-target"
      ) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            release: {
              id: "rel_1",
              gameId: "game_1",
              sourceKind: "upload",
              status: "uploading",
              versionLabel: "v1",
              createdAt: "2026-04-25T10:00:00.000Z",
              uploadedAt: null,
              checkedAt: null,
              publishedAt: null,
              quarantinedAt: null,
              archivedAt: null,
              game: {
                id: "game_1",
                slug: "pong",
                name: "Pong",
                sourceUrl: null,
                templateId: "pong",
                createdAt: "2026-04-25T09:00:00.000Z",
                updatedAt: "2026-04-25T09:30:00.000Z",
              },
              artifact: null,
              checks: [],
              reports: [],
              hostUrl: null,
              controllerUrl: null,
            },
            upload: {
              key: "releases/game_1/rel_1.zip",
              method: "PUT",
              url: "https://uploads.airjam.test/release.zip",
              headers: {
                "content-type": "application/zip",
              },
              expiresAt: "2026-04-25T11:00:00.000Z",
            },
          }),
          { status: 200 },
        );
      }

      if (url === "https://uploads.airjam.test/release.zip") {
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBeInstanceOf(Uint8Array);
        return new Response(null, { status: 200 });
      }

      if (
        url === "https://platform.airjam.test/api/cli/releases/rel_1/finalize"
      ) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            release: {
              id: "rel_1",
              gameId: "game_1",
              sourceKind: "upload",
              status: "ready",
              versionLabel: "v1",
              createdAt: "2026-04-25T10:00:00.000Z",
              uploadedAt: "2026-04-25T10:05:00.000Z",
              checkedAt: "2026-04-25T10:06:00.000Z",
              publishedAt: null,
              quarantinedAt: null,
              archivedAt: null,
              game: {
                id: "game_1",
                slug: "pong",
                name: "Pong",
                sourceUrl: null,
                templateId: "pong",
                createdAt: "2026-04-25T09:00:00.000Z",
                updatedAt: "2026-04-25T09:30:00.000Z",
              },
              artifact: {
                id: "artifact_1",
                releaseId: "rel_1",
                originalFilename: path.basename(bundled.outputFile),
                contentType: "application/zip",
                sizeBytes: 123,
                extractedSizeBytes: 456,
                fileCount: 3,
                entryPath: "index.html",
                contentHash: "hash",
                createdAt: "2026-04-25T10:05:00.000Z",
              },
              checks: [],
              reports: [],
              hostUrl: "https://cdn.airjam.test/games/game_1/releases/rel_1/",
              controllerUrl:
                "https://cdn.airjam.test/games/game_1/releases/rel_1/controller",
            },
          }),
          { status: 200 },
        );
      }

      if (
        url === "https://platform.airjam.test/api/cli/releases/rel_1/publish"
      ) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            release: {
              id: "rel_1",
              gameId: "game_1",
              sourceKind: "upload",
              status: "live",
              versionLabel: "v1",
              createdAt: "2026-04-25T10:00:00.000Z",
              uploadedAt: "2026-04-25T10:05:00.000Z",
              checkedAt: "2026-04-25T10:06:00.000Z",
              publishedAt: "2026-04-25T10:07:00.000Z",
              quarantinedAt: null,
              archivedAt: null,
              game: {
                id: "game_1",
                slug: "pong",
                name: "Pong",
                sourceUrl: null,
                templateId: "pong",
                createdAt: "2026-04-25T09:00:00.000Z",
                updatedAt: "2026-04-25T09:30:00.000Z",
              },
              artifact: {
                id: "artifact_1",
                releaseId: "rel_1",
                originalFilename: path.basename(bundled.outputFile),
                contentType: "application/zip",
                sizeBytes: 123,
                extractedSizeBytes: 456,
                fileCount: 3,
                entryPath: "index.html",
                contentHash: "hash",
                createdAt: "2026-04-25T10:05:00.000Z",
              },
              checks: [],
              reports: [],
              hostUrl: "https://cdn.airjam.test/games/game_1/releases/rel_1/",
              controllerUrl:
                "https://cdn.airjam.test/games/game_1/releases/rel_1/controller",
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitPlatformRelease({
      platformUrl: "https://platform.airjam.test",
      token: "machine-token",
      slugOrId: "pong",
      versionLabel: "v1",
      bundlePath: bundled.outputFile,
      publish: true,
    });

    expect(result.createdRelease.status).toBe("draft");
    expect(result.finalizedRelease.status).toBe("ready");
    expect(result.publishedRelease?.status).toBe("live");
  });
});
