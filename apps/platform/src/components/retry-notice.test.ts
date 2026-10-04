// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RetryNotice } from "./retry-notice";

it("separates retry availability from an in-flight retry", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  const onRetry = vi.fn();
  const props = { message: "The game could not start.", onRetry };
  try {
    act(() => root.render(createElement(RetryNotice, props)));
    const button = container.querySelector("button")!;
    act(() => button.click());
    expect(onRetry).toHaveBeenCalledOnce();
    onRetry.mockClear();

    act(() =>
      root.render(createElement(RetryNotice, { ...props, disabled: true })),
    );
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Try again");
    act(() => button.click());
    expect(onRetry).not.toHaveBeenCalled();

    act(() =>
      root.render(createElement(RetryNotice, { ...props, isRetrying: true })),
    );
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Retrying…");
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
