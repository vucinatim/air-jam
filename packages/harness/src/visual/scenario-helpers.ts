import type { VisualScenarioContext, VisualViewport } from "./types.js";

export const STANDARD_HOST_VIEWPORTS = [
  ["mac-desktop", { width: 3016, height: 1504 }],
  ["desktop", { width: 1440, height: 1024 }],
  ["tablet", { width: 1024, height: 1180 }],
] as const satisfies readonly [string, VisualViewport][];

export const STANDARD_CONTROLLER_VIEWPORTS = [
  ["mobile", { width: 390, height: 844 }],
  ["small-mobile", { width: 360, height: 640 }],
] as const satisfies readonly [string, VisualViewport][];

export const STANDARD_CONTROLLER_LANDSCAPE_VIEWPORTS = [
  ["mobile", { width: 844, height: 390 }],
  ["small-mobile", { width: 640, height: 360 }],
] as const satisfies readonly [string, VisualViewport][];

export const captureStandardSurfaces = async (
  context: VisualScenarioContext,
  options?: {
    controllerOrientation?: "portrait" | "landscape";
  },
): Promise<void> => {
  for (const [viewportName, viewport] of STANDARD_HOST_VIEWPORTS) {
    await context.captureHost(viewportName, viewport);
  }

  await context.ensureControllerInteractive();
  const controllerOrientation = options?.controllerOrientation ?? "portrait";
  const controllerViewports =
    controllerOrientation === "landscape"
      ? STANDARD_CONTROLLER_LANDSCAPE_VIEWPORTS
      : STANDARD_CONTROLLER_VIEWPORTS;
  context.note(
    `Captured controller surfaces in ${controllerOrientation} orientation.`,
  );
  for (const [viewportName, viewport] of controllerViewports) {
    await context.captureController(viewportName, viewport);
  }
};

export const waitForHostText = async (
  context: VisualScenarioContext,
  text: string | RegExp,
  timeout = 30_000,
): Promise<void> => {
  await context.host.game
    .getByText(text)
    .first()
    .waitFor({ state: "visible", timeout });
};

export const waitForControllerText = async (
  context: VisualScenarioContext,
  text: string | RegExp,
  timeout = 30_000,
): Promise<void> => {
  await context.controller.game
    .getByText(text)
    .first()
    .waitFor({ state: "visible", timeout });
};
