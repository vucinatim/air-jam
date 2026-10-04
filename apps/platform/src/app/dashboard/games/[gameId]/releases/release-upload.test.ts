// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameReleasesPage from "./page";

const { createDraft, requestUploadTarget, finalizeUpload, invalidate } =
  vi.hoisted(() => ({
    createDraft: vi.fn(),
    requestUploadTarget: vi.fn(),
    finalizeUpload: vi.fn(),
    invalidate: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ gameId: "game-1" }),
}));

vi.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({
      game: { get: { invalidate } },
      release: { listByGame: { invalidate } },
    }),
    release: {
      listByGame: {
        useQuery: () => ({ data: [], isLoading: false, isError: false }),
      },
      ...Object.fromEntries(
        [
          ["createDraft", createDraft],
          ["requestUploadTarget", requestUploadTarget],
          ["finalizeUpload", finalizeUpload],
          ["publish", vi.fn()],
          ["archive", vi.fn()],
          ["requestExport", vi.fn()],
        ].map(([name, mutateAsync]) => [
          name,
          { useMutation: () => ({ mutateAsync, isPending: false }) },
        ]),
      ),
    },
  },
}));

describe("release upload lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let upload: ReturnType<typeof vi.fn>;
  const archive = new File(["built game"], "pong.zip", {
    type: "application/zip",
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    upload = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", upload);
    createDraft.mockResolvedValue({ id: "release-1" });
    requestUploadTarget.mockResolvedValue({
      generation: { id: "generation-1" },
      upload: {
        url: "https://storage.example.invalid/upload",
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
      },
    });
    finalizeUpload.mockResolvedValue({
      generation: { sequence: 1 },
      job: { id: "job-1" },
    });
    queryClient = new QueryClient();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(GameReleasesPage),
        ),
      ),
    );
    const version =
      container.querySelector<HTMLInputElement>("#release-version")!;
    const file = container.querySelector<HTMLInputElement>("#release-archive")!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(version, "  v1.0.0  ");
      version.dispatchEvent(new Event("input", { bubbles: true }));
      Object.defineProperty(file, "files", { value: [archive] });
      file.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const clickUpload = () =>
    act(() => {
      container.querySelector<HTMLButtonElement>("button")!.click();
    });
  const expectLocked = (locked: boolean) => {
    for (const selector of ["#release-version", "#release-archive", "button"]) {
      expect(
        container.querySelector<HTMLInputElement | HTMLButtonElement>(selector)!
          .disabled,
      ).toBe(locked);
    }
  };

  it.each(["draft", "target", "transfer", "finalize"])(
    "locks the submitted inputs throughout %s and preserves them on failure",
    async (stage) => {
      let failStage: (error: Error) => void = () => {
        throw new Error("The pending stage has not started.");
      };
      const pending = () =>
        new Promise((_resolve, reject) => {
          failStage = reject;
        });
      if (stage === "draft") createDraft.mockImplementationOnce(pending);
      if (stage === "target") requestUploadTarget.mockImplementationOnce(pending);
      if (stage === "transfer") upload.mockImplementationOnce(pending);
      if (stage === "finalize") finalizeUpload.mockImplementationOnce(pending);

      clickUpload();
      await flush();
      expectLocked(true);
      clickUpload();
      expect(createDraft).toHaveBeenCalledExactlyOnceWith({
        gameId: "game-1",
        versionLabel: "v1.0.0",
      });
      await act(async () => failStage(new Error("Please try again.")));
      await flush();

      expectLocked(false);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Please try again.",
      );
      expect(
        container.querySelector<HTMLInputElement>("#release-version")!.value,
      ).toBe("  v1.0.0  ");
      expect(container.textContent).toContain("pong.zip");
      expect(createDraft).toHaveBeenCalledOnce();
      expect(invalidate).toHaveBeenCalledTimes(stage === "draft" ? 0 : 2);
    },
  );

  it("does not finalize a rejected transfer and lets the creator retry", async () => {
    upload.mockResolvedValueOnce({ ok: false, status: 403 });
    clickUpload();
    await flush();
    expect(finalizeUpload).not.toHaveBeenCalled();
    expectLocked(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Release upload failed with status 403",
    );
    expect(container.textContent).toContain("pong.zip");

    clickUpload();
    await flush();
    expect(createDraft).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(finalizeUpload).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Release processing queued",
    );
    expect(container.textContent).not.toContain("pong.zip");
  });

  it("clears only after the exact archive and generation are accepted", async () => {
    clickUpload();
    await flush();
    expect(upload).toHaveBeenCalledExactlyOnceWith(
      "https://storage.example.invalid/upload",
      {
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
        body: archive,
      },
    );
    expect(finalizeUpload).toHaveBeenCalledExactlyOnceWith({
      releaseId: "release-1",
      generationId: "generation-1",
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Release processing queued",
    );
    expect(
      container.querySelector<HTMLInputElement>("#release-version")!.value,
    ).toBe("");
    expect(container.textContent).not.toContain("pong.zip");
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
