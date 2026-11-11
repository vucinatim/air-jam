import {
  HOST_OBSERVATION_IMAGE_BYTES,
  type HostObservationImage,
} from "../runtime/contracts/observation";

type CaptureOptions = { maxEdge: number; quality: number; bitmap?: boolean };
export function captureAgentCanvas(
  canvas: HTMLCanvasElement | null,
  options: CaptureOptions & { bitmap: true },
): Promise<ImageBitmap | null>;
export function captureAgentCanvas(
  canvas: HTMLCanvasElement | null,
  options?: CaptureOptions & { bitmap?: false },
): HostObservationImage | null;
export function captureAgentCanvas(
  canvas: HTMLCanvasElement | null,
  options: CaptureOptions,
): HostObservationImage | null | Promise<ImageBitmap | null>;
/** Captures only this render surface; surrounding DOM is not included. */
export function captureAgentCanvas(
  canvas: HTMLCanvasElement | null,
  { maxEdge, quality, bitmap }: CaptureOptions = {
    maxEdge: 1280,
    quality: 0.8,
  },
): HostObservationImage | null | Promise<ImageBitmap | null> {
  if (!canvas || !canvas.width || !canvas.height) return null;
  const scale = Math.min(1, maxEdge / canvas.width, maxEdge / canvas.height);
  if (bitmap)
    return createImageBitmap(canvas, {
      resizeWidth: Math.max(1, Math.round(canvas.width * scale)),
      resizeHeight: Math.max(1, Math.round(canvas.height * scale)),
    });
  const image = canvas.ownerDocument.createElement("canvas");
  image.width = Math.max(1, Math.round(canvas.width * scale));
  image.height = Math.max(1, Math.round(canvas.height * scale));
  const context = image.getContext("2d");
  if (!context)
    throw new Error("Canvas observation requires a 2D capture context.");
  context.drawImage(canvas, 0, 0, image.width, image.height);
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
