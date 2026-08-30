import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createPage = () => ({
    setViewportSize: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => undefined),
    viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  });
  return {
    browserClose: vi.fn(async () => undefined),
    hostPage: createPage(),
    controllerPage: createPage(),
    sessionClose: vi.fn(async () => undefined),
  };
});

vi.mock("../src/visual/session.js", () => ({
  DEFAULT_HOST_VIEWPORT: { width: 1280, height: 720 },
  dismissHarnessControllerFullscreenPrompt: vi.fn(async () => false),
  launchHarnessBrowser: vi.fn(async () => ({ close: mocks.browserClose })),
  openVisualHarnessSession: vi.fn(async () => ({
    urls: {
      appOrigin: "http://127.0.0.1:3000",
      hostUrl: "http://127.0.0.1:3000",
      controllerBaseUrl: "http://127.0.0.1:3000/controller",
      publicHost: "http://127.0.0.1:3000",
      localBuildUrl: null,
      browserBuildUrl: null,
      controllerJoinUrl: "http://127.0.0.1:3000/controller?room=ROOM1",
    },
    host: {
      page: mocks.hostPage,
      game: {},
      embedded: false,
    },
    controller: {
      page: mocks.controllerPage,
      game: {},
      embedded: false,
      fullscreenPromptDismissed: false,
    },
    close: mocks.sessionClose,
  })),
}));

import { runVisualHarness } from "../src/visual/runner";

const artifactRoots: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    artifactRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("visual scenario runner", () => {
  it("captures host and controller proof without a second action bridge", async () => {
    const artifactRoot = await mkdtemp(
      path.join(os.tmpdir(), "airjam-visual-runner-"),
    );
    artifactRoots.push(artifactRoot);
    const shutdown = vi.fn(async () => undefined);

    const summary = await runVisualHarness({
      gameId: "fixture-game",
      artifactRoot,
      loadScenarioPack: async () => ({
        agent: {} as never,
        scenarios: [
          {
            id: "lobby",
            description: "Lobby proof",
            run: async (context) => {
              await context.captureHost("desktop", {
                width: 1280,
                height: 720,
              });
              await context.captureController("phone", {
                width: 390,
                height: 844,
              });
            },
          },
        ],
      }),
      startStack: async () => ({
        urls: {
          appOrigin: "http://127.0.0.1:3000",
          hostUrl: "http://127.0.0.1:3000",
          controllerBaseUrl: "http://127.0.0.1:3000/controller",
          publicHost: "http://127.0.0.1:3000",
          localBuildUrl: null,
          browserBuildUrl: null,
        },
        shutdown,
      }),
    });

    expect(summary.scenarios).toEqual([
      expect.objectContaining({
        scenarioId: "lobby",
        status: "captured",
        screenshotCount: 2,
      }),
    ]);
    expect(mocks.hostPage.screenshot).toHaveBeenCalledOnce();
    expect(mocks.controllerPage.screenshot).toHaveBeenCalledOnce();
    expect(mocks.sessionClose).toHaveBeenCalledOnce();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();

    const metadata = JSON.parse(
      await readFile(
        path.join(artifactRoot, "fixture-game", "lobby", "metadata.json"),
        "utf8",
      ),
    ) as { screenshots: Array<{ surface: string }> };
    expect(metadata.screenshots.map((entry) => entry.surface)).toEqual([
      "host",
      "controller",
    ]);
  });
});
