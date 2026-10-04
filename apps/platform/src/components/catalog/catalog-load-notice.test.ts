// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogLoadNotice } from "./catalog-load-notice";

describe("CatalogLoadNotice", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("exposes an actionable failure and allows retry", () => {
    const onRetry = vi.fn();
    act(() =>
      root.render(
        createElement(CatalogLoadNotice, {
          hasGames: false,
          isRetrying: false,
          onRetry,
        }),
      ),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load the game catalog",
    );
    expect(container.textContent).not.toContain("games shown below");
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Try again");
    act(() => button?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps known games usable and prevents duplicate retries while fetching", () => {
    const onRetry = vi.fn();
    act(() =>
      root.render(
        createElement(CatalogLoadNotice, {
          hasGames: true,
          isRetrying: true,
          onRetry,
        }),
      ),
    );
    expect(container.textContent).toContain("games shown below");
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Retrying…");
    expect(button?.disabled).toBe(true);
    act(() => button?.click());
    expect(onRetry).not.toHaveBeenCalled();
  });
});
