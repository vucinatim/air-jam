import type { ControllerCapture } from "./contracts/controller-agent";
import {
  HOST_OBSERVATION_IMAGE_BYTES,
  hostObservationImageSchema,
} from "./contracts/observation";

/** Loaded only after a framed controller receives a capture request. */
export async function captureControllerDocument(): Promise<ControllerCapture> {
  if (
    typeof document === "undefined" ||
    typeof HTMLCanvasElement === "undefined"
  )
    return { status: "unavailable", reason: "unsupported" };
  const node = document.documentElement;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!node || width <= 0 || height <= 0)
    return { status: "unavailable", reason: "surface-unavailable" };
  try {
    // html-to-image clones canvas pixels as images, including 2D controller drawings.
    const { toJpeg } = await import("html-to-image");
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const canvasWidth = Math.max(1, Math.floor(width * scale));
    const canvasHeight = Math.max(1, Math.floor(height * scale));
    for (const quality of [0.8, 0.55, 0.3]) {
      const url = await toJpeg(node, {
        width,
        height,
        canvasWidth,
        canvasHeight,
        pixelRatio: 1,
        quality,
        backgroundColor:
          getComputedStyle(document.body).backgroundColor || "#ffffff",
      });
      const data = url.slice(url.indexOf(",") + 1);
      if ((data.length * 3) / 4 > HOST_OBSERVATION_IMAGE_BYTES) continue;
      const image = hostObservationImageSchema.parse({
        mimeType: "image/jpeg",
        data,
        width: canvasWidth,
        height: canvasHeight,
        coverage: "controller-view",
      });
      return {
        status: "captured",
        image: {
          ...image,
          mimeType: "image/jpeg",
          coverage: "controller-view",
        },
      };
    }
  } catch (error) {
    // Tainted canvases or unreachable document resources.
    return {
      status: "unavailable",
      reason: "surface-unavailable",
      detail: String(error instanceof Error ? error.message : error).slice(
        0,
        1024,
      ),
    };
  }
  return {
    status: "unavailable",
    reason: "surface-unavailable",
    detail: "The page exceeds the image budget at the lowest quality.",
  };
}
