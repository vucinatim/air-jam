import type { Browser, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type {
  AnyVisualHarnessBridgeDefinition,
  InferVisualHarnessBridgeActions,
  InferVisualHarnessBridgeSnapshot,
  VisualHarnessActionInvokerMap,
} from "../core/bridge-contract.js";
import {
  DEFAULT_HOST_VIEWPORT,
  dismissHarnessControllerFullscreenPrompt,
  launchHarnessBrowser,
  openVisualHarnessSession,
} from "./session.js";
import type {
  VisualCaptureScenarioMetadata,
  VisualCaptureSummary,
  VisualHarnessMode,
  VisualHarnessUrls,
  VisualScenario,
  VisualScenarioBridge,
  VisualScenarioContext,
  VisualScenarioPack,
  VisualScreenshotRecord,
  VisualViewport,
} from "./types.js";

const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

const writeJson = (filePath: string, value: unknown): void => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const resetDir = (dir: string): void => {
  fs.rmSync(dir, { force: true, recursive: true });
  ensureDir(dir);
};

const appendFailureScreenshot = async ({
  page,
  surface,
  scenarioDir,
  screenshotRecords,
}: {
  page: Page;
  surface: "host" | "controller";
  scenarioDir: string;
  screenshotRecords: VisualScreenshotRecord[];
}): Promise<void> => {
  const viewport = page.viewportSize() ?? DEFAULT_HOST_VIEWPORT;
  const fileName = `${surface}-failure.png`;
  const filePath = path.join(scenarioDir, fileName);

  await page.screenshot({
    path: filePath,
    fullPage: true,
  });

  screenshotRecords.push({
    surface,
    viewportName: "failure",
    width: viewport.width,
    height: viewport.height,
    fileName,
    filePath,
  });
};

const captureFailureScreenshots = async (
  runContext: VisualScenarioContext<AnyVisualHarnessBridgeDefinition> | null,
): Promise<void> => {
  if (!runContext) {
    return;
  }

  await Promise.allSettled([
    appendFailureScreenshot({
      page: runContext.host.page,
      surface: "host",
      scenarioDir: runContext.scenarioDir,
      screenshotRecords: runContext.screenshotRecords,
    }),
    appendFailureScreenshot({
      page: runContext.controller.page,
      surface: "controller",
      scenarioDir: runContext.scenarioDir,
      screenshotRecords: runContext.screenshotRecords,
    }),
  ]);
};

const createBridgeClient = <TBridge extends AnyVisualHarnessBridgeDefinition>({
  bridge,
  session,
}: {
  bridge: TBridge;
  session: Awaited<ReturnType<typeof openVisualHarnessSession>>;
}): VisualScenarioBridge<TBridge> => {
  const read = async () =>
    session.readBridgeSnapshot<InferVisualHarnessBridgeSnapshot<TBridge>>();

  const waitFor: VisualScenarioBridge<TBridge>["waitFor"] = async (
    predicate,
    description = "visual harness bridge predicate",
    timeout = 30_000,
  ) =>
    session.waitForBridgeSnapshot<InferVisualHarnessBridgeSnapshot<TBridge>>(
      predicate,
      description,
      timeout,
    );

  const actionEntries = Object.keys(bridge.actions).map((actionName) => {
    const invoke = async (payload?: unknown) =>
      session.invokeBridgeAction(actionName, payload);

    return [actionName, invoke] as const;
  });

  return {
    read,
    waitFor,
    actions: Object.fromEntries(actionEntries) as VisualHarnessActionInvokerMap<
      InferVisualHarnessBridgeActions<TBridge>
    >,
  };
};

const createScenarioRunContext = async ({
  browser,
  gameId,
  bridge,
  scenario,
  scenarioDir,
  urls,
  mode,
}: {
  browser: Browser;
  gameId: string;
  bridge: AnyVisualHarnessBridgeDefinition;
  scenario: VisualScenario<AnyVisualHarnessBridgeDefinition>;
  scenarioDir: string;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  mode: VisualHarnessMode;
}): Promise<VisualScenarioContext<AnyVisualHarnessBridgeDefinition>> => {
  const session = await openVisualHarnessSession({
    browser,
    urls,
    mode,
  });
  const hostPage = session.host.page;
  const controllerPage = session.controller.page;

  const screenshotRecords: VisualScreenshotRecord[] = [];
  const notes: string[] = [];
  notes.push(`Resolved controller join URL: ${session.urls.controllerJoinUrl}`);
  if (session.controller.fullscreenPromptDismissed) {
    notes.push("Dismissed controller fullscreen prompt before capture.");
  }

  const captureSurface = async ({
    surface,
    viewportName,
    width,
    height,
    fullPage = true,
  }: {
    surface: "host" | "controller";
    viewportName: string;
    width: number;
    height: number;
    fullPage?: boolean;
  }): Promise<void> => {
    const targetPage = surface === "host" ? hostPage : controllerPage;
    await targetPage.setViewportSize({ width, height });
    await targetPage.waitForTimeout(300);

    const fileName = `${surface}-${viewportName}.png`;
    const filePath = path.join(scenarioDir, fileName);
    await targetPage.screenshot({
      path: filePath,
      fullPage,
    });

    screenshotRecords.push({
      surface,
      viewportName,
      width,
      height,
      fileName,
      filePath,
    });
  };

  const bridgeClient = createBridgeClient({
    bridge,
    session,
  });

  return {
    gameId,
    scenario,
    scenarioDir,
    urls: session.urls,
    host: session.host,
    controller: session.controller,
    note: (value: string) => {
      notes.push(value);
    },
    sleep: (ms: number) => hostPage.waitForTimeout(ms),
    ensureControllerInteractive: async () => {
      await dismissHarnessControllerFullscreenPrompt(controllerPage);
    },
    bridge: bridgeClient,
    captureHost: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "host", viewportName, ...viewport }),
    captureController: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "controller", viewportName, ...viewport }),
    screenshotRecords,
    notes,
    close: async () => {
      await session.close();
    },
  };
};

