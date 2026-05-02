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
  AnyAirJamAgentContract,
  InferVisualScenarioSnapshot,
  VisualCaptureScenarioMetadata,
  VisualCaptureSummary,
  VisualHarnessMode,
  VisualHarnessUrls,
  VisualScenario,
  VisualScenarioAgent,
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
  runContext: VisualScenarioContext<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  > | null,
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

const createUnavailableAgentClient = <
  TSnapshot extends Record<string, unknown>,
>(): VisualScenarioAgent<TSnapshot> => {
  const unavailable = async (): Promise<never> => {
    throw new Error(
      "This visual scenario run does not have an agent session attached. Start visual capture through Air Jam devtools so scenarios can invoke canonical agent actions.",
    );
  };

  return {
    listActions: async () => [],
    read: unavailable,
    waitFor: unavailable,
    invoke: unavailable,
    close: async () => {},
  };
};

const createLazyAgentClient = <TSnapshot extends Record<string, unknown>>({
  createAgentSession,
}: {
  createAgentSession?: () => Promise<VisualScenarioAgent<TSnapshot>>;
}): VisualScenarioAgent<TSnapshot> => {
  let sessionPromise: Promise<VisualScenarioAgent<TSnapshot>> | null = null;

  const getSession = async (): Promise<VisualScenarioAgent<TSnapshot>> => {
    if (!createAgentSession) {
      return createUnavailableAgentClient<TSnapshot>();
    }

    if (!sessionPromise) {
      sessionPromise = createAgentSession();
    }

    return sessionPromise;
  };

  return {
    listActions: async () => (await getSession()).listActions(),
    read: async () => (await getSession()).read(),
    waitFor: async (predicate, description, timeout) =>
      (await getSession()).waitFor(predicate, description, timeout),
    invoke: async (actionId, payload, options) =>
      (await getSession()).invoke(actionId, payload, options),
    close: async () => {
      if (!sessionPromise) {
        return;
      }

      const session = await sessionPromise.catch(() => null);
      await session?.close().catch(() => null);
    },
  };
};

const createScenarioRunContext = async <
  TAgent extends AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null,
>({
  browser,
  gameId,
  bridge,
  scenario,
  scenarioDir,
  urls,
  mode,
  secure,
  createAgentSession,
}: {
  browser: Browser;
  gameId: string;
  bridge: TBridge;
  scenario: VisualScenario<TAgent, TBridge>;
  scenarioDir: string;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  mode: VisualHarnessMode;
  secure: boolean;
  createAgentSession?: (options: {
    gameId: string;
    scenarioId: string;
    harnessSessionId: string | null;
    urls: VisualHarnessUrls;
    mode: VisualHarnessMode;
    secure: boolean;
  }) => Promise<VisualScenarioAgent<InferVisualScenarioSnapshot<TAgent>>>;
}): Promise<VisualScenarioContext<TAgent, TBridge>> => {
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

  const bridgeClient =
    bridge === null
      ? null
      : createBridgeClient({
          bridge,
          session,
        });
  const agent = createLazyAgentClient<InferVisualScenarioSnapshot<TAgent>>({
    createAgentSession: createAgentSession
      ? () =>
          createAgentSession({
            gameId,
            scenarioId: scenario.id,
            harnessSessionId: session.harnessSessionId,
            urls: session.urls,
            mode,
            secure,
          })
      : undefined,
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
    agent,
    bridge: bridgeClient as VisualScenarioContext<TAgent, TBridge>["bridge"],
    captureHost: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "host", viewportName, ...viewport }),
    captureController: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "controller", viewportName, ...viewport }),
    screenshotRecords,
    notes,
    close: async () => {
      await Promise.allSettled([agent.close(), session.close()]);
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
  scenario: VisualScenario<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  >;
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

const runScenarioCapture = async <
  TAgent extends AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null,
>({
  artifactRoot,
  browser,
  gameId,
  bridge,
  scenario,
  urls,
  mode,
  secure,
  createAgentSession,
}: {
  artifactRoot: string;
  browser: Browser;
  gameId: string;
  bridge: TBridge;
  scenario: VisualScenario<TAgent, TBridge>;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  mode: VisualHarnessMode;
  secure: boolean;
  createAgentSession?: (options: {
    gameId: string;
    scenarioId: string;
    harnessSessionId: string | null;
    urls: VisualHarnessUrls;
    mode: VisualHarnessMode;
    secure: boolean;
  }) => Promise<VisualScenarioAgent<InferVisualScenarioSnapshot<TAgent>>>;
}): Promise<VisualCaptureScenarioMetadata> => {
  const scenarioDir = path.join(artifactRoot, gameId, scenario.id);
  resetDir(scenarioDir);

  let runContext: VisualScenarioContext<TAgent, TBridge> | null = null;
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
      secure,
      createAgentSession,
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
  scenarioPack: VisualScenarioPack<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  >,
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
  ) => Promise<
    VisualScenarioPack<
      AnyAirJamAgentContract,
      AnyVisualHarnessBridgeDefinition | null
    >
  >;
  startStack: (options: {
    gameId: string;
    mode: VisualHarnessMode;
    secure: boolean;
    visualHarness: boolean;
  }) => Promise<VisualHarnessStackHandle>;
  createAgentSession?: (options: {
    gameId: string;
    scenarioId: string;
    harnessSessionId: string | null;
    urls: VisualHarnessUrls;
    mode: VisualHarnessMode;
    secure: boolean;
  }) => Promise<VisualScenarioAgent<Record<string, unknown>>>;
  onScenarioStart?: (
    scenario: VisualScenario<
      AnyAirJamAgentContract,
      AnyVisualHarnessBridgeDefinition | null
    >,
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
  createAgentSession,
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
        bridge: scenarioPack.bridge ?? null,
        scenario,
        urls: stack.urls,
        mode,
        secure,
        createAgentSession,
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
