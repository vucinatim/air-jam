import { chromium, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type {
  AnyVisualHarnessBridgeDefinition,
  InferVisualHarnessBridgeActions,
  InferVisualHarnessBridgeSnapshot,
  VisualHarnessActionInvokerMap,
} from "./bridge-contract.js";
import {
  VISUAL_HARNESS_ACTIONS_KEY,
  VISUAL_HARNESS_BRIDGE_KEY,
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
  readVisualHarnessBridgeSnapshot,
  type VisualHarnessBridgeSnapshot,
} from "./runtime-bridge.js";
import type {
  VisualCaptureScenarioMetadata,
  VisualCaptureSummary,
  VisualHarnessMode,
  VisualHarnessUrls,
  VisualQuerySurface,
  VisualScenario,
  VisualScenarioBridge,
  VisualScenarioContext,
  VisualScenarioPack,
  VisualScreenshotRecord,
  VisualViewport,
} from "./types.js";

const DEFAULT_HOST_VIEWPORT: VisualViewport = { width: 1440, height: 1024 };
const DEFAULT_CONTROLLER_VIEWPORT: VisualViewport = { width: 390, height: 844 };

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

const dismissControllerFullscreenPrompt = async (
  page: Page,
): Promise<boolean> => {
  const openPrompt = page.locator(
    '[data-testid="controller-fullscreen-prompt"][data-state="open"]',
  );
  await openPrompt
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => null);
  const isVisible = await openPrompt.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }

  await page
    .getByTestId("controller-fullscreen-prompt-dismiss")
    .click({ force: true });
  await openPrompt.waitFor({ state: "hidden", timeout: 10_000 });
  return true;
};

const waitForFrameToLoad = async ({
  page,
  testId,
  timeoutMs = 30_000,
}: {
  page: Page;
  testId: string;
  timeoutMs?: number;
}): Promise<import("@playwright/test").FrameLocator> => {
  const iframe = page.getByTestId(testId);
  await iframe.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    (targetTestId) => {
      const element = document.querySelector(
        `iframe[data-testid="${targetTestId}"]`,
      ) as HTMLIFrameElement | null;
      if (!element) {
        return false;
      }

      try {
        const href = element.contentWindow?.location?.href ?? "";
        return href.length > 0 && href !== "about:blank";
      } catch {
        return false;
      }
    },
    testId,
    { timeout: timeoutMs },
  );

  return page.frameLocator(`iframe[data-testid="${testId}"]`);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const withVisualHarnessEnabled = (url: string): string => {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set(
    VISUAL_HARNESS_ENABLE_PARAM,
    VISUAL_HARNESS_ENABLE_VALUE,
  );
  return nextUrl.toString();
};

const readRuntimeHref = async ({
  page,
  game,
  embedded,
}: {
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
}): Promise<string> => {
  if (!embedded) {
    return page.evaluate(() => window.location.href);
  }

  return game.locator("body").evaluate(() => window.location.href);
};

const readBridgeSnapshot = async <
  TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
>({
  page,
  game,
  embedded,
}: {
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
}): Promise<TSnapshot | null> => {
  const readRawSnapshot = async (): Promise<unknown> => {
    if (!embedded) {
      return page.evaluate(
        (bridgeKey) =>
          (window as unknown as Record<string, unknown>)[bridgeKey] ?? null,
        VISUAL_HARNESS_BRIDGE_KEY,
      );
    }

    return game
      .locator("body")
      .evaluate(
        (_, bridgeKey) =>
          (window as unknown as Record<string, unknown>)[bridgeKey] ?? null,
        VISUAL_HARNESS_BRIDGE_KEY,
      );
  };

  const rawSnapshot = await readRawSnapshot();

  if (!embedded) {
    return readVisualHarnessBridgeSnapshot<TSnapshot>({
      [VISUAL_HARNESS_BRIDGE_KEY]: rawSnapshot,
    });
  }

  return readVisualHarnessBridgeSnapshot<TSnapshot>({
    [VISUAL_HARNESS_BRIDGE_KEY]: rawSnapshot,
  });
};

const invokeBridgeAction = async <T>({
  page,
  game,
  embedded,
  actionName,
  payload,
}: {
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
  actionName: string;
  payload?: unknown;
}): Promise<T> => {
  const evaluator = async (): Promise<T> => {
    if (!embedded) {
      return page.evaluate(
        async ({ actionKey, name, nextPayload }) => {
          const actionMap = (window as unknown as Record<string, unknown>)[
            actionKey
          ] as Record<string, unknown> | undefined;
          const action = actionMap?.[name];
          if (typeof action !== "function") {
            throw new Error(`Missing visual harness action "${name}".`);
          }

          return (await action(nextPayload)) as T;
        },
        {
          actionKey: VISUAL_HARNESS_ACTIONS_KEY,
          name: actionName,
          nextPayload: payload,
        },
      );
    }

    return game.locator("body").evaluate(
      async (_, { actionKey, name, nextPayload }) => {
        const actionMap = (window as unknown as Record<string, unknown>)[
          actionKey
        ] as Record<string, unknown> | undefined;
        const action = actionMap?.[name];
        if (typeof action !== "function") {
          throw new Error(`Missing visual harness action "${name}".`);
        }

        return (await action(nextPayload)) as T;
      },
      {
        actionKey: VISUAL_HARNESS_ACTIONS_KEY,
        name: actionName,
        nextPayload: payload,
      },
    );
  };

  return evaluator();
};

