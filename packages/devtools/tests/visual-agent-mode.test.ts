import { afterEach, describe, expect, it, vi } from "vitest";
import { openGameSession } from "../src/game-session.js";
import type { RunVisualHarnessOptions } from "../src/harness/visual.js";

vi.mock("../src/game-session.js", () => ({
  openGameSession: vi.fn(async () => ({ gameSessionId: "fixture-session" })),
  closeGameSession: vi.fn(async () => undefined),
  readGameSession: vi.fn(),
  invokeGameSessionAction: vi.fn(),
}));
vi.mock("../src/tooling/visual-pack.js", () => ({
  loadVisualScenarioPackFromModuleOrConfig: vi.fn(async () => ({
    scenarios: [],
  })),
}));
vi.mock("../src/harness/visual.js", () => ({
  runVisualHarness: vi.fn(async (options: RunVisualHarnessOptions) => {
    const session = await options.createAgentSession?.({
      gameId: options.gameId,
      scenarioId: "lobby",
      mode: options.mode ?? "standalone-dev",
      secure: options.secure ?? false,
      urls: {
        appOrigin: "http://localhost:4510",
        hostUrl: "http://localhost:4510/arcade/local-pong",
        controllerBaseUrl: "http://localhost:4510/controller",
        publicHost: "http://localhost:4510",
        localBuildUrl: null,
        browserBuildUrl: null,
        controllerJoinUrl: "http://localhost:4510/controller?room=ROOM1",
      },
    });
    await session?.close();
    return { scenarios: [] };
  }),
}));

const originalArguments = process.argv;
afterEach(() => {
  process.argv = originalArguments;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("visual helper semantic sessions", () => {
  it.each(["standalone-dev", "arcade-test"] as const)(
    "uses the capture runtime mode for semantic state (%s)",
    async (mode) => {
      vi.resetModules();
      const exit = vi
        .spyOn(process, "exit")
        .mockReturnValue(undefined as never);
      process.argv = [
        process.execPath,
        "run-visual-capture",
        "--config=/tmp/game/airjam.config.ts",
        "--artifact-root=/tmp/artifacts",
        "--host-url=http://localhost:4510",
        "--app-origin=http://localhost:4510",
        "--controller-base-url=http://localhost:4510/controller",
        "--public-host=http://localhost:4510",
        "--game-id=pong",
        `--mode=${mode}`,
        "--secure",
      ];
      await import("../src/tooling/run-visual-capture.js");
      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
      expect(openGameSession).toHaveBeenCalledWith({
        cwd: process.cwd(),
        gameId: "pong",
        mode,
        secure: true,
        controllerJoinUrl: "http://localhost:4510/controller?room=ROOM1",
      });
    },
  );
});
