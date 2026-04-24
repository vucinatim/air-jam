import {
  chromium,
  type Browser,
  type BrowserContext,
  type Frame,
  type FrameLocator,
  type Page,
} from "@playwright/test";
import {
  VISUAL_HARNESS_ACTIONS_KEY,
  VISUAL_HARNESS_BRIDGE_KEY,
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
  readVisualHarnessBridgeSnapshot,
  type VisualHarnessBridgeSnapshot,
} from "../core/runtime-bridge.js";
import type {
  VisualHarnessMode,
  VisualHarnessPageSurface,
  VisualHarnessUrls,
  VisualQuerySurface,
  VisualViewport,
} from "./types.js";

export const DEFAULT_HOST_VIEWPORT: VisualViewport = {
  width: 1440,
  height: 1024,
};
export const DEFAULT_CONTROLLER_VIEWPORT: VisualViewport = {
  width: 390,
  height: 844,
};

const isEmbeddedHarnessMode = (mode: VisualHarnessMode): boolean =>
  mode !== "standalone-dev";

export const dismissHarnessControllerFullscreenPrompt = async (
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
}): Promise<FrameLocator> => {
  const iframe = page.getByTestId(testId);
  await iframe.waitFor({ state: "visible", timeout: timeoutMs });
  const iframeHandle = await iframe.elementHandle({ timeout: timeoutMs });
  if (!iframeHandle) {
    throw new Error(`Could not resolve iframe handle for "${testId}".`);
  }

  const startedAt = Date.now();
  let resolvedFrame: Frame | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const nextFrame = await iframeHandle.contentFrame();
    const frameUrl = nextFrame?.url() ?? "";
    if (nextFrame && frameUrl.length > 0 && frameUrl !== "about:blank") {
      resolvedFrame = nextFrame;
      break;
    }

    await page.waitForTimeout(100);
  }

  if (!resolvedFrame) {
    throw new Error(`Timed out waiting for iframe "${testId}" to resolve.`);
  }

  const remainingTimeoutMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
  await resolvedFrame.waitForLoadState("domcontentloaded", {
    timeout: remainingTimeoutMs,
  });

  return page.frameLocator(`iframe[data-testid="${testId}"]`);
};

export const withVisualHarnessEnabled = (url: string): string => {
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

export const readVisualHarnessSessionBridgeSnapshot = async <
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
  return readVisualHarnessBridgeSnapshot<TSnapshot>({
    [VISUAL_HARNESS_BRIDGE_KEY]: rawSnapshot,
  });
};

