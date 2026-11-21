import type { ControllerFrameCapture } from "./contracts/controller-agent";

import {
  stageCaptureCanvasSelector,
  type StageCaptureCanvas,
} from "./stage-capture";

/** Pixels leave the phone as a transferable bitmap; encoding belongs to Studio. */
export async function captureControllerDocument(
  signal: AbortSignal,
): Promise<ControllerFrameCapture> {
  const canvas = document.querySelector<StageCaptureCanvas>(
    stageCaptureCanvasSelector,
  );
  if (!canvas)
    return {
      status: "unavailable",
      reason: "unsupported",
      detail:
        "Phone pane unavailable in this browser. Studio preview phone capture requires Chrome 157 or later.",
    };
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      canvas.removeEventListener("paint", painted);
      signal.removeEventListener("abort", aborted);
    };
    const painted = () => {
      cleanup();
      resolve();
    };
    const aborted = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.throwIfAborted();
    canvas.addEventListener("paint", painted, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    canvas.requestPaint();
  });
  const scale = Math.min(1, 1280 / Math.max(canvas.width, canvas.height));
  const bitmap = await createImageBitmap(canvas, {
    resizeWidth: Math.max(1, Math.round(canvas.width * scale)),
    resizeHeight: Math.max(1, Math.round(canvas.height * scale)),
  });
  if (signal.aborted) {
    bitmap.close();
    signal.throwIfAborted();
  }
  return { status: "captured", bitmap };
}
