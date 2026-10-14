// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostRuntimeInspectionContract } from "../src/runtime-inspection";
import { registerHostRuntimeActionStore } from "../src/runtime/contracts/control";
import {
  publishEmbeddedHostPreview,
  readHostPreviewSnapshot,
  requestHostPreviewSnapshot,
} from "../src/runtime/preview-inspection-bridge";

const originalParent = window.parent;
afterEach(() => {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: originalParent,
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "",
  });
});

describe("embedded host presentation inspection", () => {
  it("pushes store replacements without a room change or parent request", () => {
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://studio.example/studio",
    });
    const inspection = createHostRuntimeInspectionContract({
      roomId: "ROOM",
      joinUrl: "https://game.example/controller?room=ROOM",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [],
      controllers: [],
      mode: "standalone",
      runtimeState: "playing",
    });
    const cleanup = publishEmbeddedHostPreview(inspection);
    const binding = { roomId: "ROOM", storeDomain: "game", invoke: vi.fn() };
    const closeFirst = registerHostRuntimeActionStore(window, {
      ...binding,
      stateEpoch: "first",
    });
    const first = vi.mocked(parent.postMessage).mock.calls.at(-1)?.[0];
    const closeReplacement = registerHostRuntimeActionStore(window, {
      ...binding,
      stateEpoch: "replacement",
    });
    const replacement = vi.mocked(parent.postMessage).mock.calls.at(-1)?.[0];
    expect(replacement.snapshot.documentId).toBe(first.snapshot.documentId);
    expect(replacement.snapshot.roomId).toBe(first.snapshot.roomId);
    expect(replacement.snapshot.stateEpochs).toEqual([
      { storeDomain: "game", epoch: "replacement" },
    ]);
    closeFirst();
    expect(
      vi.mocked(parent.postMessage).mock.calls.at(-1)?.[0].snapshot.stateEpochs,
    ).toEqual(replacement.snapshot.stateEpochs);
    closeReplacement();
    expect(
      vi.mocked(parent.postMessage).mock.calls.at(-1)?.[0].snapshot.stateEpochs,
    ).toEqual([]);
    cleanup();
    const count = vi.mocked(parent.postMessage).mock.calls.length;
    const closeLater = registerHostRuntimeActionStore(window, {
      ...binding,
      stateEpoch: "later",
    });
    expect(parent.postMessage).toHaveBeenCalledTimes(count);
    closeLater();
  });
  it("publishes the canonical host snapshot and replies only to its embedding parent", () => {
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://studio.example/studio",
    });
    const inspection = createHostRuntimeInspectionContract({
      roomId: "ROOM",
      joinUrl: "https://game.example/controller?room=ROOM",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [],
      controllers: [],
      mode: "standalone",
      runtimeState: "paused",
      controllerOrientation: "landscape",
    });
    const cleanup = publishEmbeddedHostPreview(inspection);
    const send = (source: Window, origin: string) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source,
          origin,
          data: { type: "AIRJAM_HOST_PREVIEW_INSPECT" },
        }),
      );
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    send(window, "https://studio.example");
    send(parent, "https://attacker.example");
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    send(parent, "https://studio.example");
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
    const [data] = vi.mocked(parent.postMessage).mock.calls[0];
    expect(
      readHostPreviewSnapshot(
        new MessageEvent("message", {
          data,
          source: window,
          origin: "https://game.example",
        }),
        window,
        "https://game.example",
      ),
    ).toMatchObject({
      roomId: "ROOM",
      connectionStatus: "connected",
      controllerOrientation: "landscape",
    });
    cleanup();
    send(parent, "https://studio.example");
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
  });

  it("rejects spoofed senders, malformed state and cross-origin or different-room join URLs", () => {
    const snapshot = {
      roomId: "ROOM",
      joinUrl: "https://game.example/controller?room=ROOM",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      controllers: [],
    };
    const read = (
      value: unknown,
      source: Window = window,
      origin = "https://game.example",
    ) =>
      readHostPreviewSnapshot(
        new MessageEvent("message", {
          data: { type: "AIRJAM_HOST_PREVIEW_SNAPSHOT", snapshot: value },
          source,
          origin,
        }),
        window,
        "https://game.example",
      );
    expect(read(snapshot)).not.toBeNull();
    expect(
      read({ ...snapshot, controllerOrientation: "landscape" }),
    ).not.toBeNull();
    expect(read({ ...snapshot, controllerOrientation: "sideways" })).toBeNull();
    expect(
      read({
        ...snapshot,
        stateEpochs: [{ storeDomain: "game", epoch: "one" }],
        documentId: "document-one",
      }),
    ).not.toBeNull();
    expect(
      read({
        ...snapshot,
        stateEpochs: Array.from({ length: 65 }, () => ({
          storeDomain: "game",
          epoch: "one",
        })),
      }),
    ).toBeNull();
    expect(read({ ...snapshot, documentId: "x".repeat(129) })).toBeNull();
    expect(
      read({
        ...snapshot,
        stateEpochs: [
          { storeDomain: "game", epoch: "one" },
          { storeDomain: "game", epoch: "two" },
        ],
      }),
    ).toBeNull();
    expect(
      read({ ...snapshot, stateEpochs: [{ storeDomain: "game", epoch: "" }] }),
    ).toBeNull();
    expect(
      read({
        ...snapshot,
        joinUrl: "https://game.example/custom-controls?room=ROOM",
      }),
    ).not.toBeNull();
    expect(read(snapshot, {} as Window)).toBeNull();
    expect(read(snapshot, window, "https://attacker.example")).toBeNull();
    expect(read({ ...snapshot, connectionStatus: "success" })).toBeNull();
    expect(
      read({
        ...snapshot,
        joinUrl: "https://attacker.example/controller?room=ROOM",
      }),
    ).toBeNull();
    expect(
      read({
        ...snapshot,
        joinUrl: "https://game.example/controller?room=ELSE",
      }),
    ).toBeNull();
    expect(read({ ...snapshot, joinUrl: "javascript:alert(1)" })).toBeNull();
  });

  it("requests inspection using an exact target origin", () => {
    const target = { postMessage: vi.fn() } as unknown as Window;
    requestHostPreviewSnapshot(target, "https://game.example");
    expect(target.postMessage).toHaveBeenCalledWith(
      { type: "AIRJAM_HOST_PREVIEW_INSPECT" },
      "https://game.example",
    );
  });
});