const buildScenarioMetadata = ({
  artifactRoot,
  gameId,
  scenario,
  mode,
  urls,
  screenshotRecords,
  notes,
  status,
  error,
}: {
  artifactRoot: string;
  gameId: string;
  scenario: VisualScenario<AnyVisualHarnessBridgeDefinition>;
  mode: VisualHarnessMode;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl"> | VisualHarnessUrls;
  screenshotRecords: VisualScreenshotRecord[];
  notes: string[];
  status: "captured" | "failed";
  error: unknown;
}): VisualCaptureScenarioMetadata => ({
  gameId,
  scenarioId: scenario.id,
  scenarioDescription: scenario.description ?? null,
  runtimeMode: mode,
  capturedAt: new Date().toISOString(),
  status,
  urls,
  screenshots: screenshotRecords.map((record) => ({
    surface: record.surface,
    viewportName: record.viewportName,
    width: record.width,
    height: record.height,
    fileName: record.fileName,
    relativePath: path.relative(artifactRoot, record.filePath),
  })),
  notes,
  error:
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack ?? null,
        }
      : null,
});

const runScenarioCapture = async ({
  artifactRoot,
  browser,
  gameId,
  bridge,
  scenario,
  urls,
  mode,
}: {
  artifactRoot: string;
  browser: Browser;
  gameId: string;
  bridge: AnyVisualHarnessBridgeDefinition;
  scenario: VisualScenario<AnyVisualHarnessBridgeDefinition>;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  mode: VisualHarnessMode;
}): Promise<VisualCaptureScenarioMetadata> => {
  const scenarioDir = path.join(artifactRoot, gameId, scenario.id);
  resetDir(scenarioDir);

  let runContext: VisualScenarioContext<AnyVisualHarnessBridgeDefinition> | null =
    null;
  let metadata: VisualCaptureScenarioMetadata | null = null;
  let scenarioError: unknown = null;

  try {
    runContext = await createScenarioRunContext({
      browser,
      gameId,
      bridge,
      scenario,
      scenarioDir,
      urls,
      mode,
    });

    await scenario.run(runContext);
    metadata = buildScenarioMetadata({
      artifactRoot,
      gameId,
      scenario,
      mode,
      urls: runContext.urls,
      screenshotRecords: runContext.screenshotRecords,
      notes: runContext.notes,
      status: "captured",
      error: null,
    });
  } catch (error) {
    scenarioError = error;
    await captureFailureScreenshots(runContext);
    runContext?.note(
      "Scenario failed; best-effort failure screenshots were captured for the current host and controller state.",
    );
    metadata = buildScenarioMetadata({
      artifactRoot,
      gameId,
      scenario,
      mode,
      urls: runContext?.urls ?? urls,
      screenshotRecords: runContext?.screenshotRecords ?? [],
      notes: runContext?.notes ?? [],
      status: "failed",
      error,
    });
    throw Object.assign(
      error instanceof Error ? error : new Error(String(error)),
      {
        visualMetadata: metadata,
      },
    );
  } finally {
    if (!metadata) {
      metadata = buildScenarioMetadata({
        artifactRoot,
        gameId,
        scenario,
        mode,
        urls,
        screenshotRecords: runContext?.screenshotRecords ?? [],
        notes: runContext?.notes ?? [],
        status: "failed",
        error:
          scenarioError ??
          new Error("Scenario setup failed before capture completed."),
      });
    }

    writeJson(path.join(scenarioDir, "metadata.json"), metadata);
    if (runContext) {
      await runContext.close();
    }
  }

  return metadata;
};

