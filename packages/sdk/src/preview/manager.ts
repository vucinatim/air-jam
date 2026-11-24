import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeRuntimeUrl } from "../protocol/url-policy";
import { type ControllerOrientation } from "../room-protocol";
import type { LocalSeat } from "../runtime/local-seats";
import {
  type PreviewControllerBounds,
  type PreviewControllerResizeHandle,
  DEFAULT_PREVIEW_CONTROLLER_SCALE,
  PREVIEW_CONTROLLER_MIN_SCALE,
  PREVIEW_WINDOW_TITLEBAR_HEIGHT,
  getDefaultPreviewWindowBounds,
  getPreviewControllerScaleConstraints,
  getPreviewControllerScaleForBounds,
  getPreviewControllerScaleForResize,
  getPreviewControllerViewportSize,
  getPreviewWindowBoundsForScale,
  getPreviewWindowSizeConstraints,
} from "./layout";
import { isPreviewSeatMessage } from "./messages";
import { createPreviewControllerLaunch } from "./url";

export type PreviewControllerSurfaceState = "loading" | "ready" | "failed";

const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const PREVIEW_WINDOW_MARGIN = 24;
const PREVIEW_WINDOW_CASCADE_OFFSET = 28;
const PREVIEW_WINDOW_DOCK_GAP = 12;
const DEFAULT_PREVIEW_CONTROLLER_ORIENTATION: ControllerOrientation =
  "portrait";

export interface PreviewControllerSession {
  id: string;
  ordinal: number;
  label: string;
  /** The local player's seat this phone plays, if it was launched for one. */
  localSeat: LocalSeat | null;
  /** The seat the room gave this phone, once the phone reports it. */
  seat: string | null;
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
  viewportWidth: number;
  viewportHeight: number;
  displayScale: number;
  zIndex: number;
}

/** The top edge of the workspace's dock, which local seats' phones open above. */
export interface PreviewControllerDockEdge {
  right: number;
  top: number;
}

export interface UsePreviewControllerManagerOptions {
  joinUrl: string | null | undefined;
  enabled?: boolean;
  maxControllers?: number;
  allowedOrigins?: readonly string[];
  embedOrigin?: string | null;
  fixedControllerOrientation?: "landscape" | null;
}

