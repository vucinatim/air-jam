import { afterEach, expect, it, vi } from "vitest";
import { createHostCanvasCapture } from "../src/agent/host-canvas-capture";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("draws native video on the game's rendering cadence and pages bytes after stop", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let now = 0;
  vi.stubGlobal("performance", { now: () => now });
  const track = { stop: vi.fn() };
  const canvas = {
    width: 1280,
    height: 720,
    captureStream: vi.fn(() => ({ getTracks: () => [track] })),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  class Recorder {
    static isTypeSupported = () => true;
    state = "inactive";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(["native-video"]) });
        this.onstop?.();
      });
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const draw = vi.fn((_canvas: HTMLCanvasElement) => true);
  const binding = createHostCanvasCapture(draw);
  const recording = binding.capture.startVideo!(33);
  expect(canvas.captureStream).toHaveBeenCalledWith(30);
  expect(recording.page(0).chunks).toEqual([]);
  for (now = 0; now <= 100; now += 10) binding.rendered();
  expect(draw).toHaveBeenCalledTimes(4);
  expect(recording.stats()).toEqual({ drawsAttempted: 4, drawsMade: 4 });
  for (const [target] of draw.mock.calls) expect(target).toBe(canvas);
  await recording.stop();
  expect(recording.page(0)).toMatchObject({
    chunks: [btoa("native-video")],
    nextChunk: null,
    width: 1280,
    height: 720,
  });
  expect(track.stop).toHaveBeenCalledOnce();
  binding.rendered();
  expect(draw).toHaveBeenCalledTimes(4);
  recording.dispose();
  expect(recording.page(0).chunks).toEqual([]);
});
