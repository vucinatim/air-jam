// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const waitFor = vi.fn(async () => undefined);
  const getByTestId = vi.fn(() => ({ waitFor }));
  const page = {
    on: vi.fn<(event: string, listener: (error: Error) => void) => void>(),
    goto: vi.fn(async () => undefined),
    getByTestId,
    frameLocator: vi.fn(() => ({ getByTestId })),
    waitForTimeout: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => undefined),
  };
  const context = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  return {
    page,
    context,
    browser,
    waitFor,
    launch: vi.fn(async () => browser),
  };
});

vi.mock("../src/visual/session.js", () => ({
  launchHarnessBrowser: mocks.launch,
}));

import {
  capturePrefabAtRuntime,
  loadPrefabCapture,
} from "../src/visual/prefab-runner";

const roots: string[] = [];
const fixture = (gameId = "fixture-game", captureId = "arena") => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-prefab-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "visual"));
  fs.writeFileSync(
    path.join(root, "visual/prefabs.mjs"),
    `export const prefabCaptureHarness = {
      gameId: ${JSON.stringify(gameId)},
      prefabs: [{
        id: ${JSON.stringify(captureId)}, prefabId: "arena.surface",
        viewport: { width: 640, height: 480 }, waitForTestId: "arena",
        buildHostUrl: (hostUrl, request) => {
          const url = new URL(hostUrl);
          url.searchParams.set("prefab", request.prefabId);
          return url.toString();
        },
      }],
    };`,
  );
  return root;
};

