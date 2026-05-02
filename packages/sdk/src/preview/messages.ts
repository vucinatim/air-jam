export const AIR_JAM_PREVIEW_CLOSE_REQUEST = "airjam.preview.close.request";
export const AIR_JAM_PREVIEW_CLOSE_RESULT = "airjam.preview.close.result";

export interface AirJamPreviewCloseRequestMessage {
  type: typeof AIR_JAM_PREVIEW_CLOSE_REQUEST;
}

export interface AirJamPreviewCloseResultMessage {
  type: typeof AIR_JAM_PREVIEW_CLOSE_RESULT;
  ok: boolean;
}

export const isPreviewCloseRequestMessage = (
  value: unknown,
): value is AirJamPreviewCloseRequestMessage =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === AIR_JAM_PREVIEW_CLOSE_REQUEST;

export const isPreviewCloseResultMessage = (
  value: unknown,
): value is AirJamPreviewCloseResultMessage =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === AIR_JAM_PREVIEW_CLOSE_RESULT &&
  typeof (value as { ok?: unknown }).ok === "boolean";