export const invokeVisualHarnessSessionBridgeAction = async <T>({
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
  if (!embedded) {
    return page.evaluate(
      async ({ actionKey, name, nextPayload }) => {
        const actionMap = (window as unknown as Record<string, unknown>)[
          actionKey
        ] as Record<string, unknown> | undefined;
        const action = actionMap?.[name];
        if (typeof action !== "function") {
          throw new Error(`Missing harness action "${name}".`);
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
        throw new Error(`Missing harness action "${name}".`);
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

const resolveControllerJoinUrl = async ({
  hostPage,
  hostGame,
  hostEmbedded,
  controllerBaseUrl,
}: {
  hostPage: Page;
  hostGame: VisualQuerySurface;
  hostEmbedded: boolean;
  controllerBaseUrl: string;
}): Promise<string> => {
  let resolvedJoinUrl: string | null = null;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const bridgeSnapshot = await readVisualHarnessSessionBridgeSnapshot({
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

    await hostPage.waitForTimeout(250);
  }

  if (!resolvedJoinUrl) {
    throw new Error(
      "Could not resolve a controller join URL from the harness bridge snapshot or host runtime URL.",
    );
  }

  const joinUrl = new URL(resolvedJoinUrl);
  const controllerUrl = new URL(controllerBaseUrl);
  joinUrl.protocol = controllerUrl.protocol;
  joinUrl.host = controllerUrl.host;
  return withVisualHarnessEnabled(joinUrl.toString());
};

export type OpenVisualHarnessSessionOptions = {
  browser: Browser;
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl">;
  mode: VisualHarnessMode;
};

type OpenVisualHarnessHostSurface = {
  hostContext: BrowserContext;
  host: VisualHarnessPageSurface;
};

export type OpenVisualHarnessHostSessionResult = {
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl"> & {
    controllerJoinUrl: string | null;
  };
  host: VisualHarnessPageSurface;
  readBridgeSnapshot: <
    TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
  >() => Promise<TSnapshot | null>;
  waitForBridgeSnapshot: <
    TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
  >(
    predicate: (snapshot: TSnapshot | null) => boolean | Promise<boolean>,
    description?: string,
    timeoutMs?: number,
  ) => Promise<TSnapshot>;
  invokeBridgeAction: <T = unknown>(
    actionName: string,
    payload?: unknown,
  ) => Promise<T>;
  close: () => Promise<void>;
};

export type OpenVisualHarnessSessionResult = {
  urls: VisualHarnessUrls;
  host: VisualHarnessPageSurface;
  controller: VisualHarnessPageSurface & {
    fullscreenPromptDismissed: boolean;
  };
  readBridgeSnapshot: <
    TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
  >() => Promise<TSnapshot | null>;
  waitForBridgeSnapshot: <
    TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
  >(
    predicate: (snapshot: TSnapshot | null) => boolean | Promise<boolean>,
    description?: string,
    timeoutMs?: number,
  ) => Promise<TSnapshot>;
  invokeBridgeAction: <T = unknown>(
    actionName: string,
    payload?: unknown,
  ) => Promise<T>;
  close: () => Promise<void>;
};

const openVisualHarnessHostSurface = async ({
  browser,
  urls,
  mode,
}: OpenVisualHarnessSessionOptions): Promise<OpenVisualHarnessHostSurface> => {
  const embedded = isEmbeddedHarnessMode(mode);
  const hostContext = await browser.newContext({
    viewport: DEFAULT_HOST_VIEWPORT,
  });

  try {
    const hostPage = await hostContext.newPage();
    await hostPage.goto(urls.hostUrl, { waitUntil: "domcontentloaded" });
    const hostGame: VisualQuerySurface = embedded
      ? await waitForFrameToLoad({
          page: hostPage,
          testId: "arcade-host-game-frame",
        })
      : hostPage;

    return {
      hostContext,
      host: {
        page: hostPage,
        game: hostGame,
        embedded,
      },
    };
  } catch (error) {
    await hostContext.close().catch(() => null);
    throw error;
  }
};

export const openVisualHarnessHostSession = async ({
  browser,
  urls,
  mode,
}: OpenVisualHarnessSessionOptions): Promise<OpenVisualHarnessHostSessionResult> => {
  const { hostContext, host } = await openVisualHarnessHostSurface({
    browser,
    urls,
    mode,
  });

  return {
    urls: {
      ...urls,
      controllerJoinUrl: null,
    },
    host,
    readBridgeSnapshot: () =>
      readVisualHarnessSessionBridgeSnapshot({
        page: host.page,
        game: host.game,
        embedded: host.embedded,
      }),
    waitForBridgeSnapshot: async (
      predicate,
      description = "harness bridge snapshot",
      timeoutMs = 30_000,
    ) => {
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        const snapshot =
          await readVisualHarnessSessionBridgeSnapshot<VisualHarnessBridgeSnapshot>(
            {
              page: host.page,
              game: host.game,
              embedded: host.embedded,
            },
          );
        if (await predicate(snapshot as never)) {
          return snapshot as never;
        }

        await host.page.waitForTimeout(200);
      }

      throw new Error(`Timed out waiting for ${description}.`);
    },
    invokeBridgeAction: (actionName, payload) =>
      invokeVisualHarnessSessionBridgeAction({
        page: host.page,
        game: host.game,
        embedded: host.embedded,
        actionName,
        payload,
      }),
    close: () => hostContext.close(),
  };
};

export const openVisualHarnessSession = async ({
  browser,
  urls,
  mode,
}: OpenVisualHarnessSessionOptions): Promise<OpenVisualHarnessSessionResult> => {
  const hostSession = await openVisualHarnessHostSession({
    browser,
    urls,
    mode,
  });
  const controllerContext = await browser.newContext({
    viewport: DEFAULT_CONTROLLER_VIEWPORT,
  });

  try {
    const controllerJoinUrl = await resolveControllerJoinUrl({
      hostPage: hostSession.host.page,
      hostGame: hostSession.host.game,
      hostEmbedded: hostSession.host.embedded,
      controllerBaseUrl: urls.controllerBaseUrl,
    });

    const controllerPage = await controllerContext.newPage();
    await controllerPage.goto(controllerJoinUrl, {
      waitUntil: "domcontentloaded",
    });
    const fullscreenPromptDismissed =
      await dismissHarnessControllerFullscreenPrompt(controllerPage);
    const controllerGame: VisualQuerySurface = hostSession.host.embedded
      ? await waitForFrameToLoad({
          page: controllerPage,
          testId: "arcade-controller-game-frame",
        })
      : controllerPage;

    const controller: OpenVisualHarnessSessionResult["controller"] = {
      page: controllerPage,
      game: controllerGame,
      embedded: hostSession.host.embedded,
      fullscreenPromptDismissed,
    };

    return {
      urls: {
        ...hostSession.urls,
        controllerJoinUrl,
      },
      host: hostSession.host,
      controller,
      readBridgeSnapshot: hostSession.readBridgeSnapshot,
      waitForBridgeSnapshot: hostSession.waitForBridgeSnapshot,
      invokeBridgeAction: hostSession.invokeBridgeAction,
      close: async () => {
        await Promise.allSettled([
          hostSession.close(),
          controllerContext.close(),
        ]);
      },
    };
  } catch (error) {
    await Promise.allSettled([hostSession.close(), controllerContext.close()]);
    throw error;
  }
};

export const launchHarnessBrowser = async (): Promise<Browser> =>
  chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
    ],
  });
