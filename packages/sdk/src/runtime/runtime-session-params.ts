import { normalizeRuntimeUrl } from "../protocol/url-policy";

export interface ChildHostRuntimeParams {
  room: string;
  token: string;
  joinUrl?: string;
}

export interface EmbeddedControllerRuntimeParams {
  room: string;
  controllerId: string;
}

export const readChildHostRuntimeParams = (): ChildHostRuntimeParams | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const room = params.get("aj_room");
  const token = params.get("aj_token");
  if (!room || !token) {
    return null;
  }

  const joinUrl = params.get("aj_join_url");
  const normalizedJoinUrl = joinUrl ? normalizeRuntimeUrl(joinUrl) : null;

  return {
    room,
    token,
    joinUrl: normalizedJoinUrl ?? undefined,
  };
};

export const readEmbeddedControllerRuntimeParams =
  (): EmbeddedControllerRuntimeParams | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const params = new URLSearchParams(window.location.search);
    const room = params.get("aj_room");
    const controllerId = params.get("aj_controller_id");
    if (!room || !controllerId) {
      return null;
    }

    return {
      room,
      controllerId,
    };
  };