const createBridgeClient = <TBridge extends AnyVisualHarnessBridgeDefinition>({
  bridge,
  page,
  game,
  embedded,
  sleepFor,
}: {
  bridge: TBridge;
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
  sleepFor: (ms: number) => Promise<void>;
}): VisualScenarioBridge<TBridge> => {
  const read = async () =>
    readBridgeSnapshot<InferVisualHarnessBridgeSnapshot<TBridge>>({
      page,
      game,
      embedded,
    });

  const waitFor: VisualScenarioBridge<TBridge>["waitFor"] = async (
    predicate,
    description = "visual harness bridge predicate",
    timeout = 30_000,
  ) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
      const snapshot = await read();
      if (await predicate(snapshot)) {
        return snapshot as InferVisualHarnessBridgeSnapshot<TBridge>;
      }

      await sleepFor(200);
    }

    throw new Error(`Timed out waiting for ${description}.`);
  };

  const actionEntries = Object.keys(bridge.actions).map((actionName) => {
    const invoke = async (payload?: unknown) =>
      invokeBridgeAction({
        page,
        game,
        embedded,
        actionName,
        payload,
      });

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

const resolveControllerJoinUrl = async ({
  hostPage,
  hostGame,
  hostEmbedded,
  appOrigin,
}: {
  hostPage: Page;
  hostGame: VisualQuerySurface;
  hostEmbedded: boolean;
  appOrigin: string;
}): Promise<string> => {
  let resolvedJoinUrl: string | null = null;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const bridgeSnapshot = await readBridgeSnapshot({
      page: hostPage,
      game: hostGame,
      embedded: hostEmbedded,
    });
    resolvedJoinUrl = bridgeSnapshot?.controllerJoinUrl ?? null;

    if (!resolvedJoinUrl) {
      const hostRuntimeHref = await readRuntimeHref({
        page: hostPage,
        game: hostGame,
        embedded: hostEmbedded,
      });
      const runtimeUrl = new URL(hostRuntimeHref);
      resolvedJoinUrl = runtimeUrl.searchParams.get("aj_join_url");
    }

    if (resolvedJoinUrl) {
      break;
    }

    await sleep(250);
  }

  if (!resolvedJoinUrl) {
    throw new Error(
      "Could not resolve a controller join URL from the visual harness bridge snapshot or host runtime URL.",
    );
  }

  const joinUrl = new URL(resolvedJoinUrl);
  const platformUrl = new URL(appOrigin);
  joinUrl.protocol = platformUrl.protocol;
  joinUrl.host = platformUrl.host;
  return withVisualHarnessEnabled(joinUrl.toString());
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
  const hostContext = await browser.newContext({
    viewport: DEFAULT_HOST_VIEWPORT,
  });
  const controllerContext = await browser.newContext({
    viewport: DEFAULT_CONTROLLER_VIEWPORT,
  });

  const hostPage = await hostContext.newPage();
  await hostPage.goto(urls.hostUrl, { waitUntil: "domcontentloaded" });
  const hostEmbedded = mode === "arcade-built";
  const hostGame: VisualQuerySurface = hostEmbedded
    ? await waitForFrameToLoad({
        page: hostPage,
        testId: "arcade-host-game-frame",
      })
    : hostPage;

  const controllerJoinUrl = await resolveControllerJoinUrl({
    hostPage,
    hostGame,
    hostEmbedded,
    appOrigin: urls.appOrigin,
  });

  const controllerPage = await controllerContext.newPage();
  await controllerPage.goto(controllerJoinUrl, {
    waitUntil: "domcontentloaded",
  });
  const controllerPromptDismissed =
    await dismissControllerFullscreenPrompt(controllerPage);
  const controllerGame: VisualQuerySurface =
    mode === "arcade-built"
      ? await waitForFrameToLoad({
          page: controllerPage,
          testId: "arcade-controller-game-frame",
        })
      : controllerPage;

  const screenshotRecords: VisualScreenshotRecord[] = [];
  const notes: string[] = [];
  notes.push(`Resolved controller join URL: ${controllerJoinUrl}`);
  if (controllerPromptDismissed) {
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
    page: hostPage,
    game: hostGame,
    embedded: hostEmbedded,
    sleepFor: (ms) => hostPage.waitForTimeout(ms),
  });

  return {
    gameId,
    scenario,
    scenarioDir,
    urls: {
      ...urls,
      controllerJoinUrl,
    },
    host: {
      page: hostPage,
      game: hostGame,
      embedded: hostEmbedded,
    },
    controller: {
      page: controllerPage,
      game: controllerGame,
      embedded: mode === "arcade-built",
      fullscreenPromptDismissed: controllerPromptDismissed,
    },
    note: (value: string) => {
      notes.push(value);
    },
    sleep: (ms: number) => hostPage.waitForTimeout(ms),
    ensureControllerInteractive: async () => {
      await dismissControllerFullscreenPrompt(controllerPage);
    },
    bridge: bridgeClient,
    captureHost: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "host", viewportName, ...viewport }),
    captureController: async (viewportName: string, viewport: VisualViewport) =>
      captureSurface({ surface: "controller", viewportName, ...viewport }),
    screenshotRecords,
    notes,
    close: async () => {
      await Promise.allSettled([
        hostContext.close(),
        controllerContext.close(),
      ]);
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

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
    ],
  });

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
