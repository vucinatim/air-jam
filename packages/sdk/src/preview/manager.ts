import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeRuntimeUrl } from "../protocol/url-policy";
import { PREVIEW_WINDOW_HEIGHT, PREVIEW_WINDOW_WIDTH } from "./layout";
import { createPreviewControllerLaunch } from "./url";

export type PreviewControllerSurfaceState = "loading" | "ready" | "failed";

const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const PREVIEW_WINDOW_MARGIN = 24;
const PREVIEW_WORKSPACE_LAUNCHER_OFFSET = 88;
const PREVIEW_WINDOW_CASCADE_OFFSET = 28;

export interface PreviewControllerSession {
  id: string;
  ordinal: number;
  label: string;
  controllerId: string;
  deviceId: string;
  url: string;
  surfaceState: PreviewControllerSurfaceState;
  minimized: boolean;
  active: boolean;
  x: number;
  y: number;
  zIndex: number;
}

export interface UsePreviewControllerManagerOptions {
  joinUrl: string | null | undefined;
  enabled?: boolean;
  maxControllers?: number;
  allowedOrigins?: readonly string[];
}

export interface UsePreviewControllerManagerResult {
  sessions: PreviewControllerSession[];
  canSpawn: boolean;
  spawnPreviewController: () => PreviewControllerSession | null;
  removePreviewController: (id: string) => void;
  minimizePreviewController: (id: string) => void;
  restorePreviewController: (id: string) => void;
  focusPreviewController: (id: string) => void;
  setPreviewControllerPosition: (id: string, x: number, y: number) => void;
  markPreviewControllerReady: (id: string) => void;
  markPreviewControllerFailed: (id: string) => void;
  clearPreviewControllers: () => void;
}

