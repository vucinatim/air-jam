// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { encodeAgentCanvas } from "../src/agent/capture-canvas";
import { StageCaptureSurface } from "../src/components/stage-capture-surface";
import type { HostObservationCapture } from "../src/core/host-runtime";
import { useHostAgentCapture } from "../src/hooks/use-host-agent-capture";
import { HostCaptureBoundary } from "../src/runtime/host-capture-boundary";
import { supportsStageCapture } from "../src/runtime/stage-capture";

vi.mock("../src/runtime/stage-capture", async (original) => ({
  ...(await original<object>()),
  supportsStageCapture: vi.fn(() => true),
}));
vi.mock("../src/agent/capture-canvas", async (original) => ({
  ...(await original<object>()),
  encodeAgentCanvas: vi.fn(async () => ({
    mimeType: "image/jpeg",
    data: "YQ==",
    width: 300,
    height: 150,
    coverage: "render-surface",
  })),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLCanvasElement.prototype as unknown as { requestPaint?: unknown })
    .requestPaint;
  delete (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown })
    .captureStream;
});

function nativeStage() {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    reset: vi.fn(),
    drawElementImage: vi.fn(),
    clearRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "requestPaint", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  return drawImage;
}

it("captures and records the native HTML host without a game hook, including an unavailable game canvas", async () => {
  const drawImage = nativeStage();
  const start = vi.fn();
  const stopTrack = vi.fn();
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: () => ({ getTracks: () => [{ stop: stopTrack }] }),
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported = () => true;
      state = "inactive";
      start() {
        start();
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
      }
    },
  );
  let capture: HostObservationCapture | null = null;
  const setObservationCapture = (value: HostObservationCapture | null) => {
    capture = value;
  };
  const missing = vi.fn(() => false);
  function MissingGameCanvas() {
    useHostAgentCapture(missing);
    return <p>Lobby</p>;
  }
  const host = (game: boolean) => (
    <StageCaptureSurface role="host">
      <HostCaptureBoundary setObservationCapture={setObservationCapture}>
        {game ? <MissingGameCanvas /> : <p>Lobby</p>}
      </HostCaptureBoundary>
    </StageCaptureSurface>
  );
  const view = render(host(false));
  const source = view.container.querySelector("canvas")!;
  fireEvent(source, new Event("paint"));
  const read = () => capture!({ maxEdge: 1280, quality: 0.8 });
  expect(await read()).toMatchObject({ coverage: "host-document" });
  expect(drawImage).toHaveBeenLastCalledWith(source, 0, 0, 1, 1);
  view.rerender(host(true));
  expect(await read()).toMatchObject({ coverage: "host-document" });
  expect(missing).toHaveBeenCalledOnce();
  const recording = capture!.startVideo!(33);
  expect(start).not.toHaveBeenCalled();
  fireEvent(source, new Event("paint"));
  expect(start).toHaveBeenCalledOnce();
  expect(recording.stats().drawsMade).toBe(2);
  recording.dispose();
  expect(stopTrack).toHaveBeenCalledOnce();
  const calls = drawImage.mock.calls.length;
  fireEvent(source, new Event("paint"));
  expect(drawImage).toHaveBeenCalledTimes(calls);
  view.unmount();
  expect(capture).toBeNull();
});

it("prefers a working game hook and keeps it available without native stage support", async () => {
  const drawImage = nativeStage();
  const gameDraw = vi.fn(() => true);
  function Game() {
    useHostAgentCapture(gameDraw);
    return <canvas />;
  }
  let capture: HostObservationCapture | null = null;
  const setObservationCapture = (value: HostObservationCapture | null) => {
    capture = value;
  };
  const host = () => (
    <StageCaptureSurface role="host">
      <HostCaptureBoundary setObservationCapture={setObservationCapture}>
        <Game />
      </HostCaptureBoundary>
    </StageCaptureSurface>
  );
  const view = render(host());
  const read = () => capture!({ maxEdge: 1280, quality: 0.8 });
  expect(await read()).toMatchObject({ coverage: "render-surface" });
  expect(gameDraw).toHaveBeenCalledOnce();
  expect(drawImage).not.toHaveBeenCalled();
  expect(encodeAgentCanvas).toHaveBeenCalled();
  view.unmount();
  vi.mocked(supportsStageCapture).mockReturnValueOnce(false);
  render(host());
  expect(await read()).toMatchObject({ coverage: "render-surface" });
  expect(gameDraw).toHaveBeenCalledTimes(2);
  expect(drawImage).not.toHaveBeenCalled();
});
