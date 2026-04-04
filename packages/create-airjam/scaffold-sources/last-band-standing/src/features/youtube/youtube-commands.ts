import { clampNumber } from "@/utils/math-utils";
import { YOUTUBE_MAX_VOLUME } from "@/config";

export const sendYouTubeCommand = (
  playerFrame: HTMLIFrameElement | null,
  func: string,
  args: Array<string | number | boolean> = [],
): void => {
  if (!playerFrame?.contentWindow) {
    return;
  }

  playerFrame.contentWindow.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args,
    }),
    "*",
  );
};

export const setYouTubeVolume = (
  playerFrame: HTMLIFrameElement | null,
  volume: number,
): void => {
  const nextVolume = clampNumber(Math.round(volume), 0, YOUTUBE_MAX_VOLUME);
  sendYouTubeCommand(playerFrame, "setVolume", [nextVolume]);
};

export const parseYouTubeMessageData = (
  payload: unknown,
): { event?: string; info?: unknown } | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        return parsed as { event?: string; info?: unknown };
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof payload === "object") {
    return payload as { event?: string; info?: unknown };
  }

  return null;
};
