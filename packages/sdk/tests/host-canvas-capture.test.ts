import { afterEach, expect, it, vi } from "vitest";
import { createHostCanvasCapture } from "../src/agent/host-canvas-capture";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("starts native video on the first live draw, follows rendering cadence and pages bytes after stop", async () => {
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
  const start = vi.fn();
  class Recorder {
    static isTypeSupported = () => true;
    state = "inactive";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      start();
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
  now = 274;
  expect(start).not.toHaveBeenCalled();
  expect(draw).toHaveBeenCalledOnce();
  binding.rendered();
  expect(start).toHaveBeenCalledOnce();
  expect(draw).toHaveBeenCalledTimes(2);
  expect(draw.mock.invocationCallOrder[1]).toBeLessThan(
    start.mock.invocationCallOrder[0],
  );
  for (now = 284; now <= 374; now += 10) binding.rendered();
  expect(draw).toHaveBeenCalledTimes(5);
  expect(recording.stats()).toEqual({ drawsAttempted: 5, drawsMade: 5 });
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
  expect(draw).toHaveBeenCalledTimes(5);
  recording.dispose();
  expect(recording.page(0).chunks).toEqual([]);
});

it("releases a recording stopped before the game draws its first live frame", async () => {
  vi.useFakeTimers();
  const stop = vi.fn();
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 1280,
      height: 720,
      captureStream: () => ({ getTracks: () => [{ stop }] }),
    }),
  });
  const start = vi.fn();
  class Recorder {
    static isTypeSupported = () => true;
    state = "inactive";
    start = start;
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const binding = createHostCanvasCapture(() => true);
  const recording = binding.capture.startVideo!(33);
  await expect(recording.stop()).rejects.toThrow("Native recording is empty");
  expect(stop).toHaveBeenCalledOnce();
  binding.rendered();
  expect(start).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
