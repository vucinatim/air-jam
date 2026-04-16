import { useCallback, useEffect, useRef, useState } from "react";
import type { ControllerOrientation } from "../protocol/controller";
import { normalizeRuntimeUrl } from "../protocol/url-policy";
import {
  type PreviewControllerBounds,
  getDefaultPreviewWindowBounds,
  getPreviewWindowSizeConstraints,
} from "./layout";
import { createPreviewControllerLaunch } from "./url";

export type PreviewControllerSurfaceState = "loading" | "ready" | "failed";

const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const PREVIEW_WINDOW_MARGIN = 24;
const PREVIEW_WINDOW_CASCADE_OFFSET = 28;
const DEFAULT_PREVIEW_CONTROLLER_ORIENTATION: ControllerOrientation =
  "portrait";

export interface PreviewControllerSession {
  id: string;
  ordinal: number;
  label: string;
  controllerId: string;
  deviceId: string;
  url: string;
  surfaceState: PreviewControllerSurfaceState;
  orientation: ControllerOrientation;
  minimized: boolean;
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
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
  setPreviewControllerBounds: (
    id: string,
    bounds: PreviewControllerBounds,
    options?: PreviewControllerBoundsClampOptions,
  ) => void;
  rotatePreviewController: (id: string) => void;
  markPreviewControllerReady: (id: string) => void;
  markPreviewControllerFailed: (id: string) => void;
  clearPreviewControllers: () => void;
}

export interface PreviewControllerBoundsClampOptions {
  preserveRight?: boolean;
  preserveBottom?: boolean;
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

const clampSize = (
  orientation: ControllerOrientation,
  width: number,
  height: number,
) => {
  const viewport = getViewportSize();
  const constraints = getPreviewWindowSizeConstraints(orientation);
  const maxWidth = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, viewport.width - PREVIEW_WINDOW_MARGIN * 2),
  );
  const maxHeight = Math.max(
    constraints.minHeight,
    Math.min(
      constraints.maxHeight,
      viewport.height - PREVIEW_WINDOW_MARGIN * 2,
    ),
  );

  return {
    width: Math.min(Math.max(constraints.minWidth, width), maxWidth),
    height: Math.min(Math.max(constraints.minHeight, height), maxHeight),
  };
};

const clampPosition = (
  orientation: ControllerOrientation,
  x: number,
  y: number,
  width = getDefaultPreviewWindowBounds(DEFAULT_PREVIEW_CONTROLLER_ORIENTATION)
    .width,
  height = getDefaultPreviewWindowBounds(DEFAULT_PREVIEW_CONTROLLER_ORIENTATION)
    .height,
) => {
  const viewport = getViewportSize();
  const nextSize = clampSize(orientation, width, height);
  const maxX = Math.max(
    PREVIEW_WINDOW_MARGIN,
    viewport.width - nextSize.width - PREVIEW_WINDOW_MARGIN,
  );
  const maxY = Math.max(
    PREVIEW_WINDOW_MARGIN,
    viewport.height - nextSize.height - PREVIEW_WINDOW_MARGIN,
  );

  return {
    x: Math.min(Math.max(PREVIEW_WINDOW_MARGIN, x), maxX),
    y: Math.min(Math.max(PREVIEW_WINDOW_MARGIN, y), maxY),
  };
};

const clampBounds = (
  orientation: ControllerOrientation,
  bounds: PreviewControllerBounds,
  options: PreviewControllerBoundsClampOptions = {},
): PreviewControllerBounds => {
  const viewport = getViewportSize();
  const constraints = getPreviewWindowSizeConstraints(orientation);
  const maxWidth = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, viewport.width - PREVIEW_WINDOW_MARGIN * 2),
  );
  const maxHeight = Math.max(
    constraints.minHeight,
    Math.min(
      constraints.maxHeight,
      viewport.height - PREVIEW_WINDOW_MARGIN * 2,
    ),
  );

  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  const width = Math.min(
    Math.max(constraints.minWidth, bounds.width),
    maxWidth,
  );
  const height = Math.min(
    Math.max(constraints.minHeight, bounds.height),
    maxHeight,
  );

  const x = options.preserveRight ? right - width : bounds.x;
  const y = options.preserveBottom ? bottom - height : bounds.y;

  const position = clampPosition(orientation, x, y, width, height);
  return {
    x: position.x,
    y: position.y,
    width,
    height,
  };
};

