import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { airjam } from "../src/airjam.config";
import { App } from "../src/app";
import { theOfficeTheme } from "../src/game/theme";

vi.mock(
  "@air-jam/sdk",
  () => import("../../../packages/sdk/src/runtime/create-air-jam-app"),
);
vi.mock("../../../packages/sdk/src/runtime/session-runtimes", () => ({
  AirJamHostRuntime: ({ children }: { children: ReactNode }) => children,
  AirJamControllerRuntime: ({ children }: { children: ReactNode }) => children,
}));
vi.mock(
  "../../../packages/sdk/src/runtime/connected-runtime-error-boundary",
  () => ({
    ConnectedRuntimeErrorBoundary: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
vi.mock("../../../packages/sdk/src/audio/hooks", () => ({
  AudioRuntime: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../src/host", () => new Promise(() => {}));
vi.mock("../src/controller", () => new Promise(() => {}));

describe("loading a game surface", () => {
  it.each(["/", airjam.controllerPath])(
    "keeps the declared theme in the first render while %s is pending",
    (path) => {
      const markup = renderToString(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(App),
        ),
      );

      expect(markup).toContain("Loading office floor");
      expect(markup).toContain(
        `--airjam-color-paper-cream:${theOfficeTheme.colors.paperCream};`,
      );
      expect(markup).toContain(
        `--airjam-color-text-muted-brown:${theOfficeTheme.colors.textMutedBrown};`,
      );
      expect(markup).toContain(
        `--airjam-font-sans:${theOfficeTheme.fonts.sans};`,
      );
    },
  );
});
