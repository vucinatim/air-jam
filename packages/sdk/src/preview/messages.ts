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

/** True only when this controller acknowledges leaving its room. */
export async function requestPreviewControllerClose(
  iframe: HTMLIFrameElement | null,
  sessionUrl: string,
): Promise<boolean> {
  const frameWindow = iframe?.contentWindow;
  if (!frameWindow) return false;
  const origin = new URL(sessionUrl).origin;
  return new Promise((resolve) => {
    const finish = (closed: boolean) => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(closed);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== frameWindow ||
        event.origin !== origin ||
        !isPreviewCloseResultMessage(event.data)
      )
        return;
      finish(event.data.ok);
    };
    const timeout = window.setTimeout(() => finish(false), 1000);
    window.addEventListener("message", onMessage);
    frameWindow.postMessage({ type: AIR_JAM_PREVIEW_CLOSE_REQUEST }, origin);
  });
}
