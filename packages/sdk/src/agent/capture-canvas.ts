import {
  HOST_OBSERVATION_IMAGE_BYTES,
  type HostObservationImage,
} from "../runtime/contracts/observation";

/** Captures only this render surface; surrounding DOM is not included. */
export function captureAgentCanvas(
  canvas: HTMLCanvasElement | null,
  { maxEdge, quality }: { maxEdge: number; quality: number } = {
    maxEdge: 1280,
    quality: 0.8,
  },
): HostObservationImage | null {
  if (!canvas) return null;
  const image = canvas.ownerDocument.createElement("canvas");
  if (!drawAgentCanvas(canvas, image, { maxEdge })) return null;
  return encodeAgentCanvas(image, quality);
}

/** Draws only the game's render surface into the SDK-owned persistent capture canvas. */
export function drawAgentCanvas(
  canvas: HTMLCanvasElement | null,
  image: HTMLCanvasElement,
  { maxEdge }: { maxEdge: number },
): boolean {
  if (!canvas || !canvas.width || !canvas.height) return false;
  const scale = Math.min(1, maxEdge / canvas.width, maxEdge / canvas.height);
  const width = Math.max(1, Math.round(canvas.width * scale));
  if (image.width !== width) image.width = width;
  const height = Math.max(1, Math.round(canvas.height * scale));
  if (image.height !== height) image.height = height;
  const context = image.getContext("2d");
  if (!context)
    throw new Error("Canvas observation requires a 2D capture context.");
  context.drawImage(canvas, 0, 0, image.width, image.height);
  return true;
}

export function encodeAgentCanvas(
  image: HTMLCanvasElement,
  quality: number,
): HostObservationImage {
  const encoded = image.toDataURL("image/jpeg", quality);
  const prefix = "data:image/jpeg;base64,";
  if (!encoded.startsWith(prefix))
    throw new Error("The renderer did not produce a JPEG observation.");
  const data = encoded.slice(prefix.length);
  if (data.length > Math.ceil(HOST_OBSERVATION_IMAGE_BYTES / 3) * 4)
    throw new Error("Canvas observation exceeds its image transfer budget.");
  return {
    mimeType: "image/jpeg",
    data,
    width: image.width,
    height: image.height,
    coverage: "render-surface",
  };
}
