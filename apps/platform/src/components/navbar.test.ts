// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "./navbar";

const { interceptDashboardNavigation } = vi.hoisted(() => ({
  interceptDashboardNavigation: vi.fn((event: MouseEvent) =>
    event.preventDefault(),
  ),
}));

vi.mock("@/hooks/use-dashboard-access", () => ({
  useDashboardAccess: () => ({ interceptDashboardNavigation }),
}));

vi.mock("@/lib/product-telemetry-client", () => ({
  trackExternalLinkOpened: vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));

describe("Navbar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    interceptDashboardNavigation.mockClear();
    act(() => root.render(createElement(Navbar)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const expectCurrentLinks = (scope: Element) => {
    for (const href of ["/docs", "/arcade", "/dashboard/games", "/blog"]) {
      expect(scope.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(scope.textContent).not.toContain("Studio");
    expect(scope.textContent).not.toContain("Soon");
    expect(scope.querySelector('a[href="#"]')).toBeNull();
  };

  it("offers real desktop destinations without a hosted Studio placeholder", () => {
    const navigation = container.querySelector("nav")!;
    expectCurrentLinks(navigation);
    act(() => {
      navigation
        .querySelector<HTMLAnchorElement>('a[href="/dashboard/games"]')
        ?.click();
    });
    expect(interceptDashboardNavigation).toHaveBeenCalledOnce();
  });

  it("retains real mobile destinations and dashboard access interception", () => {
    act(() =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')
        ?.click(),
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expectCurrentLinks(dialog);
    expect(document.body.style.overflow).toBe("hidden");
    act(() =>
      dialog
        .querySelector<HTMLAnchorElement>('a[href="/dashboard/games"]')
        ?.click(),
    );
    expect(interceptDashboardNavigation).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("");
    expect(
      container.querySelector('button[aria-label="Open menu"]'),
    ).not.toBeNull();
  });
});
