// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameOverviewPage from "./page";

const {
  readGame,
  updateGame,
  readIdentity,
  readAnalytics,
  readReleases,
  checkSlug,
  writeClipboard,
  route,
} = vi.hoisted(() => ({
  readGame: vi.fn(),
  updateGame: vi.fn(),
  readIdentity: vi.fn(),
  readAnalytics: vi.fn(),
  readReleases: vi.fn(),
  checkSlug: vi.fn(),
  writeClipboard: vi.fn(),
  route: { gameId: "game-1" },
}));
const game = {
  id: "game-1",
  name: "Pong",
  slug: "pong",
  description: "Original description",
  url: "https://preview.example.invalid",
  config: {},
  arcadeVisibility: "hidden",
  thumbnailUrl: null,
  coverUrl: null,
  videoUrl: null,
};
type GameUpdate = {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  url?: string | null;
  sourceUrl?: string | null;
  templateId?: string | null;
  arcadeVisibility?: string;
};
vi.mock("next/navigation", () => ({ useParams: () => route }));
vi.mock("@/trpc/react", async () => {
  const { useQueryClient } = await import("@tanstack/react-query");
  return {
    api: {
      useUtils: () => {
        const client = useQueryClient();
        return {
          game: {
            get: {
              cancel: ({ id }: { id: string }) =>
                client.cancelQueries({ queryKey: ["game", id] }),
              invalidate: ({ id }: { id: string }) =>
                client.invalidateQueries({ queryKey: ["game", id] }),
              getData: ({ id }: { id: string }) =>
                client.getQueryData(["game", id]),
              setData: ({ id }: { id: string }, data: unknown) =>
                client.setQueryData(["game", id], data),
            },
            list: { invalidate: vi.fn() },
            getAllPublic: { invalidate: vi.fn() },
          },
        };
      },
      game: {
        get: {
          useQuery: ({ id }: { id: string }) =>
            useQuery({ queryKey: ["game", id], queryFn: () => readGame(id) }),
        },
        getAppId: {
          useQuery: () =>
            useQuery({ queryKey: ["identity"], queryFn: () => readIdentity() }),
        },
        checkSlugAvailability: {
          useQuery: (input: { slug: string }, options: { enabled: boolean }) =>
            useQuery({
              queryKey: ["slug", input.slug],
              queryFn: () => checkSlug(input),
              ...options,
            }),
        },
        update: {
          useMutation: (options: object) =>
            useMutation({
              mutationFn: (input: GameUpdate) => updateGame(input),
              ...options,
            }),
        },
      },
      analytics: {
        getGameOverview: {
          useQuery: () =>
            useQuery({
              queryKey: ["analytics"],
              queryFn: () => readAnalytics(),
            }),
        },
      },
      release: {
        listByGame: {
          useQuery: () =>
            useQuery({ queryKey: ["releases"], queryFn: () => readReleases() }),
        },
      },
    },
  };
});

