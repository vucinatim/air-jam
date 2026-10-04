// @vitest-environment jsdom

import { toggleDocumentFullscreen } from "@/lib/use-document-fullscreen";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControllerFullscreenPrompt } from "./controller-fullscreen-prompt";

vi.mock("@/lib/use-document-fullscreen", () => ({
  toggleDocumentFullscreen: vi.fn(),
}));

describe("ControllerFullscreenPrompt", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(toggleDocumentFullscreen).mockReset().mockResolvedValue();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const prompt = () =>
    document.querySelector('[data-testid="controller-fullscreen-prompt"]');
  const render = (
    roomId: string | null = "ROOM1",
    documentFullscreen = false,
  ) => {
    act(() =>
      root.render(
        createElement(ControllerFullscreenPrompt, {
          roomId,
          documentFullscreen,
        }),
      ),
    );
  };
  const remount = (documentFullscreen = false) => {
    act(() => root.unmount());
    root = createRoot(container);
    render("ROOM1", documentFullscreen);
  };

  it.each(["Not now", "Escape", "outside"])(
    "remembers %s dismissal across remounts and allows a fresh session to prompt",
    async (dismissal) => {
      render();
      expect(prompt()).not.toBeNull();
      // Radix defers its outside-pointer listener until the opening event ends.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      act(() => {
        if (dismissal === "Not now")
          document
            .querySelector<HTMLButtonElement>(
              '[data-testid="controller-fullscreen-prompt-dismiss"]',
            )!
            .click();
        else if (dismissal === "Escape")
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
        else
          document.body.dispatchEvent(
            new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
          );
      });
      expect(prompt()).toBeNull();
      remount();
      expect(prompt()).toBeNull();
      render(null);
      render("ROOM2");
      expect(prompt()).toBeNull();
      sessionStorage.clear();
      remount();
      expect(prompt()).not.toBeNull();
    },
  );

  it.each([false, true])(
    "remembers the fullscreen choice even if the browser rejects it (%s)",
    async (rejected) => {
      if (rejected)
        vi.mocked(toggleDocumentFullscreen).mockRejectedValueOnce(
          new Error("Not allowed"),
        );
      render();
      await act(async () => {
        document
          .querySelector<HTMLButtonElement>(
            '[data-testid="controller-fullscreen-prompt-enable"]',
          )!
          .click();
      });
      expect(toggleDocumentFullscreen).toHaveBeenCalledOnce();
      expect(prompt()).toBeNull();
      remount();
      expect(prompt()).toBeNull();
    },
  );

  it("remembers an already-fullscreen controller across remounts", () => {
    render("ROOM1", true);
    expect(prompt()).toBeNull();
    remount(false);
    expect(prompt()).toBeNull();
  });

  it("keeps the controller usable when accessing sessionStorage is denied", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    render();
    expect(prompt()).not.toBeNull();
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="controller-fullscreen-prompt-dismiss"]',
        )!
        .click(),
    );
    render(null);
    render("ROOM2");
    expect(prompt()).toBeNull();
    // Without browser storage, reload persistence is unavailable, not fatal.
    remount();
    expect(prompt()).not.toBeNull();
  });

  it("keeps local acknowledgement when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    render();
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="controller-fullscreen-prompt-dismiss"]',
        )!
        .click(),
    );
    render(null);
    render("ROOM2");
    expect(prompt()).toBeNull();
  });

  it("does not read browser storage or open the dialog during server rendering", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const markup = renderToString(
      createElement(ControllerFullscreenPrompt, {
        roomId: "ROOM1",
        documentFullscreen: false,
      }),
    );
    expect(markup).not.toContain("Open controller in fullscreen");
    expect(getItem).not.toHaveBeenCalled();
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
