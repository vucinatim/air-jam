// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameReleasesPage from "./[gameId]/releases/page";
import NewGamePage from "./new/page";
import GamesPage from "./page";

const { listGames, listReleases, createGame, mutate, refetch, push } =
  vi.hoisted(() => ({
    listGames: vi.fn(),
    listReleases: vi.fn(),
    createGame: vi.fn(),
    mutate: vi.fn(),
    refetch: vi.fn(),
    push: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useParams: () => ({ gameId: "game-1" }),
}));

vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({
      game: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } },
      release: { listByGame: { invalidate: vi.fn() } },
    }),
    game: {
      list: { useQuery: listGames },
      create: { useMutation: createGame },
    },
    release: {
      listByGame: { useQuery: listReleases },
      ...Object.fromEntries(
        [
          "createDraft",
          "requestUploadTarget",
          "finalizeUpload",
          "publish",
          "archive",
          "requestExport",
        ].map((name) => [
          name,
          { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
        ]),
      ),
    },
  },
}));

const games = [
  {
    id: "game-1",
    name: "Space Racers",
    createdAt: "2026-09-01",
    url: null,
    thumbnailUrl: null,
    arcadeVisibility: "hidden",
  },
  {
    id: "game-2",
    name: "Pong",
    createdAt: "2026-09-02",
    url: null,
    thumbnailUrl: null,
    arcadeVisibility: "listed",
  },
];
const query = { isLoading: false, isError: false, isFetching: false, refetch };

describe("creator entrypoints", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient();
    mutate.mockClear();
    refetch.mockClear();
    push.mockClear();
    listGames.mockReturnValue({ ...query, data: games });
    listReleases.mockReturnValue({ ...query, data: [] });
    createGame.mockReturnValue({ mutate, isPending: false, error: null });
  });
  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = (Page: () => React.ReactNode) =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(Page),
        ),
      ),
    );
  const fill = (selector: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("filters games and gives a real no-matches state", () => {
    render(GamesPage);
    fill('input[type="search"]', "  PONG  ");
    expect(
      container.querySelector('a[href="/dashboard/games/game-2"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/dashboard/games/game-1"]'),
    ).toBeNull();
    fill('input[type="search"]', "unknown");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "No games match",
    );
    expect(container.textContent).not.toContain("No games created");
  });

  it("uses native links without nested buttons and labels the displayed date honestly", () => {
    render(GamesPage);
    expect(
      container.querySelector('a[href="/dashboard/games/game-1"]')?.textContent,
    ).toContain("Created");
    expect(container.querySelector("a button")).toBeNull();
  });

  it("distinguishes loading and failed reads, preserving cached games and retry", () => {
    listGames.mockReturnValue({ ...query, data: undefined, isLoading: true });
    render(GamesPage);
    expect(
      container.querySelector('[role="status"]')?.getAttribute("aria-label"),
    ).toBe("Loading your games");
    listGames.mockReturnValue({ ...query, data: games, isError: true });
    render(GamesPage);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load your games",
    );
    expect(
      container.querySelector('a[href="/dashboard/games/game-1"]'),
    ).not.toBeNull();
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[role="alert"] button')
        ?.click(),
    );
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not interpret a failed first game read as a new empty account", () => {
    listGames.mockReturnValue({ ...query, data: undefined, isError: true });
    render(GamesPage);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("No games created");
    listGames.mockReturnValue({ ...query, data: [] });
    render(GamesPage);
    expect(container.textContent).toContain("No games created");
  });

  it("submits a named native form with trimmed values and associated labels", () => {
    render(NewGamePage);
    expect(container.querySelector('label[for="game-name"]')).not.toBeNull();
    expect(
      container.querySelector('label[for="game-preview-url"]'),
    ).not.toBeNull();
    fill("#game-name", "   ");
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
    fill("#game-name", " Space Racers ");
    fill("#game-preview-url", "https://example.com");
    act(() =>
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mutate).toHaveBeenCalledExactlyOnceWith({
      name: "Space Racers",
      url: "https://example.com",
    });
  });

  it("keeps creation details beside inline failure and prevents duplicate pending submissions", () => {
    render(NewGamePage);
    fill("#game-name", "Space Racers");
    createGame.mockReturnValue({
      mutate,
      isPending: false,
      error: new Error("Please try later."),
    });
    render(NewGamePage);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Please try later",
    );
    expect(container.querySelector<HTMLInputElement>("#game-name")?.value).toBe(
      "Space Racers",
    );
    createGame.mockReturnValue({ mutate, isPending: true, error: null });
    render(NewGamePage);
    act(() =>
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mutate).not.toHaveBeenCalled();
  });

  it("distinguishes failed release history from a successful empty history and retries", () => {
    listReleases.mockReturnValue({ ...query, data: undefined, isError: true });
    render(GameReleasesPage);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load the release history",
    );
    expect(container.textContent).not.toContain("No releases yet");
    expect(container.textContent).not.toContain("No live release yet");
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[role="alert"] button')
        ?.click(),
    );
    expect(refetch).toHaveBeenCalledOnce();
    listReleases.mockReturnValue({ ...query, data: [] });
    render(GameReleasesPage);
    expect(container.textContent).toContain("No releases yet");
    expect(
      container.querySelector('label[for="release-archive"]'),
    ).not.toBeNull();
  });
});