const getViewportSize = () => {
  if (typeof window === "undefined") {
    return {
      width: DEFAULT_VIEWPORT_WIDTH,
      height: DEFAULT_VIEWPORT_HEIGHT,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const getJoinRoomIdentity = (joinUrl: string | null | undefined) => {
  if (!joinUrl) {
    return null;
  }

  try {
    const normalizedJoinUrl = normalizeRuntimeUrl(joinUrl) ?? joinUrl;
    const roomId = new URL(normalizedJoinUrl).searchParams.get("room");
    return roomId && roomId.trim().length > 0 ? roomId : normalizedJoinUrl;
  } catch {
    return joinUrl;
  }
};

const clampPosition = (x: number, y: number) => {
  const viewport = getViewportSize();
  const maxX = Math.max(PREVIEW_WINDOW_MARGIN, viewport.width - PREVIEW_WINDOW_WIDTH - PREVIEW_WINDOW_MARGIN);
  const maxY = Math.max(PREVIEW_WINDOW_MARGIN, viewport.height - PREVIEW_WINDOW_HEIGHT - PREVIEW_WINDOW_MARGIN);

  return {
    x: Math.min(Math.max(PREVIEW_WINDOW_MARGIN, x), maxX),
    y: Math.min(Math.max(PREVIEW_WINDOW_MARGIN, y), maxY),
  };
};

const getInitialWindowPosition = (
  sessions: PreviewControllerSession[],
  ordinal: number,
) => {
  const viewport = getViewportSize();
  const cascadeCount = Math.min(sessions.length, 3);
  const offset = cascadeCount * PREVIEW_WINDOW_CASCADE_OFFSET;
  const defaultX =
    viewport.width -
    PREVIEW_WINDOW_WIDTH -
    PREVIEW_WINDOW_MARGIN -
    offset;
  const defaultY =
    viewport.height -
    PREVIEW_WINDOW_HEIGHT -
    PREVIEW_WORKSPACE_LAUNCHER_OFFSET -
    offset;

  const anchored = clampPosition(defaultX, defaultY);

  return {
    x: anchored.x,
    y: anchored.y + Math.max(0, ordinal - 1) * 0,
  };
};

const getNextTopSessionId = (sessions: PreviewControllerSession[]) =>
  sessions
    .filter((session) => !session.minimized)
    .sort((left, right) => right.zIndex - left.zIndex)[0]?.id ?? null;

const activateSession = (
  sessions: PreviewControllerSession[],
  id: string,
  nextZIndex: number,
): PreviewControllerSession[] =>
  sessions.map((session) =>
    session.id === id
      ? {
          ...session,
          active: true,
          minimized: false,
          zIndex: nextZIndex,
        }
      : { ...session, active: false },
  );

const normalizeActiveSession = (sessions: PreviewControllerSession[]) => {
  const nextActiveId = getNextTopSessionId(sessions);

  return sessions.map((session) => ({
    ...session,
    active: nextActiveId !== null && session.id === nextActiveId,
  }));
};

export const usePreviewControllerManager = ({
  joinUrl,
  enabled = true,
  maxControllers = 2,
  allowedOrigins,
}: UsePreviewControllerManagerOptions): UsePreviewControllerManagerResult => {
  const [sessions, setSessions] = useState<PreviewControllerSession[]>([]);
  const nextOrdinalRef = useRef(1);
  const nextZIndexRef = useRef(1);
  const previousJoinRoomRef = useRef<string | null>(
    getJoinRoomIdentity(joinUrl),
  );

  useEffect(() => {
    const nextJoinRoom = getJoinRoomIdentity(joinUrl);
    const previousJoinRoom = previousJoinRoomRef.current;

    if (
      !enabled ||
      (previousJoinRoom !== null &&
        nextJoinRoom !== null &&
        previousJoinRoom !== nextJoinRoom)
    ) {
      setSessions([]);
      nextOrdinalRef.current = 1;
      nextZIndexRef.current = 1;
    }

    previousJoinRoomRef.current = nextJoinRoom;
  }, [enabled, joinUrl]);

  const canSpawn =
    enabled &&
    typeof joinUrl === "string" &&
    joinUrl.trim().length > 0 &&
    sessions.length < maxControllers;

  const spawnPreviewController = useCallback((): PreviewControllerSession | null => {
    if (!enabled || !joinUrl) {
      return null;
    }

    let nextSession: PreviewControllerSession | null = null;

    setSessions((current) => {
      if (current.length >= maxControllers) {
        return current;
      }

      const launch = createPreviewControllerLaunch({
        joinUrl,
        allowedOrigins,
      });
      if (!launch) {
        return current;
      }

      const ordinal = nextOrdinalRef.current++;
      const zIndex = nextZIndexRef.current++;
      const position = getInitialWindowPosition(current, ordinal);
      nextSession = {
        id: launch.controllerId,
        ordinal,
        label: `Preview ${ordinal}`,
        controllerId: launch.controllerId,
        deviceId: launch.deviceId,
        url: launch.url,
        surfaceState: "loading",
        minimized: false,
        active: true,
        x: position.x,
        y: position.y,
        zIndex,
      };

      return [
        ...current.map((session) => ({ ...session, active: false })),
        nextSession,
      ];
    });

    return nextSession;
  }, [allowedOrigins, enabled, joinUrl, maxControllers]);

  const removePreviewController = useCallback((id: string) => {
    setSessions((current) =>
      normalizeActiveSession(current.filter((session) => session.id !== id)),
    );
  }, []);

  const clearPreviewControllers = useCallback(() => {
    setSessions([]);
    nextOrdinalRef.current = 1;
    nextZIndexRef.current = 1;
  }, []);

  const minimizePreviewController = useCallback((id: string) => {
    setSessions((current) =>
      normalizeActiveSession(
        current.map((session) =>
          session.id === id
            ? { ...session, minimized: true, active: false }
            : session,
        ),
      ),
    );
  }, []);

  const focusPreviewController = useCallback((id: string) => {
    const nextZIndex = nextZIndexRef.current++;
    setSessions((current) => activateSession(current, id, nextZIndex));
  }, []);

  const restorePreviewController = useCallback((id: string) => {
    const nextZIndex = nextZIndexRef.current++;
    setSessions((current) => activateSession(current, id, nextZIndex));
  }, []);

  const setPreviewControllerPosition = useCallback(
    (id: string, x: number, y: number) => {
      const nextPosition = clampPosition(x, y);
      setSessions((current) =>
        current.map((session) =>
          session.id === id
            ? {
                ...session,
                x: nextPosition.x,
                y: nextPosition.y,
              }
            : session,
        ),
      );
    },
    [],
  );

  const markPreviewControllerReady = useCallback((id: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, surfaceState: "ready" } : session,
      ),
    );
  }, []);

  const markPreviewControllerFailed = useCallback((id: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, surfaceState: "failed" } : session,
      ),
    );
  }, []);

  return {
    sessions,
    canSpawn,
    spawnPreviewController,
    removePreviewController,
    minimizePreviewController,
    restorePreviewController,
    focusPreviewController,
    setPreviewControllerPosition,
    markPreviewControllerReady,
    markPreviewControllerFailed,
    clearPreviewControllers,
  };
};