afterEach(() => {
  vi.clearAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("portable prefab capture", () => {
  it("loads a game-owned contract and canonicalizes repeatable variants", async () => {
    const gameDirectory = fixture();
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId: "fixture-game",
      prefabId: "arena.surface",
      variantPairs: ["team=orange", "speed=1", "team=blue"],
    });
    expect(capture.variants).toEqual({ team: "blue", speed: "1" });
    expect(capture.artifactId).toBe("arena__speed-1__team-blue");
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it("rejects absent, mismatched and unknown contracts before launching", async () => {
    const gameDirectory = fixture("another-game");
    await expect(
      loadPrefabCapture({
        gameDirectory,
        gameId: "fixture-game",
        prefabId: "arena",
      }),
    ).rejects.toThrow("Invalid prefab capture harness");
    await expect(
      loadPrefabCapture({
        gameDirectory,
        gameId: "another-game",
        prefabId: "missing",
      }),
    ).rejects.toThrow("Available prefab captures: arena -> arena.surface");
    fs.unlinkSync(path.join(gameDirectory, "visual/prefabs.mjs"));
    await expect(
      loadPrefabCapture({
        gameDirectory,
        gameId: "another-game",
        prefabId: "arena",
      }),
    ).rejects.toThrow("No prefab capture harness");
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it("rejects a definition without a URL builder before launching", async () => {
    const gameDirectory = fixture();
    fs.writeFileSync(
      path.join(gameDirectory, "visual/prefabs.mjs"),
      'export const prefabCaptureHarness = { gameId: "fixture-game", prefabs: [{ id: "broken", prefabId: "broken" }] };',
    );
    await expect(
      loadPrefabCapture({
        gameDirectory,
        gameId: "fixture-game",
        prefabId: "broken",
      }),
    ).rejects.toThrow("Invalid prefab capture harness");
    expect(mocks.launch).not.toHaveBeenCalled();
  });

  it.each(["team", "team=", "=blue", "team=   "])(
    "rejects invalid variant %s",
    async (variant) => {
      await expect(
        loadPrefabCapture({
          gameDirectory: fixture(),
          gameId: "fixture-game",
          prefabId: "arena",
          variantPairs: [variant],
        }),
      ).rejects.toThrow("Expected key=value");
    },
  );

  it("rejects artifact paths that would escape or replace their parent", async () => {
    await expect(
      loadPrefabCapture({
        gameDirectory: fixture(),
        gameId: "..",
        prefabId: "arena",
      }),
    ).rejects.toThrow("Invalid prefab capture game id");
    await expect(
      loadPrefabCapture({
        gameDirectory: fixture("fixture-game", ".."),
        gameId: "fixture-game",
        prefabId: "..",
      }),
    ).rejects.toThrow("Invalid prefab artifact segment");
  });

  it("preserves scoped project identity without nesting artifact directories", async () => {
    const gameId = "@creator/pong";
    const gameDirectory = fixture(gameId);
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId,
      prefabId: "arena",
    });
    const result = await capturePrefabAtRuntime({
      capture,
      hostUrl: "http://localhost:3000",
      artifactRoot: gameDirectory,
    });
    expect(result.metadata.gameId).toBe(gameId);
    expect(result.metadata.screenshot.relativePath).toBe(
      "%40creator%2Fpong/prefabs/arena/prefab.png",
    );
  });

  it.each(["standalone-dev", "arcade-built"] as const)(
    "captures %s and closes its browser without owning the runtime",
    async (mode) => {
      const gameDirectory = fixture();
      const capture = await loadPrefabCapture({
        gameDirectory,
        gameId: "fixture-game",
        prefabId: "arena",
        mode,
      });
      const result = await capturePrefabAtRuntime({
        capture,
        hostUrl: "http://localhost:3000/",
        artifactRoot: gameDirectory,
      });
      expect(result.metadata.runtimeMode).toBe(mode);
      expect(result.metadata.viewport).toEqual({ width: 640, height: 480 });
      expect(result.metadata.url).toBe(
        "http://localhost:3000/?prefab=arena.surface",
      );
      expect(result.metadata.screenshot.relativePath).toBe(
        "fixture-game/prefabs/arena/prefab.png",
      );
      expect(JSON.parse(fs.readFileSync(result.metadataPath, "utf8"))).toEqual(
        result.metadata,
      );
      expect(mocks.page.frameLocator).toHaveBeenCalledTimes(
        mode === "arcade-built" ? 1 : 0,
      );
      expect(mocks.waitFor).toHaveBeenCalledWith({
        state: "visible",
        timeout: 30_000,
      });
      expect(mocks.context.close).toHaveBeenCalledOnce();
      expect(mocks.browser.close).toHaveBeenCalledOnce();
    },
  );

  it("clears old success evidence and closes browser/context when capture fails", async () => {
    const gameDirectory = fixture();
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId: "fixture-game",
      prefabId: "arena",
    });
    const options = {
      capture,
      hostUrl: "http://localhost:3000",
      artifactRoot: gameDirectory,
    };
    const result = await capturePrefabAtRuntime(options);
    mocks.page.screenshot.mockRejectedValueOnce(new Error("Screenshot failed"));
    await expect(capturePrefabAtRuntime(options)).rejects.toThrow(
      "Screenshot failed",
    );
    expect(fs.existsSync(result.metadataPath)).toBe(false);
    expect(mocks.context.close).toHaveBeenCalledTimes(2);
    expect(mocks.browser.close).toHaveBeenCalledTimes(2);
  });

  it("closes the browser when context creation fails", async () => {
    const gameDirectory = fixture();
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId: "fixture-game",
      prefabId: "arena",
    });
    mocks.browser.newContext.mockRejectedValueOnce(new Error("Context failed"));
    await expect(
      capturePrefabAtRuntime({
        capture,
        hostUrl: "http://localhost:3000",
        artifactRoot: gameDirectory,
      }),
    ).rejects.toThrow("Context failed");
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("rejects runtime page errors and closes every browser resource", async () => {
    const gameDirectory = fixture();
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId: "fixture-game",
      prefabId: "arena",
    });
    mocks.page.goto.mockImplementationOnce(async () => {
      mocks.page.on.mock.calls[0][1](new Error("Game render failed"));
    });
    await expect(
      capturePrefabAtRuntime({
        capture,
        hostUrl: "http://localhost:3000",
        artifactRoot: gameDirectory,
      }),
    ).rejects.toThrow("Game render failed");
    expect(mocks.page.screenshot).not.toHaveBeenCalled();
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("clears old evidence even when the game-owned URL builder fails", async () => {
    const gameDirectory = fixture();
    const capture = await loadPrefabCapture({
      gameDirectory,
      gameId: "fixture-game",
      prefabId: "arena",
    });
    const options = {
      capture,
      hostUrl: "http://localhost:3000",
      artifactRoot: gameDirectory,
    };
    const result = await capturePrefabAtRuntime(options);
    const failedCapture = {
      ...capture,
      prefab: {
        ...capture.prefab,
        buildHostUrl: () => {
          throw new Error("URL failed");
        },
      },
    };
    await expect(
      capturePrefabAtRuntime({ ...options, capture: failedCapture }),
    ).rejects.toThrow("URL failed");
    expect(fs.existsSync(result.metadataPath)).toBe(false);
    expect(mocks.launch).toHaveBeenCalledOnce();
  });
});
