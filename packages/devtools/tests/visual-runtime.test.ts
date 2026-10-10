import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCommandResult } from "../src/commands.js";
import { startDev, stopDev, tryAttachToRunningDev } from "../src/dev.js";
import { inspectAirJamAgentConfig } from "../src/tooling/airjam-agent-inspection.js";
import {
  captureVisualsAtRuntime,
  type CaptureVisualsAtRuntimeOptions,
} from "../src/visual.js";

vi.mock("../src/commands.js", () => ({ runCommandResult: vi.fn() }));
vi.mock("../src/dev.js", () => ({
  getTopology: vi.fn(),
  startDev: vi.fn(),
  stopDev: vi.fn(),
  tryAttachToRunningDev: vi.fn(),
}));
vi.mock("../src/tooling/airjam-agent-inspection.js", () => ({
  inspectAirJamAgentConfig: vi.fn(),
}));

describe("capture against a caller-owned runtime", () => {
  let root: string;
  let options: CaptureVisualsAtRuntimeOptions;

  beforeEach(() => {
    vi.resetAllMocks();
    root = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "airjam-visual-runtime-")),
    );
    const project = path.join(root, "project");
    fs.mkdirSync(project);
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({
        name: "external-game",
        dependencies: { "@air-jam/sdk": "0.9.3" },
      }),
    );
    fs.writeFileSync(
      path.join(project, "airjam.config.ts"),
      "export default {};",
    );
    options = {
      cwd: project,
      artifactRoot: path.join(root, "product-artifacts"),
      mode: "arcade-built",
      secure: false,
      urls: {
        appOrigin: "http://localhost:3500",
        hostUrl: "http://localhost:3500/arcade/local-pong",
        controllerBaseUrl: "http://localhost:3500/controller",
        publicHost: "http://localhost:3500",
        localBuildUrl: "http://localhost:3500/airjam-local-builds/pong",
        browserBuildUrl: "http://localhost:3500/airjam-local-builds/pong",
      },
    };
    vi.mocked(inspectAirJamAgentConfig).mockResolvedValue({
      hasAgent: true,
      visualScenariosModulePath: path.join(project, "visual/scenarios.ts"),
    });
    vi.mocked(runCommandResult).mockImplementation((command) => {
      const summary = {
        gameId: "external-game",
        mode: options.mode,
        secure: options.secure,
        capturedAt: "2026-10-09T00:00:00.000Z",
        scenarios: [],
      };
      const directory = path.join(options.artifactRoot, "external-game");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "capture-summary.json"),
        JSON.stringify(summary),
      );
      return {
        ...command,
        exitCode: 0,
        signal: null,
        durationMs: 0,
        stdout: JSON.stringify(summary),
        stderr: "",
        ok: true,
      };
    });
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("uses external project sources and caller artifact paths without owning processes", async () => {
    const result = await captureVisualsAtRuntime({
      ...options,
      scenarioId: "lobby",
    });
    expect(result.gameId).toBe("external-game");
    expect(result.summaryPath).toBe(
      path.join(options.artifactRoot, "external-game/capture-summary.json"),
    );
    expect(result.summary.mode).toBe("arcade-built");
    expect(runCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: options.cwd,
        args: expect.arrayContaining([
          "--game-id=external-game",
          "--mode=arcade-test",
          "--scenario-id=lobby",
          `--artifact-root=${options.artifactRoot}`,
          `--host-url=${options.urls.hostUrl}`,
        ]),
      }),
    );
    expect(startDev).not.toHaveBeenCalled();
    expect(stopDev).not.toHaveBeenCalled();
    expect(tryAttachToRunningDev).not.toHaveBeenCalled();
  });

  it("keeps standalone capture on the same implementation", async () => {
    options.mode = "standalone-dev";
    await captureVisualsAtRuntime(options);
    expect(runCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--mode=standalone-dev"]),
      }),
    );
  });

  it("rejects incomplete runtime URLs before executing the capture helper", async () => {
    await expect(
      captureVisualsAtRuntime({
        ...options,
        urls: { ...options.urls, hostUrl: null },
      }),
    ).rejects.toThrow();
    expect(runCommandResult).not.toHaveBeenCalled();
  });

  it("requires explicitly published scenarios without taking over the runtime", async () => {
    vi.mocked(inspectAirJamAgentConfig).mockResolvedValue({
      hasAgent: true,
      visualScenariosModulePath: null,
    });
    await expect(captureVisualsAtRuntime(options)).rejects.toThrow(
      /No visual scenarios published/u,
    );
    expect(runCommandResult).not.toHaveBeenCalled();
    expect(startDev).not.toHaveBeenCalled();
    expect(stopDev).not.toHaveBeenCalled();
  });

  it("preserves helper failure diagnostics without stopping the caller runtime", async () => {
    vi.mocked(runCommandResult).mockImplementation((command) => ({
      ...command,
      exitCode: 1,
      signal: null,
      durationMs: 0,
      stdout: "",
      stderr: "game capture failed",
      ok: false,
    }));
    await expect(captureVisualsAtRuntime(options)).rejects.toThrow(
      "game capture failed",
    );
    expect(stopDev).not.toHaveBeenCalled();
  });
});