const listScenarioIds = (
  scenarioPack: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>,
): string[] => scenarioPack.scenarios.map((scenario) => scenario.id);

export type VisualHarnessStackHandle = {
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  shutdown: () => Promise<void> | void;
};

export type RunVisualHarnessOptions = {
  gameId: string;
  scenarioId?: string | null;
  mode?: VisualHarnessMode;
  secure?: boolean;
  artifactRoot: string;
  loadScenarioPack: (
    gameId: string,
  ) => Promise<VisualScenarioPack<AnyVisualHarnessBridgeDefinition>>;
  startStack: (options: {
    gameId: string;
    mode: VisualHarnessMode;
    secure: boolean;
    visualHarness: boolean;
  }) => Promise<VisualHarnessStackHandle>;
  onScenarioStart?: (
    scenario: VisualScenario<AnyVisualHarnessBridgeDefinition>,
  ) => void;
  onCaptureStart?: (info: {
    gameId: string;
    mode: VisualHarnessMode;
    scenarioCount: number;
  }) => void;
  onComplete?: (summary: VisualCaptureSummary) => void;
};

export const runVisualHarness = async ({
  gameId,
  scenarioId = null,
  mode = "standalone-dev",
  secure = false,
  artifactRoot,
  loadScenarioPack,
  startStack,
  onScenarioStart,
  onCaptureStart,
  onComplete,
}: RunVisualHarnessOptions): Promise<VisualCaptureSummary> => {
  if (mode !== "arcade-built" && mode !== "standalone-dev") {
    throw new Error(
      `Unsupported visual capture mode "${mode}". Phase 1 currently supports "standalone-dev" and "arcade-built".`,
    );
  }

  const scenarioPack = await loadScenarioPack(gameId);
  const scenarios = scenarioId
    ? scenarioPack.scenarios.filter((scenario) => scenario.id === scenarioId)
    : scenarioPack.scenarios;

  if (scenarios.length === 0) {
    throw new Error(
      `No visual capture scenario matched "${scenarioId}" for "${gameId}". Available scenarios: ${listScenarioIds(scenarioPack).join(", ")}`,
    );
  }

  const gameArtifactRoot = path.join(artifactRoot, gameId);
  if (!scenarioId) {
    resetDir(gameArtifactRoot);
  } else {
    ensureDir(gameArtifactRoot);
  }

  const stack = await startStack({
    gameId,
    mode,
    secure,
    visualHarness: true,
  });

  const browser = await launchHarnessBrowser();

  const results: VisualCaptureScenarioMetadata[] = [];

  try {
    onCaptureStart?.({
      gameId,
      mode,
      scenarioCount: scenarios.length,
    });

    for (const scenario of scenarios) {
      onScenarioStart?.(scenario);
      const metadata = await runScenarioCapture({
        artifactRoot,
        browser,
        gameId,
        bridge: scenarioPack.bridge,
        scenario,
        urls: stack.urls,
        mode,
      });
      results.push(metadata);
    }
  } finally {
    await browser.close().catch(() => null);
    await stack.shutdown();
  }

  const summary: VisualCaptureSummary = {
    gameId,
    mode,
    secure,
    capturedAt: new Date().toISOString(),
    scenarios: results.map((result) => ({
      scenarioId: result.scenarioId,
      status: result.status,
      screenshotCount: result.screenshots.length,
      relativeDir: path.relative(
        artifactRoot,
        path.join(artifactRoot, gameId, result.scenarioId),
      ),
    })),
  };

  writeJson(path.join(gameArtifactRoot, "capture-summary.json"), summary);
  onComplete?.(summary);
  return summary;
};
