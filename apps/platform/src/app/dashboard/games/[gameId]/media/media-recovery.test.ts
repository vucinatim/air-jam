// @vitest-environment jsdom

import { MAX_GAME_MEDIA_BYTES } from "@/lib/games/game-media-policy";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameMediaPage from "./page";

const {
  listMedia,
  requestUploadTarget,
  finalizeUpload,
  assign,
  archive,
  invalidate,
  refetch,
} = vi.hoisted(() => ({
  listMedia: vi.fn(),
  requestUploadTarget: vi.fn(),
  finalizeUpload: vi.fn(),
  assign: vi.fn(),
  archive: vi.fn(),
  invalidate: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ gameId: "game-1" }),
}));
vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({
      gameMedia: { listByGame: { invalidate } },
      game: {
        get: { invalidate },
        list: { invalidate },
        getAllPublic: { invalidate },
      },
    }),
    game: { get: { useQuery: () => ({ data: { name: "Pong" } }) } },
    gameMedia: {
      listByGame: { useQuery: listMedia },
      requestUploadTarget: {
        useMutation: () => ({ mutateAsync: requestUploadTarget }),
      },
      finalizeUpload: { useMutation: () => ({ mutateAsync: finalizeUpload }) },
      assignAsset: {
        useMutation: (options: { onSuccess: () => Promise<void> }) =>
          useMutation({
            mutationFn: (input: { gameId: string; assetId: string }) =>
              assign(input),
            ...options,
          }),
      },
      archiveAsset: {
        useMutation: (options: { onSuccess: () => Promise<void> }) =>
          useMutation({
            mutationFn: (input: { gameId: string; assetId: string }) =>
              archive(input),
            ...options,
          }),
      },
    },
  },
}));

const asset = {
  id: "asset-1",
  kind: "thumbnail",
  isActive: true,
  originalFilename: "existing.png",
  publicUrl: "https://games.example.invalid/existing.png",
  mimeType: "image/png",
  status: "ready",
  sizeBytes: 42,
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
};
const query = { isLoading: false, isError: false, isFetching: false, refetch };

