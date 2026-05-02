// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControllerFullscreenPrompt } from "./controller-fullscreen-prompt";

vi.mock("@/lib/use-document-fullscreen", () => ({
  toggleDocumentFullscreen: vi.fn(),
}));

describe("ControllerFullscreenPrompt", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens when a room is active and the document is not fullscreen", () => {
    act(() => {
      root.render(
        createElement(ControllerFullscreenPrompt, {
          roomId: "ROOM1",
          documentFullscreen: false,
        }),
      );
    });

    expect(
      document.querySelector('[data-testid="controller-fullscreen-prompt"]'),
    ).not.toBeNull();
  });

  it("does not reopen after the user exits fullscreen", () => {
    act(() => {
      root.render(
        createElement(ControllerFullscreenPrompt, {
          roomId: "ROOM1",
          documentFullscreen: true,
        }),
      );
    });

    act(() => {
      root.render(
        createElement(ControllerFullscreenPrompt, {
          roomId: "ROOM1",
          documentFullscreen: false,
        }),
      );
    });

    expect(
      document.querySelector('[data-testid="controller-fullscreen-prompt"]'),
    ).toBeNull();
  });
});
