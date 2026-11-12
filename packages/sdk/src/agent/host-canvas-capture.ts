import type { HostObservationCapture } from "../core/host-runtime";
import {
  CLIP_FRAME_MAX_EDGE,
  CLIP_PAGE_BASE64_CHARS,
  CLIP_VIDEO_MAX_BYTES,
  CLIP_VIDEO_MAX_DURATION_MS,
  type NativeClipRecording,
} from "../runtime/contracts/clip";
import { encodeAgentCanvas } from "./capture-canvas";

export type HostCanvasDraw = (
  canvas: HTMLCanvasElement,
  options: { maxEdge: number },
) => boolean;

/** Browser-only binding. Drawing follows the game renderer; native encoding owns its own cadence. */
export function createHostCanvasCapture(draw: HostCanvasDraw) {
  const canvas = document.createElement("canvas");
  let active: { render: () => void; dispose: () => void } | undefined;
  const capture: HostObservationCapture = ({ maxEdge, quality }) => {
    if (active) throw new Error("clip_busy: The capture canvas is recording.");
    return draw(canvas, { maxEdge })
      ? encodeAgentCanvas(canvas, quality)
      : null;
  };
  capture.startVideo = (intervalMs): NativeClipRecording => {
    if (active) throw new Error("clip_busy: The capture canvas is recording.");
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream)
      throw new Error(
        "clip_unsupported: Native canvas recording is unavailable.",
      );
    if (!draw(canvas, { maxEdge: CLIP_FRAME_MAX_EDGE }))
      throw new Error(
        "clip_surface_unavailable: The game has no render surface.",
      );
    const mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType))
      throw new Error(
        "clip_unsupported: The browser has no VP9 media recorder.",
      );
    const width = canvas.width;
    const height = canvas.height;
    const stream = canvas.captureStream(Math.min(30, 1000 / intervalMs));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    const blobs: Blob[] = [];
    let disposed = false;
    let bytes = 0;
    let data: Uint8Array | undefined;
    let failure: Error | undefined;
    let drawsAttempted = 1;
    let drawsMade = 1;
    const drawIntervalMs = Math.max(intervalMs, 1000 / 30);
    let nextAt = performance.now() + drawIntervalMs;
    let resolveStopped: () => void;
    const stopped = new Promise<void>((resolve) => {
      resolveStopped = resolve;
    });
    const release = () => {
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      if (active === binding) active = undefined;
    };
    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    const binding = {
      render() {
        const now = performance.now();
        if (now < nextAt || recorder.state !== "recording") return;
        nextAt +=
          (Math.floor((now - nextAt) / drawIntervalMs) + 1) * drawIntervalMs;
        drawsAttempted++;
        try {
          if (!draw(canvas, { maxEdge: CLIP_FRAME_MAX_EDGE }))
            throw new Error(
              "clip_surface_unavailable: The game stopped drawing.",
            );
          if (canvas.width !== width || canvas.height !== height)
            throw new Error(
              "clip_capture_failed: The capture dimensions changed.",
            );
          drawsMade++;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          stop();
        }
      },
      dispose() {
        disposed = true;
        stop();
        release();
        blobs.length = 0;
        data = undefined;
      },
    };
    recorder.ondataavailable = (event) => {
      if (disposed) return;
      bytes += event.data.size;
      if (bytes > CLIP_VIDEO_MAX_BYTES) {
        failure = new Error(
          "clip_capture_failed: Native recording exceeds its byte budget.",
        );
        stop();
      } else blobs.push(event.data);
    };
    recorder.onerror = () => {
      failure = new Error(
        "clip_capture_failed: Native media recording failed.",
      );
      stop();
    };
    recorder.onstop = () => {
      release();
      resolveStopped();
    };
    const timer = setTimeout(() => {
      failure = new Error(
        "clip_capture_failed: Native recording exceeded 60 seconds.",
      );
      stop();
    }, CLIP_VIDEO_MAX_DURATION_MS + 2000);
    active = binding;
    try {
      recorder.start(1000);
    } catch (error) {
      release();
      throw error;
    }
    let finalizing: Promise<void> | undefined;
    return {
      stop() {
        finalizing ??= (async () => {
          stop();
          await stopped;
          if (failure) throw failure;
          if (disposed)
            throw new Error("clip_not_found: Recording was released.");
          data = new Uint8Array(
            await new Blob(blobs, { type: mimeType }).arrayBuffer(),
          );
          blobs.length = 0;
          if (!data.length)
            throw new Error("clip_capture_failed: Native recording is empty.");
        })();
        return finalizing;
      },
      page(fromChunk) {
        if (failure) throw failure;
        const chunkBytes = (CLIP_PAGE_BASE64_CHARS / 4) * 3;
        const offset = fromChunk * chunkBytes;
        const chunks: string[] = [];
        if (data && offset < data.length) {
          const chunk = data.subarray(offset, offset + chunkBytes);
          let text = "";
          for (let index = 0; index < chunk.length; index += 8192)
            text += String.fromCharCode(...chunk.subarray(index, index + 8192));
          chunks.push(btoa(text));
        }
        return {
          mimeType,
          width,
          height,
          chunks,
          nextChunk:
            data && offset + chunkBytes < data.length ? fromChunk + 1 : null,
        };
      },
      stats: () => ({ drawsAttempted, drawsMade }),
      dispose: binding.dispose,
    };
  };
  return { capture, rendered: () => active?.render() };
}
