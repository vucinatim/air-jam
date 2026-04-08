import type { VisualScenarioContext, VisualViewport } from './types.js';

export const STANDARD_HOST_VIEWPORTS = [
  ['mac-desktop', { width: 3016, height: 1504 }],
  ['desktop', { width: 1440, height: 1024 }],
  ['tablet', { width: 1024, height: 1180 }],
] as const satisfies readonly [string, VisualViewport][];

export const STANDARD_CONTROLLER_VIEWPORTS = [
  ['mobile', { width: 390, height: 844 }],
  ['small-mobile', { width: 360, height: 640 }],
] as const satisfies readonly [string, VisualViewport][];

export const captureStandardSurfaces = async (
  context: VisualScenarioContext,
): Promise<void> => {
  for (const [viewportName, viewport] of STANDARD_HOST_VIEWPORTS) {
    await context.captureHost(viewportName, viewport);
  }

  await context.ensureControllerInteractive();
  for (const [viewportName, viewport] of STANDARD_CONTROLLER_VIEWPORTS) {
    await context.captureController(viewportName, viewport);
  }
};

export const waitForHostText = async (
  context: VisualScenarioContext,
  text: string | RegExp,
  timeout = 30_000,
): Promise<void> => {
  await context.host.game.getByText(text).first().waitFor({ state: 'visible', timeout });
};

export const waitForControllerText = async (
  context: VisualScenarioContext,
  text: string | RegExp,
  timeout = 30_000,
): Promise<void> => {
  await context.controller.game.getByText(text).first().waitFor({ state: 'visible', timeout });
};

export const waitForHostMatchPhase = async (
  context: VisualScenarioContext,
  phase: string,
  timeout = 30_000,
): Promise<void> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const snapshot = await context.readHostBridgeSnapshot();
    if (snapshot?.matchPhase === phase) {
      return;
    }

    await context.sleep(200);
  }

  throw new Error(
    `Timed out waiting for host visual harness bridge matchPhase to become "${phase}".`,
  );
};