describe("creator media recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let upload: ReturnType<typeof vi.fn>;
  let browserAlert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    upload = vi.fn().mockResolvedValue({ ok: true });
    browserAlert = vi.fn();
    vi.stubGlobal("fetch", upload);
    vi.stubGlobal("alert", browserAlert);
    listMedia.mockReturnValue({ ...query, data: { assets: [] } });
    requestUploadTarget.mockImplementation(async ({ kind }) => ({
      asset: { id: `${kind}-asset` },
      upload: {
        url: `https://storage.example.invalid/${kind}`,
        method: "PUT",
        headers: {},
      },
    }));
    finalizeUpload.mockResolvedValue({});
    queryClient = new QueryClient();
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
          createElement(GameMediaPage),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const card = (title: string) => {
    const element = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="card"]'),
    ).find(
      (candidate) =>
        candidate.querySelector('[data-slot="card-title"]')?.textContent ===
        title,
    );
    if (!element) throw new Error(`Missing ${title} card.`);
    return element;
  };
  const selectFile = (title: string, file: File) => {
    const input =
      card(title).querySelector<HTMLInputElement>('input[type="file"]')!;
    act(() => {
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  const clickUpload = (title: string) =>
    act(() => card(title).querySelector<HTMLButtonElement>("button")!.click());
  const expectLocked = (title: string, locked: boolean) => {
    expect(card(title).querySelector<HTMLInputElement>("input")!.disabled).toBe(
      locked,
    );
    expect(
      card(title).querySelector<HTMLButtonElement>("button")!.disabled,
    ).toBe(locked);
  };

  it("distinguishes loading, failed reads and successful empty media history", () => {
    listMedia.mockReturnValue({ ...query, data: undefined, isLoading: true });
    render();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Loading managed media",
    );
    expect(container.textContent).not.toContain("No uploaded assets yet");
    listMedia.mockReturnValue({ ...query, data: undefined, isError: true });
    render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load your media",
    );
    expect(container.textContent).not.toContain("No asset assigned");
    expect(container.textContent).not.toContain("No uploaded assets yet");
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[role="alert"] button')!
        .click(),
    );
    expect(refetch).toHaveBeenCalledOnce();
    listMedia.mockReturnValue({ ...query, data: { assets: [] } });
    render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("No uploaded assets yet");
  });

  it("retains cached media during failed refresh and disables duplicate retry", () => {
    listMedia.mockReturnValue({
      ...query,
      data: { assets: [asset] },
      isError: true,
      isFetching: true,
    });
    render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Previously loaded media",
    );
    expect(
      container.querySelector(
        'img[src="https://games.example.invalid/existing.png"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('[role="alert"] button')!
        .disabled,
    ).toBe(true);
  });

  it.each(["target", "transfer", "finalize"])(
    "retains the file after failed %s and shows inline feedback",
    async (stage) => {
      let failStage: (error: Error) => void = () => {
        throw new Error("Pending stage has not started.");
      };
      const pending = () =>
        new Promise((_resolve, reject) => {
          failStage = reject;
        });
      if (stage === "target")
        requestUploadTarget.mockImplementationOnce(pending);
      if (stage === "transfer") upload.mockImplementationOnce(pending);
      if (stage === "finalize") finalizeUpload.mockImplementationOnce(pending);
      render();
      const file = new File(["image"], "thumbnail.png", { type: "image/png" });
      selectFile("Thumbnail", file);
      clickUpload("Thumbnail");
      await flush();
      expectLocked("Thumbnail", true);
      clickUpload("Thumbnail");
      expect(requestUploadTarget).toHaveBeenCalledOnce();
      await act(async () => failStage(new Error("Upload unavailable.")));
      await flush();
      expectLocked("Thumbnail", false);
      expect(
        card("Thumbnail").querySelector('[role="alert"]')?.textContent,
      ).toContain("Upload unavailable.");
      expect(browserAlert).not.toHaveBeenCalled();
      clickUpload("Thumbnail");
      await flush();
      expect(requestUploadTarget).toHaveBeenCalledTimes(2);
      expect(upload).toHaveBeenLastCalledWith(
        "https://storage.example.invalid/thumbnail",
        { method: "PUT", headers: {}, body: file },
      );
      expect(card("Thumbnail").querySelector('[role="alert"]')).toBeNull();
    },
  );

  it("keeps thumbnail and cover uploads independently pending until each is accepted", async () => {
    const finishes = new Map<string, (value: { ok: boolean }) => void>();
    upload.mockImplementation(
      (url: string) => new Promise((resolve) => finishes.set(url, resolve)),
    );
    render();
    selectFile(
      "Thumbnail",
      new File(["image"], "thumbnail.png", { type: "image/png" }),
    );
    selectFile(
      "Cover",
      new File(["image"], "cover.png", { type: "image/png" }),
    );
    clickUpload("Thumbnail");
    await flush();
    clickUpload("Cover");
    await flush();
    expectLocked("Thumbnail", true);
    expectLocked("Cover", true);
    await act(async () =>
      finishes.get("https://storage.example.invalid/thumbnail")!({ ok: true }),
    );
    await flush();
    expect(
      card("Thumbnail").querySelector<HTMLButtonElement>("button")!.disabled,
    ).toBe(true);
    expect(
      card("Thumbnail").querySelector<HTMLInputElement>("input")!.disabled,
    ).toBe(false);
    expectLocked("Cover", true);
    await act(async () =>
      finishes.get("https://storage.example.invalid/cover")!({ ok: true }),
    );
    await flush();
    expect(finalizeUpload.mock.calls).toEqual([
      [{ gameId: "game-1", assetId: "thumbnail-asset" }],
      [{ gameId: "game-1", assetId: "cover-asset" }],
    ]);
    expect(
      card("Cover").querySelector<HTMLInputElement>("input")!.disabled,
    ).toBe(false);
    expect(
      card("Cover").querySelector<HTMLButtonElement>("button")!.disabled,
    ).toBe(true);
  });

  it("rejects an oversized file locally with inline feedback", async () => {
    render();
    const file = new File(["image"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", {
      value: MAX_GAME_MEDIA_BYTES.thumbnail + 1,
    });
    selectFile("Thumbnail", file);
    clickUpload("Thumbnail");
    await flush();
    expect(requestUploadTarget).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(
      card("Thumbnail").querySelector('[role="alert"]')?.textContent,
    ).toContain("exceeds");
    expect(browserAlert).not.toHaveBeenCalled();
  });

  it.each(["assign", "archive"])(
    "shows %s failure inline without hiding existing media",
    async (operation) => {
      listMedia.mockReturnValue({
        ...query,
        data: { assets: [{ ...asset, isActive: false }] },
      });
      const action = operation === "assign" ? assign : archive;
      action.mockRejectedValueOnce(new Error("Action unavailable."));
      render();
      const title = operation === "assign" ? "Make Active" : "Archive";
      const button = Array.from(
        card("Thumbnail").querySelectorAll<HTMLButtonElement>("button"),
      ).find((candidate) => candidate.textContent === title)!;
      act(() => button.click());
      await flush();
      expect(action).toHaveBeenCalledExactlyOnceWith({
        gameId: "game-1",
        assetId: "asset-1",
      });
      expect(
        card("Thumbnail").querySelector('[role="alert"]')?.textContent,
      ).toContain("Action unavailable.");
      expect(card("Thumbnail").textContent).toContain("existing.png");
      expect(browserAlert).not.toHaveBeenCalled();
    },
  );
});
