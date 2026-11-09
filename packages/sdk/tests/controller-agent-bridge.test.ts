import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ControllerRuntime } from "../src/core/controller-runtime";
import { readPreviewControllerParent } from "../src/preview/identity";
import {
  CONTROLLER_CAPTURE_TIMEOUT_MS,
  type ControllerCapture,
} from "../src/runtime/contracts/controller-agent";
import { publishEmbeddedControllerAgent } from "../src/runtime/controller-agent-bridge";
import { captureControllerDocument } from "../src/runtime/controller-capture";

vi.mock("../src/preview/identity", () => ({
  readPreviewControllerParent: vi.fn(),
}));
vi.mock("../src/runtime/controller-capture", () => ({
  captureControllerDocument: vi.fn(),
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
  const send = () =>
    events.dispatchEvent(
      Object.assign(new Event("message"), {
        source: parent,
        origin: "https://studio.example",
        data: {
          type: "AIRJAM_CONTROLLER_AGENT",
          requestId: "capture",
          request: {
            operation: "capture",
            roomId: "ABCD",
            controllerId: "phone",
          },
        },
      }),
    );
  return { parent, send, close };
}

describe("controller capture deadline", () => {
  it("waits ten seconds for DOM capture, then returns its own timeout detail exactly once", async () => {
    let finish!: (capture: ControllerCapture) => void;
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
      );
      finish({ status: "unavailable", reason: "surface-unavailable" });
      await vi.advanceTimersByTimeAsync(0);
      expect(f.parent.postMessage).toHaveBeenCalledOnce();
    } finally {
      f.close();
    }
  });

  it("returns a capture that completes after the host observation budget without retrying", async () => {
    const capture: ControllerCapture = {
      status: "captured",
      image: {
        mimeType: "image/jpeg",
        data: "AAAA",
        width: 100,
        height: 200,
        coverage: "controller-view",
      },
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
      );
      await vi.advanceTimersByTimeAsync(CONTROLLER_CAPTURE_TIMEOUT_MS);
      expect(f.parent.postMessage).toHaveBeenCalledOnce();
      expect(captureControllerDocument).toHaveBeenCalledOnce();
    } finally {
      f.close();
    }
  });
});
