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
import GameSecurityPage from "./page";

const {
  readAppId,
  savePolicy,
  regenerate,
  writeClipboard,
  setData,
  invalidate,
  cancel,
} = vi.hoisted(() => ({
  readAppId: vi.fn(),
  savePolicy: vi.fn(),
  regenerate: vi.fn(),
  writeClipboard: vi.fn(),
  setData: vi.fn(),
  invalidate: vi.fn(),
  cancel: vi.fn(),
}));
const appId = {
  id: "identity-1",
  gameId: "game-1",
  key: "aj_app_original",
  allowedOrigins: ["https://game.example.invalid"],
  isActive: true,
  createdAt: new Date("2026-10-01"),
  lastUsedAt: null,
};
type PolicyInput = { gameId: string; allowedOrigins: string[] };
type MutationOptions = {
  onSuccess: (data: typeof appId) => void | Promise<void>;
};
vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "game-1" }) }));
vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ game: { getAppId: { setData, invalidate, cancel } } }),
    game: {
      getAppId: {
        useQuery: () =>
          useQuery({
            queryKey: ["app-id", "game-1"],
            queryFn: () => readAppId(),
          }),
      },
      updateAppIdPolicy: {
        useMutation: (options: MutationOptions) =>
          useMutation({
            mutationFn: (input: PolicyInput) => savePolicy(input),
            ...options,
          }),
      },
      regenerateAppId: {
        useMutation: (options: MutationOptions) =>
          useMutation({
            mutationFn: (input: { gameId: string }) => regenerate(input),
            ...options,
          }),
      },
    },
  },
}));

