import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewControllerLaunch } from "./url";

export type PreviewControllerSurfaceState = "loading" | "ready" | "failed";

export interface PreviewControllerSession {
  id: string;
  ordinal: number;
  label: string;
  controllerId: string;
  deviceId: string;
  url: string;
  surfaceState: PreviewControllerSurfaceState;
  expanded: boolean;
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
  setPreviewControllerExpanded: (id: string, expanded: boolean) => void;
  focusPreviewController: (id: string) => void;
  markPreviewControllerReady: (id: string) => void;
  markPreviewControllerFailed: (id: string) => void;
  clearPreviewControllers: () => void;
}

const moveSessionToFront = (
  sessions: PreviewControllerSession[],
  id: string,
): PreviewControllerSession[] => {
  const index = sessions.findIndex((session) => session.id === id);
  if (index < 0 || index === sessions.length - 1) {
    return sessions;
  }

  const next = sessions.slice();
  const [target] = next.splice(index, 1);
  next.push(target);
  return next;
};

export const usePreviewControllerManager = ({
  joinUrl,
  enabled = true,
  maxControllers = 2,
  allowedOrigins,
}: UsePreviewControllerManagerOptions): UsePreviewControllerManagerResult => {
  const [sessions, setSessions] = useState<PreviewControllerSession[]>([]);
  const nextOrdinalRef = useRef(1);
  const previousJoinUrlRef = useRef<string | null>(joinUrl ?? null);

  useEffect(() => {
    const normalizedJoinUrl = joinUrl ?? null;
    const previousJoinUrl = previousJoinUrlRef.current;
    if (!enabled || previousJoinUrl !== normalizedJoinUrl) {
      setSessions([]);
    }
    previousJoinUrlRef.current = normalizedJoinUrl;
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
      nextSession = {
        id: launch.controllerId,
        ordinal,
        label: `Preview ${ordinal}`,
        controllerId: launch.controllerId,
        deviceId: launch.deviceId,
        url: launch.url,
        surfaceState: "loading",
        expanded: current.length === 0,
      };

      return [...current, nextSession];
    });

    return nextSession;
  }, [allowedOrigins, enabled, joinUrl, maxControllers]);

  const removePreviewController = useCallback((id: string) => {
    setSessions((current) => current.filter((session) => session.id !== id));
  }, []);

  const clearPreviewControllers = useCallback(() => {
    setSessions([]);
  }, []);

  const setPreviewControllerExpanded = useCallback(
    (id: string, expanded: boolean) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === id ? { ...session, expanded } : session,
        ),
      );
    },
    [],
  );

  const focusPreviewController = useCallback((id: string) => {
    setSessions((current) =>
      moveSessionToFront(
        current.map((session) =>
          session.id === id ? { ...session, expanded: true } : session,
        ),
        id,
      ),
    );
  }, []);

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
    setPreviewControllerExpanded,
    focusPreviewController,
    markPreviewControllerReady,
    markPreviewControllerFailed,
    clearPreviewControllers,
  };
};