describe("creator overview recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let browserAlert: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetAllMocks();
    route.gameId = "game-1";
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    browserAlert = vi.fn();
    vi.stubGlobal("alert", browserAlert);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeClipboard },
      configurable: true,
    });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    client.setQueryData(["game", "game-1"], game);
    client.setQueryData(["identity"], {
      key: "aj_app_test",
      isActive: true,
      allowedOrigins: null,
    });
    client.setQueryData(["analytics"], { daily: [], totals: {} });
    client.setQueryData(["releases"], [{ status: "live", versionLabel: "1" }]);
    readGame.mockResolvedValue(game);
    readIdentity.mockResolvedValue({
      key: "aj_app_test",
      isActive: true,
      allowedOrigins: null,
    });
    readAnalytics.mockResolvedValue({ daily: [], totals: {} });
    readReleases.mockResolvedValue([{ status: "live", versionLabel: "1" }]);
    checkSlug.mockResolvedValue({ available: true });
    updateGame.mockResolvedValue(game);
    writeClipboard.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(GameOverviewPage),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const field = (name: string) => {
    const input = container.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`[name="${name}"]`);
    if (!input) throw new Error(`Missing ${name} field.`);
    return input;
  };
  const fill = (name: string, value: string) =>
    act(() => {
      const input = field(name);
      Object.getOwnPropertyDescriptor(
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const button = (name: string) => {
    const element = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === name);
    if (!element) throw new Error(`Missing ${name} button.`);
    return element;
  };
  const submit = () =>
    act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

  it("does not claim a missing game when its first read fails and offers retry", async () => {
    client.removeQueries({ queryKey: ["game", "game-1"] });
    readGame.mockRejectedValueOnce(new Error("Read unavailable."));
    render();
    await flush();
    expect(container.textContent).not.toContain("Game not found");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load this game",
    );
    act(() => button("Try again").click());
    await flush();
    expect(field("name").value).toBe("Pong");
  });

  it("preserves drafts through successful and failed background refreshes", async () => {
    render();
    fill("name", "Draft name");
    fill("description", "Draft description");
    await act(async () => {
      client.setQueryData(["game", "game-1"], {
        ...game,
        name: "External update",
        arcadeVisibility: "listed",
      });
    });
    await flush();
    expect(field("name").value).toBe("Draft name");
    expect(field("description").value).toBe("Draft description");
    readGame.mockRejectedValueOnce(new Error("Refresh unavailable."));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["game", "game-1"] });
    });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Previously loaded game",
    );
    expect(field("name").value).toBe("Draft name");
  });

  it("rolls back failed listing without discarding the profile draft and offers explicit retry", async () => {
    updateGame.mockRejectedValueOnce(new Error("Listing unavailable."));
    render();
    fill("name", "Unsaved name");
    const toggle =
      container.querySelector<HTMLButtonElement>('[role="switch"]')!;
    act(() => toggle.click());
    await flush();
    expect(field("name").value).toBe("Unsaved name");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Listing unavailable.",
    );
    act(() => toggle.click());
    await flush();
    expect(updateGame).toHaveBeenCalledTimes(2);
    expect(browserAlert).not.toHaveBeenCalled();
  });

  it("retains a failed save draft, locks pending inputs, and accepts the saved profile without relying on refresh", async () => {
    let reject: (error: Error) => void = () => {
      throw new Error("Request not started.");
    };
    updateGame.mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectRequest) => {
          reject = rejectRequest;
        }),
    );
    client.setQueryData(["game", "game-1"], {
      ...game,
      thumbnailUrl: "https://media.example.invalid/managed.png",
    });
    render();
    fill("name", "New name");
    await submit();
    await flush();
    expect(
      field("name").disabled || field("name").closest("fieldset")?.disabled,
    ).toBe(true);
    await submit();
    await flush();
    expect(updateGame).toHaveBeenCalledOnce();
    await act(async () => reject(new Error("Save unavailable.")));
    await flush();
    expect(field("name").value).toBe("New name");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Save unavailable.",
    );
    readGame.mockRejectedValue(new Error("Refresh unavailable."));
    updateGame.mockResolvedValueOnce({ ...game, name: "New name" });
    await submit();
    await flush();
    expect(client.getQueryData(["game", "game-1"])).toMatchObject({
      name: "New name",
      thumbnailUrl: "https://media.example.invalid/managed.png",
    });
    expect(container.textContent).toContain("Profile saved.");
    expect(browserAlert).not.toHaveBeenCalled();
    fill("name", "Another unsaved change");
    expect(container.textContent).not.toContain("Profile saved.");
  });

  it("starts a fresh draft when opening another game", async () => {
    render();
    fill("name", "Unsaved Pong");
    client.setQueryData(["game", "game-2"], {
      ...game,
      id: "game-2",
      name: "Racers",
      slug: "racers",
    });
    route.gameId = "game-2";
    render();
    await flush();
    expect(field("name").value).toBe("Racers");
  });

  it("does not turn failed secondary reads into missing keys, releases or analytics", async () => {
    client.removeQueries({ queryKey: ["identity"] });
    client.removeQueries({ queryKey: ["analytics"] });
    client.removeQueries({ queryKey: ["releases"] });
    readIdentity.mockRejectedValue(new Error("Identity unavailable."));
    readAnalytics.mockRejectedValue(new Error("Analytics unavailable."));
    readReleases.mockRejectedValue(new Error("Releases unavailable."));
    render();
    await flush();
    expect(container.textContent).not.toContain("No App ID found");
    expect(container.textContent).not.toContain("No release uploaded");
    expect(container.textContent).not.toContain("No activity yet");
    expect(container.textContent).toContain("couldn’t load your App ID");
    expect(container.textContent).toContain("couldn’t load your releases");
    expect(container.textContent).toContain("couldn’t load recent activity");
    expect(field("name").value).toBe("Pong");
  });

  it("shows clipboard failure and retries without a false copied state", async () => {
    writeClipboard.mockRejectedValueOnce(new Error("Clipboard denied."));
    render();
    act(() => button("Copy App ID").click());
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Clipboard denied.",
    );
    expect(container.textContent).not.toContain("Copied");
    act(() => button("Copy App ID").click());
    await flush();
    expect(writeClipboard).toHaveBeenCalledTimes(2);
    expect(button("Copied")).toBeDefined();
  });

  it("does not claim a slug is taken when its availability check fails", async () => {
    vi.useFakeTimers();
    checkSlug.mockRejectedValueOnce(new Error("Check unavailable."));
    render();
    const slugLabel = Array.from(container.querySelectorAll("label")).find(
      (label) => label.textContent === "Shareable Slug",
    )!;
    expect(document.getElementById(slugLabel.htmlFor)).toBe(field("slug"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5);
    });
    expect(checkSlug).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("This slug is already taken");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t check this slug",
    );
    expect(button("Save Profile").disabled).toBe(false);
    checkSlug.mockResolvedValueOnce({ available: false });
    act(() => button("Try again").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5);
    });
    expect(container.textContent).toContain("This slug is already taken");
    expect(button("Save Profile").disabled).toBe(true);
  });
});