describe("creator security settings recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let browserAlert: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    browserAlert = vi.fn();
    vi.stubGlobal("alert", browserAlert);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeClipboard },
      configurable: true,
    });
    readAppId.mockResolvedValue(appId);
    savePolicy.mockResolvedValue(appId);
    regenerate.mockResolvedValue({ ...appId, key: "aj_app_rotated" });
    writeClipboard.mockResolvedValue(undefined);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(["app-id", "game-1"], appId);
    setData.mockImplementation((_input, data) =>
      queryClient.setQueryData(["app-id", "game-1"], data),
    );
    cancel.mockImplementation(() =>
      queryClient.cancelQueries({ queryKey: ["app-id", "game-1"] }),
    );
    invalidate.mockImplementation(() =>
      queryClient.invalidateQueries({ queryKey: ["app-id", "game-1"] }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(GameSecurityPage),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const button = (name: string, parent: ParentNode = container) => {
    const result = Array.from(
      parent.querySelectorAll<HTMLButtonElement>("button"),
    ).find(
      (candidate) =>
        candidate.textContent === name ||
        candidate.getAttribute("aria-label") === name,
    );
    if (!result) throw new Error(`Missing ${name} button.`);
    return result;
  };
  const fill = (value: string) =>
    act(() => {
      const input = container.querySelector("textarea")!;
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  const dialog = () =>
    document.querySelector<HTMLElement>('[role="alertdialog"]');

  it("distinguishes a failed initial read from a missing identity and retries", async () => {
    queryClient.removeQueries();
    readAppId.mockRejectedValueOnce(new Error("Read unavailable."));
    render();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Loading security settings",
    );
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load your security settings",
    );
    expect(container.textContent).not.toContain("No App ID found");
    expect(container.querySelector("textarea")).toBeNull();
    act(() => button("Try again").click());
    await flush();
    expect(readAppId).toHaveBeenCalledTimes(2);
    expect(container.querySelector("textarea")?.value).toBe(
      "https://game.example.invalid",
    );
  });

  it("keeps cached settings visible after a failed refresh", async () => {
    render();
    readAppId.mockRejectedValueOnce(new Error("Refresh unavailable."));
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Previously loaded settings",
    );
    expect(container.querySelector("textarea")?.value).toBe(
      "https://game.example.invalid",
    );
  });

  it("keeps a failed regeneration open for explicit retry and cannot dismiss it while pending", async () => {
    let reject: (error: Error) => void = () => {
      throw new Error("Request not started.");
    };
    regenerate.mockImplementationOnce(
      () =>
        new Promise((_resolve, rejectRequest) => {
          reject = rejectRequest;
        }),
    );
    render();
    act(() => button("Regenerate").click());
    act(() => button("Regenerate", dialog()!).click());
    await flush();
    expect(dialog()).not.toBeNull();
    expect(button("Cancel", dialog()!).disabled).toBe(true);
    act(() =>
      dialog()!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(dialog()).not.toBeNull();
    await act(async () => reject(new Error("Regeneration unavailable.")));
    await flush();
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(
      "Regeneration unavailable.",
    );
    expect(browserAlert).not.toHaveBeenCalled();
    readAppId.mockRejectedValue(new Error("Refresh unavailable."));
    act(() => button("Regenerate", dialog()!).click());
    await flush();
    expect(regenerate).toHaveBeenCalledTimes(2);
    expect(dialog()).toBeNull();
    expect(container.textContent).toContain("aj_app_rotated");
    expect(queryClient.getQueryData(["app-id", "game-1"])).toMatchObject({
      key: "aj_app_rotated",
    });
    act(() => button("Copy").click());
    await flush();
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith("aj_app_rotated");
  });

  it("cancels regeneration without sending a request and retains the warning", () => {
    render();
    act(() => button("Regenerate").click());
    expect(dialog()?.textContent).toContain(
      "invalidate the current App ID immediately",
    );
    act(() => button("Cancel", dialog()!).click());
    expect(dialog()).toBeNull();
    expect(regenerate).not.toHaveBeenCalled();
  });

  it("shows accepted normalized origins even when refresh fails and prevents duplicate pending saves", async () => {
    let finish: (value: typeof appId) => void = () => {
      throw new Error("Request not started.");
    };
    savePolicy.mockResolvedValueOnce({
      ...appId,
      allowedOrigins: ["https://new.example.invalid"],
    });
    render();
    readAppId.mockRejectedValue(new Error("Refresh unavailable."));
    fill("https://new.example.invalid/path");
    act(() => button("Save Security Settings").click());
    await flush();
    expect(browserAlert).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Security settings saved",
    );
    expect(container.querySelector("textarea")?.value).toBe(
      "https://new.example.invalid",
    );
    fill("https://draft.example.invalid");
    savePolicy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => button("Save Security Settings").click());
    await flush();
    expect(container.querySelector("textarea")?.disabled).toBe(true);
    expect(button("Regenerate").disabled).toBe(true);
    act(() => button("Save Security Settings").click());
    expect(savePolicy).toHaveBeenCalledTimes(2);
    await act(async () =>
      finish({ ...appId, allowedOrigins: ["https://draft.example.invalid"] }),
    );
    await flush();
    expect(container.querySelector("textarea")?.disabled).toBe(false);
  });

  it("retains an unsaved origin draft after failed save and retries only on demand", async () => {
    savePolicy.mockRejectedValueOnce(new Error("Save unavailable."));
    render();
    fill("https://draft.example.invalid\nhttps://other.example.invalid");
    act(() => button("Save Security Settings").click());
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Save unavailable.",
    );
    expect(container.querySelector("textarea")?.value).toBe(
      "https://draft.example.invalid\nhttps://other.example.invalid",
    );
    expect(savePolicy).toHaveBeenCalledExactlyOnceWith({
      gameId: "game-1",
      allowedOrigins: [
        "https://draft.example.invalid",
        "https://other.example.invalid",
      ],
    });
    expect(browserAlert).not.toHaveBeenCalled();
    act(() => button("Save Security Settings").click());
    await flush();
    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows clipboard denial truthfully and offers retry with named key controls", async () => {
    writeClipboard.mockRejectedValueOnce(
      new Error("Clipboard permission denied."),
    );
    render();
    expect(
      container.querySelector('label[for="allowed-origins"]'),
    ).not.toBeNull();
    act(() => button("Show App ID").click());
    expect(container.textContent).toContain("aj_app_original");
    act(() => button("Hide App ID").click());
    expect(container.textContent).not.toContain("aj_app_original");
    act(() => button("Copy").click());
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Clipboard permission denied.",
    );
    expect(container.textContent).not.toContain("Copied");
    act(() => button("Copy").click());
    await flush();
    expect(button("Copied")).toBeDefined();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
