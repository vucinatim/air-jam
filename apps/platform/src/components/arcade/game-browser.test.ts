// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameBrowser } from "./game-browser";

vi.mock("@air-jam/sdk", () => ({
  AudioRuntime: ({ children }: { children: ReactNode }) => children,
  useAudio: () => ({ play: vi.fn() }),
}));

const game = {
  id: "test-game",
  name: "Test Game",
  url: "https://games.example.test/host",
  controllerUrl: "https://games.example.test/controller",
  sourceUrl: "https://github.com/example/game",
  templateId: "minimal",
  ownerName: "Creator",
};

describe("GameBrowser", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSelectGame = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSelectGame.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const renderBrowser = (props = {}) => {
    act(() => {
      root.render(
        createElement(GameBrowser, {
          games: [game],
          selectedIndex: 0,
          isVisible: true,
          onSelectGame,
          ...props,
        }),
      );
    });
  };

  it("launches through a named native button without nesting developer controls", () => {
    renderBrowser();
    const launch = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Play Test Game"]',
    );
    expect(launch).not.toBeNull();
    expect(launch?.querySelector("a, button")).toBeNull();
    expect(launch?.tabIndex).toBe(0);
    act(() => launch?.click());
    expect(onSelectGame).toHaveBeenCalledExactlyOnceWith(game, 0);
    onSelectGame.mockClear();
    const source = container.querySelector<HTMLAnchorElement>(
      'a[aria-label="Open Test Game source on GitHub"]',
    );
    // Cancel navigation; the source action must not also launch the game.
    source?.addEventListener("click", (event) => event.preventDefault());
    act(() => source?.click());
    expect(onSelectGame).not.toHaveBeenCalled();
  });

  it("does not call a failed catalog empty, and retains known games beside feedback", () => {
    const catalogNotice = createElement(
      "div",
      { role: "alert" },
      "Catalog unavailable",
    );
    renderBrowser({ games: [], catalogFailed: true, catalogNotice });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Catalog unavailable",
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
    renderBrowser({ catalogFailed: true, catalogNotice });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Play Test Game"]'),
    ).not.toBeNull();
  });

  it("addresses players in a genuinely empty catalog", () => {
    renderBrowser({ games: [] });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "No games are available yet",
    );
    expect(container.textContent).not.toContain("dashboard");
  });

  it("keeps a successful empty catalog visible beside an unrelated launch failure", () => {
    renderBrowser({
      games: [],
      launchNotice: createElement(
        "div",
        { role: "alert" },
        "Launch unavailable",
      ),
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "No games are available yet",
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Launch unavailable",
    );
  });

  it("uses catalog failure state rather than the shape of its presentation", () => {
    renderBrowser({ games: [], catalogFailed: true, catalogNotice: null });
    expect(container.querySelector('[role="status"]')).toBeNull();
    renderBrowser({ games: [], catalogNotice: createElement("span") });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "No games are available yet",
    );
  });

  it("removes hidden browser controls from keyboard and accessibility interaction", () => {
    renderBrowser({ isVisible: false });
    expect(container.firstElementChild?.hasAttribute("inert")).toBe(true);
    renderBrowser();
    expect(container.firstElementChild?.hasAttribute("inert")).toBe(false);
  });
});
