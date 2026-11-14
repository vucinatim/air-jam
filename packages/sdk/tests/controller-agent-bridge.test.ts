import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ControllerRuntime } from "../src/core/controller-runtime";
import { readPreviewControllerParent } from "../src/preview/identity";
import {
  CONTROLLER_CAPTURE_TIMEOUT_MS,
  type ControllerAgentRequest,
  type ControllerFrameCapture,
} from "../src/runtime/contracts/controller-agent";
import { publishEmbeddedControllerAgent } from "../src/runtime/controller-agent-bridge";
import { captureControllerDocument } from "../src/runtime/controller-capture";
import { pressControllerDocument } from "../src/runtime/controller-press";

vi.mock("../src/preview/identity", () => ({
  readPreviewControllerParent: vi.fn(),
}));
vi.mock("../src/runtime/controller-capture", () => ({
  captureControllerDocument: vi.fn(),
}));

vi.mock("../src/runtime/controller-press", () => ({
  pressControllerDocument: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture() {
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  const parent = { postMessage: vi.fn() };
  vi.mocked(readPreviewControllerParent).mockReturnValue({
    window: parent as unknown as Window,
    origin: "https://studio.example",
  });
  const runtime = {
    store: { getState: () => ({ roomId: "ABCD", controllerId: "phone" }) },
  } as unknown as ControllerRuntime;
  const close = publishEmbeddedControllerAgent(runtime);
  const send = (
    request: ControllerAgentRequest = {
      operation: "capture",
      roomId: "ABCD",
      controllerId: "phone",
    },
    source = parent,
    origin = "https://studio.example",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event("message"), {
        source,
        origin,
        data: {
          type: "AIRJAM_CONTROLLER_AGENT",
          requestId: "capture",
          request,
        },
      }),
    );
  return { parent, send, close };
}

describe("controller capture deadline", () => {
  it("waits ten seconds for phone paint, then returns its own timeout detail exactly once", async () => {
    let finish!: (capture: ControllerFrameCapture) => void;
    vi.mocked(captureControllerDocument).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const f = fixture();
    try {
      f.send();
      await vi.dynamicImportSettled();
      expect(captureControllerDocument).toHaveBeenCalledOnce();
      expect(CONTROLLER_CAPTURE_TIMEOUT_MS).toBe(10_000);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(f.parent.postMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(
        CONTROLLER_CAPTURE_TIMEOUT_MS - 3_000 - 1,
      );
      expect(f.parent.postMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(f.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AIRJAM_CONTROLLER_AGENT_RESULT",
          requestId: "capture",
          capture: {
            status: "unavailable",
            reason: "timeout",
            detail: expect.stringContaining("10 seconds"),
          },
        }),
        "https://studio.example",
        [],
      );
      finish({ status: "unavailable", reason: "surface-unavailable" });
      await vi.advanceTimersByTimeAsync(0);
      expect(f.parent.postMessage).toHaveBeenCalledOnce();
    } finally {
      f.close();
    }
  });

  it("returns a capture that completes after the host observation budget without retrying", async () => {
    class Bitmap {
      width = 100;
      height = 200;
      close = vi.fn();
    }
    vi.stubGlobal("ImageBitmap", Bitmap);
    const capture: ControllerFrameCapture = {
      status: "captured",
      bitmap: new Bitmap() as unknown as ImageBitmap,
    };
    vi.mocked(captureControllerDocument).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(capture), 7_000)),
    );
    const f = fixture();
    try {
      f.send();
      await vi.dynamicImportSettled();
      await vi.advanceTimersByTimeAsync(7_000);
      expect(f.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ capture }),
        "https://studio.example",
        [capture.bitmap],
      );
      await vi.advanceTimersByTimeAsync(CONTROLLER_CAPTURE_TIMEOUT_MS);
      expect(f.parent.postMessage).toHaveBeenCalledOnce();
      expect(captureControllerDocument).toHaveBeenCalledOnce();
    } finally {
      f.close();
    }
  });
});

it("presses only from the configured parent for this phone, reports busy and returns its capture", async () => {
  let finish!: (
    result: Awaited<ReturnType<typeof pressControllerDocument>>,
  ) => void;
  vi.mocked(pressControllerDocument).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const f = fixture();
  const request: ControllerAgentRequest = {
    operation: "press",
    roomId: "ABCD",
    controllerId: "phone",
    action: { kind: "tap", x: 0.5, y: 0.5 },
  };
  try {
    f.send(request, f.parent, "https://other.example");
    f.send(request, { postMessage: vi.fn() });
    f.send({ ...request, roomId: "WXYZ" });
    f.send({ ...request, controllerId: "guest" });
    expect(f.parent.postMessage).not.toHaveBeenCalled();
    f.send(request);
    await vi.dynamicImportSettled();
    expect(pressControllerDocument).toHaveBeenCalledExactlyOnceWith(
      request.action,
      expect.any(AbortSignal),
    );
    f.send(request);
    expect(f.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ press: { status: "missed", reason: "busy" } }),
      "https://studio.example",
    );
    const result = {
      press: { status: "done", target: { tag: "button" } },
      capture: { status: "unavailable", reason: "unsupported" },
    } as const;
    finish(result);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.parent.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining(result),
      "https://studio.example",
      [],
    );
    expect(captureControllerDocument).not.toHaveBeenCalled();
  } finally {
    f.close();
  }
});
