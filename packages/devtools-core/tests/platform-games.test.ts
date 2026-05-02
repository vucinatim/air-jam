import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlatformGame,
  inspectPlatformGame,
  listPlatformGames,
  readLocalHostedGameDefaults,
  updatePlatformGame,
} from "../src/index.js";

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-platform-games-"));
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

describe("platform game tooling", () => {
  it("reads local hosted game defaults from metadata and template manifest", async () => {
    const root = await createTempRoot();
    const gameRoot = path.join(root, "games", "minimal");
    await mkdir(path.join(gameRoot, "src"), { recursive: true });
    await writeFile(
      path.join(gameRoot, "package.json"),
      `${JSON.stringify(
        {
          name: "minimal",
          type: "module",
          packageManager: "pnpm@10.19.0",
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
      path.join(gameRoot, "airjam-template.json"),
      `${JSON.stringify(
        {
          id: "minimal",
          name: "Minimal",
          description: "Template summary.",
          category: "showcase",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      path.join(gameRoot, "src", "airjam.config.ts"),
      `
        export const gameMetadata = {
          version: 1,
          slug: "minimal",
          name: "Minimal",
          tagline: "Clean-slate starter.",
          category: "showcase",
          minPlayers: 1,
          maxPlayers: 4,
          inputModalities: ["buttons"],
          supportedSdkRange: "^1.0.0",
          maintainer: { name: "Air Jam" }
        };
        export const airjam = { metadata: gameMetadata, controllerPath: "/controller" };
      `,
      "utf8",
    );
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://github.com/vucinatim/airjam.git"],
      { cwd: root },
    );

    const defaults = await readLocalHostedGameDefaults({ cwd: gameRoot });

    expect(defaults.metadata.name).toBe("Minimal");
    expect(defaults.metadata.slug).toBe("minimal");
    expect(defaults.metadata.description).toBe("Clean-slate starter.");
    expect(defaults.template.id).toBe("minimal");
    expect(defaults.sourceUrl).toBe(
      "https://github.com/vucinatim/airjam/tree/main/games/minimal",
    );
  });

  it("lists, inspects, creates, and updates platform games through the machine API", async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (
        url === "https://platform.airjam.test/api/cli/games" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return new Response(
          JSON.stringify({
            games: [
              {
                id: "game_1",
                slug: "minimal",
                name: "Minimal",
                description: "Clean-slate starter.",
                url: null,
                arcadeVisibility: "hidden",
                sourceUrl: null,
                templateId: "minimal",
                createdAt: "2026-05-03T12:00:00.000Z",
                updatedAt: "2026-05-03T12:10:00.000Z",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (
        url === "https://platform.airjam.test/api/cli/games/minimal" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: "Clean-slate starter.",
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:10:00.000Z",
            },
          }),
          { status: 200 },
        );
      }

      if (url === "https://platform.airjam.test/api/cli/games" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toMatchObject({
          name: "Minimal",
          slug: "minimal",
        });

        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: "Clean-slate starter.",
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:10:00.000Z",
            },
          }),
          { status: 200 },
        );
      }

      if (
        url === "https://platform.airjam.test/api/cli/games/minimal" &&
        init?.method === "PATCH"
      ) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          description: "Updated",
          arcadeVisibility: "hidden",
        });

        return new Response(
          JSON.stringify({
            game: {
              id: "game_1",
              slug: "minimal",
              name: "Minimal",
              description: "Updated",
              url: null,
              arcadeVisibility: "hidden",
              sourceUrl: null,
              templateId: "minimal",
              createdAt: "2026-05-03T12:00:00.000Z",
              updatedAt: "2026-05-03T12:11:00.000Z",
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const listed = await listPlatformGames({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
    });
    expect(listed.games[0]?.slug).toBe("minimal");

    const inspected = await inspectPlatformGame({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      slugOrId: "minimal",
    });
    expect(inspected.game.templateId).toBe("minimal");

    const created = await createPlatformGame({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      input: {
        name: "Minimal",
        slug: "minimal",
      },
    });
    expect(created.game.id).toBe("game_1");

    const updated = await updatePlatformGame({
      platformUrl: "https://platform.airjam.test",
      token: "agent-token",
      slugOrId: "minimal",
      input: {
        description: "Updated",
        arcadeVisibility: "hidden",
      },
    });
    expect(updated.game.description).toBe("Updated");
  });
});