export interface UsePreviewControllerManagerResult {
  sessions: PreviewControllerSession[];
  canSpawn: boolean;
  /**
   * Opens a phone; `localSeat` launches it as that local player's seat, named
   * after it, small in a bottom corner beside `dock` (by default the
   * viewport's bottom-right corner).
   */
  spawnPreviewController: (options?: {
    localSeat?: LocalSeat;
    dock?: PreviewControllerDockEdge;
  }) => PreviewControllerSession | null;
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
  resizeHandle?: PreviewControllerResizeHandle;
  originBounds?: PreviewControllerBounds;
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

const clampScaleForViewport = (
  orientation: ControllerOrientation,
  scale: number,
) => {
  const viewport = getViewportSize();
  const deviceViewport = getPreviewControllerViewportSize(orientation);
  const constraints = getPreviewControllerScaleConstraints();
  const maxByViewport = Math.min(
    (viewport.width - PREVIEW_WINDOW_MARGIN * 2) / deviceViewport.width,
    (viewport.height -
      PREVIEW_WINDOW_MARGIN * 2 -
      PREVIEW_WINDOW_TITLEBAR_HEIGHT) /
      deviceViewport.height,
  );

  return Math.min(
    Math.max(scale, constraints.min),
    Math.max(constraints.min, Math.min(constraints.max, maxByViewport)),
  );
};

const getPreviewWindowBounds = (
  orientation: ControllerOrientation,
  scale: number,
) => {
  const displayScale = clampScaleForViewport(orientation, scale);
  const viewport = getPreviewControllerViewportSize(orientation);
  const bounds = getPreviewWindowBoundsForScale(orientation, displayScale);

  return {
    ...bounds,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    displayScale,
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
  currentBounds?: PreviewControllerBounds,
): PreviewControllerBounds => {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const resizeMode =
    currentBounds &&
    (bounds.width < currentBounds.width || bounds.height < currentBounds.height)
      ? "shrink"
      : "grow";
  const scale =
    options.resizeHandle && options.originBounds
      ? getPreviewControllerScaleForResize({
          orientation,
          bounds,
          originBounds: options.originBounds,
          handle: options.resizeHandle,
        })
      : getPreviewControllerScaleForBounds(orientation, bounds, resizeMode);
  const nextWindowBounds = getPreviewWindowBounds(orientation, scale);
  const { width, height } = nextWindowBounds;

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

const overlap = (
  start: number,
  size: number,
  otherStart: number,
  otherSize: number,
) =>
  Math.max(
    0,
    Math.min(start + size, otherStart + otherSize) -
      Math.max(start, otherStart),
  );

/**
 * A phone opened by hand opens at the default size near the centre,
 * cascading. A local seat's player plays from their keys and needs its phone
 * only for menus, so it opens at the smallest size in a bottom corner, out of
 * the game's way: in the place other seats' phones cover least, first just
 * above the dock, then the mirrored corner, then above those. A minimized
 * seat phone keeps its place, since restoring brings it back there.
 */
const getInitialWindowBounds = (
  sessions: PreviewControllerSession[],
  orientation: ControllerOrientation,
  seat: { dock?: PreviewControllerDockEdge } | null,
) => {
  const viewport = getViewportSize();
  if (!seat) {
    const bounds = getPreviewWindowBounds(
      orientation,
      DEFAULT_PREVIEW_CONTROLLER_SCALE,
    );
    const offset = Math.min(sessions.length, 3) * PREVIEW_WINDOW_CASCADE_OFFSET;
    return {
      ...bounds,
      ...clampPosition(
        orientation,
        (viewport.width - bounds.width) / 2 + offset,
        (viewport.height - bounds.height) / 2 + offset,
        bounds.width,
        bounds.height,
      ),
    };
  }

  const bounds = getPreviewWindowBounds(
    orientation,
    PREVIEW_CONTROLLER_MIN_SCALE,
  );
  const dock = seat.dock ?? { right: viewport.width, top: viewport.height };
  const place = (index: number) => ({
    ...bounds,
    ...clampPosition(
      orientation,
      index % 2 === 0 ? dock.right - bounds.width : viewport.width - dock.right,
      dock.top -
        (bounds.height + PREVIEW_WINDOW_DOCK_GAP) * (Math.floor(index / 2) + 1),
      bounds.width,
      bounds.height,
    ),
  });
  const seatPhones = sessions.filter((session) => session.localSeat);
  const coveredArea = (candidate: ReturnType<typeof place>) =>
    seatPhones.reduce(
      (area, phone) =>
        area +
        overlap(candidate.x, candidate.width, phone.x, phone.width) *
          overlap(candidate.y, candidate.height, phone.y, phone.height),
      0,
    );
  return Array.from({ length: seatPhones.length + 1 }, (_, index) =>
    place(index),
  ).reduce((best, candidate) =>
    coveredArea(candidate) < coveredArea(best) ? candidate : best,
  );
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

const orientSession = (
  session: PreviewControllerSession,
  nextOrientation: ControllerOrientation,
): PreviewControllerSession => {
  const centerX = session.x + session.width / 2;
  const centerY = session.y + session.height / 2;
  const nextWindowBounds = getPreviewWindowBounds(
    nextOrientation,
    session.displayScale,
  );
  const nextBounds = clampBounds(
    nextOrientation,
    {
      x: centerX - nextWindowBounds.width / 2,
      y: centerY - nextWindowBounds.height / 2,
      width: nextWindowBounds.width,
      height: nextWindowBounds.height,
    },
    {},
  );
  const clampedWindowBounds = getPreviewWindowBounds(
    nextOrientation,
    getPreviewControllerScaleForBounds(nextOrientation, nextBounds),
  );

  return {
    ...session,
    orientation: nextOrientation,
    x: nextBounds.x,
    y: nextBounds.y,
    width: clampedWindowBounds.width,
    height: clampedWindowBounds.height,
    viewportWidth: clampedWindowBounds.viewportWidth,
    viewportHeight: clampedWindowBounds.viewportHeight,
    displayScale: clampedWindowBounds.displayScale,
  };
};

export const usePreviewControllerManager = ({
  joinUrl,
  enabled = true,
  maxControllers = 2,
  allowedOrigins,
  embedOrigin,
  fixedControllerOrientation = null,
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

  const spawnPreviewController = useCallback(
    (options?: {
      localSeat?: LocalSeat;
      dock?: PreviewControllerDockEdge;
    }): PreviewControllerSession | null => {
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
          embedOrigin,
          localSeat: options?.localSeat?.label,
        });
        if (!launch) {
          return current;
        }

        const ordinal = nextOrdinalRef.current++;
        const zIndex = nextZIndexRef.current++;
        const sessionId = `preview_session_${nextSessionIdRef.current++}`;
        const orientation =
          fixedControllerOrientation ?? DEFAULT_PREVIEW_CONTROLLER_ORIENTATION;
        const bounds = getInitialWindowBounds(
          current,
          orientation,
          options?.localSeat ? { dock: options.dock } : null,
        );
        nextSession = {
          id: sessionId,
          ordinal,
          label: options?.localSeat?.label ?? `Preview ${ordinal}`,
          localSeat: options?.localSeat ?? null,
          seat: null,
          deviceId: launch.deviceId,
          url: launch.url,
          surfaceState: "loading",
          orientation,
          minimized: false,
          active: true,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          viewportWidth: bounds.viewportWidth,
          viewportHeight: bounds.viewportHeight,
          displayScale: bounds.displayScale,
          zIndex,
        };

        return [
          ...current.map((session) => ({ ...session, active: false })),
          nextSession,
        ];
      });

      return nextSession;
    },
    [
      allowedOrigins,
      embedOrigin,
      enabled,
      joinUrl,
      maxControllers,
      fixedControllerOrientation,
    ],
  );

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

          const nextBounds = clampBounds(session.orientation, bounds, options, {
            x: session.x,
            y: session.y,
            width: session.width,
            height: session.height,
          });
          const nextWindowBounds = getPreviewWindowBounds(
            session.orientation,
            getPreviewControllerScaleForBounds(session.orientation, nextBounds),
          );

          return {
            ...session,
            width: nextWindowBounds.width,
            height: nextWindowBounds.height,
            viewportWidth: nextWindowBounds.viewportWidth,
            viewportHeight: nextWindowBounds.viewportHeight,
            displayScale: nextWindowBounds.displayScale,
            x: nextBounds.x,
            y: nextBounds.y,
          };
        }),
      );
    },
    [],
  );

  const rotatePreviewController = useCallback(
    (id: string) => {
      if (fixedControllerOrientation) return;
      setSessions((current) =>
        mapSessionsAndNormalizeActive(current, (session) => {
          if (session.id !== id) {
            return session;
          }

          const nextOrientation: ControllerOrientation =
            session.orientation === "portrait" ? "landscape" : "portrait";
          return orientSession(session, nextOrientation);
        }),
      );
    },
    [fixedControllerOrientation],
  );

  useEffect(() => {
    if (!fixedControllerOrientation) return;
    setSessions((current) =>
      current.map((session) =>
        session.orientation === fixedControllerOrientation
          ? session
          : orientSession(session, fixedControllerOrientation),
      ),
    );
  }, [fixedControllerOrientation]);

  // Each phone reports the seat the room gave it, from its own origin.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isPreviewSeatMessage(event.data)) return;
      const { deviceId, seat } = event.data;
      setSessions((current) =>
        current.map((session) =>
          session.deviceId === deviceId &&
          new URL(session.url).origin === event.origin &&
          session.seat !== seat
            ? { ...session, seat }
            : session,
        ),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
