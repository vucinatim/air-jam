// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingGameShowcase } from "./landing-game-showcase";

const { useQuery, refetch } = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/trpc/react", () => ({
  api: { game: { getAllPublic: { useQuery } } },
}));

vi.mock("./landing-motion", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

const game = {
  id: "test-game",
  name: "Test Game",
  slug: "test-game",
  thumbnailUrl: null,
  videoUrl: null,
  coverUrl: null,
  ownerName: "Creator",
};

describe("LandingGameShowcase", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    refetch.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();

  });

  const renderShowcase = (query = {}) => {
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
      ...query,
    });
    act(() => root.render(createElement(LandingGameShowcase)));
  };

  it("announces loading without an empty catalog or error", () => {
    renderShowcase({ isLoading: true, isFetching: true });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Loading games…",
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("No games are featured yet");
  });

  it("shows failure instead of an empty catalog and retries through the query", () => {
    renderShowcase({ isError: true });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load the game catalog",
    );
    expect(container.textContent).not.toContain("No games are featured yet");
    const retry = container.querySelector("button");
    expect(retry?.textContent).toBe("Try again");
    act(() => retry?.click());
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("explains a successful empty result and keeps the Arcade reachable", () => {
    renderShowcase({ data: [] });
    expect(container.textContent).toContain("No games are featured yet");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('a[href="/arcade"]')).not.toBeNull();
  });

  it("keeps cached game links available beside a background refresh failure", () => {
    renderShowcase({ data: [game], isError: true, isFetching: true });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "You can still play the games shown below",
    );
    expect(
      container.querySelector('a[href="/arcade/test-game"]')?.textContent,
    ).toContain("Test Game");
    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(container.querySelector("button")?.textContent).toBe("Retrying…");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain("No games are featured yet");
  });
});