const getInitialWindowPosition = (
  sessions: PreviewControllerSession[],
  orientation: ControllerOrientation,
) => {
  const viewport = getViewportSize();
  const defaultBounds = getDefaultPreviewWindowBounds(orientation);
  const cascadeCount = Math.min(sessions.length, 3);
  const offset = cascadeCount * PREVIEW_WINDOW_CASCADE_OFFSET;
  const defaultX = (viewport.width - defaultBounds.width) / 2 + offset;
  const defaultY = (viewport.height - defaultBounds.height) / 2 + offset;

  const anchored = clampPosition(
    orientation,
    defaultX,
    defaultY,
    defaultBounds.width,
    defaultBounds.height,
  );

  return {
    x: anchored.x,
    y: anchored.y,
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

const mapSessionsAndNormalizeActive = (
  sessions: PreviewControllerSession[],
  mapSession: (session: PreviewControllerSession) => PreviewControllerSession,
) => normalizeActiveSession(sessions.map(mapSession));

export const usePreviewControllerManager = ({
  joinUrl,
  enabled = true,
  maxControllers = 2,
  allowedOrigins,
}: UsePreviewControllerManagerOptions): UsePreviewControllerManagerResult => {
  const [sessions, setSessions] = useState<PreviewControllerSession[]>([]);
  const nextSessionIdRef = useRef(1);
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
      nextSessionIdRef.current = 1;
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

  const spawnPreviewController =
    useCallback((): PreviewControllerSession | null => {
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
        const sessionId = `preview_session_${nextSessionIdRef.current++}`;
        const orientation = DEFAULT_PREVIEW_CONTROLLER_ORIENTATION;
        const defaultBounds = getDefaultPreviewWindowBounds(orientation);
        const position = getInitialWindowPosition(current, orientation);
        nextSession = {
          id: sessionId,
          ordinal,
          label: `Preview ${ordinal}`,
          controllerId: launch.controllerId,
          deviceId: launch.deviceId,
          url: launch.url,
          surfaceState: "loading",
          orientation,
          minimized: false,
          active: true,
          x: position.x,
          y: position.y,
          width: defaultBounds.width,
          height: defaultBounds.height,
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
    nextSessionIdRef.current = 1;
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
      setSessions((current) =>
        mapSessionsAndNormalizeActive(current, (session) => {
          if (session.id !== id) {
            return session;
          }

          const nextPosition = clampPosition(
            session.orientation,
            x,
            y,
            session.width,
            session.height,
          );
          return {
            ...session,
            x: nextPosition.x,
            y: nextPosition.y,
          };
        }),
      );
    },
    [],
  );

  const setPreviewControllerBounds = useCallback(
    (
      id: string,
      bounds: PreviewControllerBounds,
      options: PreviewControllerBoundsClampOptions = {},
    ) => {
      setSessions((current) =>
        mapSessionsAndNormalizeActive(current, (session) => {
          if (session.id !== id) {
            return session;
          }

          const nextBounds = clampBounds(session.orientation, bounds, options);

          return {
            ...session,
            width: nextBounds.width,
            height: nextBounds.height,
            x: nextBounds.x,
            y: nextBounds.y,
          };
        }),
      );
    },
    [],
  );

  const rotatePreviewController = useCallback((id: string) => {
    setSessions((current) =>
      mapSessionsAndNormalizeActive(current, (session) => {
        if (session.id !== id) {
          return session;
        }

        const nextOrientation: ControllerOrientation =
          session.orientation === "portrait" ? "landscape" : "portrait";
        const centerX = session.x + session.width / 2;
        const centerY = session.y + session.height / 2;
        const nextBounds = clampBounds(
          nextOrientation,
          {
            x: centerX - session.height / 2,
            y: centerY - session.width / 2,
            width: session.height,
            height: session.width,
          },
          {},
        );

        return {
          ...session,
          orientation: nextOrientation,
          x: nextBounds.x,
          y: nextBounds.y,
          width: nextBounds.width,
          height: nextBounds.height,
        };
      }),
    );
  }, []);

  const markPreviewControllerReady = useCallback((id: string) => {
    setSessions((current) =>
      mapSessionsAndNormalizeActive(current, (session) =>
        session.id === id ? { ...session, surfaceState: "ready" } : session,
      ),
    );
  }, []);

  const markPreviewControllerFailed = useCallback((id: string) => {
    setSessions((current) =>
      mapSessionsAndNormalizeActive(current, (session) =>
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
    setPreviewControllerBounds,
    rotatePreviewController,
    markPreviewControllerReady,
    markPreviewControllerFailed,
    clearPreviewControllers,
  };
};
