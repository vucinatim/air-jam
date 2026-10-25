import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isLocalSeatReadyMessage,
  sendLocalSeatOperation,
  type LocalSeat,
  type LocalSeatProvider,
  type OpenedLocalSeat,
} from "../runtime/local-seats";
import type { PreviewControllerSession } from "./manager";

interface SeatRequest {
  seat: LocalSeat;
  resolve: (opened: OpenedLocalSeat | null) => void;
  /** A phone was asked for; if none appears, the workspace was full. */
  spawned: boolean;
}

/**
 * Local players' seats as the workspace's own preview phones. A seat's phone
 * is the session launched for its key; the seat opens once that session's
 * frame says it takes input and closes when the session is removed. A full
 * workspace refuses the seat.
 */
export const useWorkspaceLocalSeats = ({
  enabled,
  sessions,
  canSpawn,
  spawn,
  frames,
}: {
  enabled: boolean;
  sessions: readonly PreviewControllerSession[];
  canSpawn: boolean;
  spawn: (options: { localSeat: LocalSeat }) => unknown;
  /** Each session's controller frame while it is mounted. */
  frames: ReadonlyMap<string, HTMLIFrameElement>;
}): LocalSeatProvider | null => {
  const requests = useRef(new Map<string, SeatRequest>());
  const closings = useRef(new Map<string, () => void>());
  const [requested, setRequested] = useState(0);
  const provider = useMemo<LocalSeatProvider | null>(
    () =>
      enabled
        ? {
            open: (seat) =>
              new Promise((resolve) => {
                requests.current.set(seat.key, {
                  seat,
                  resolve,
                  spawned: false,
                });
                setRequested((count) => count + 1);
              }),
          }
        : null,
    [enabled],
  );

  // Sessions whose phone said it takes input; a later request for one opens at once.
  const ready = useRef(new Set<string>());
  const openSeat = useCallback(
    (key: string, request: SeatRequest, session: PreviewControllerSession) => {
      const origin = new URL(session.url).origin;
      requests.current.delete(key);
      // A new seat on the same phone supersedes the one opened before.
      closings.current.get(session.id)?.();
      request.resolve({
        send: (operation) => {
          const target = frames.get(session.id)?.contentWindow;
          if (target) sendLocalSeatOperation(target, origin, operation);
        },
        closed: new Promise((close) => closings.current.set(session.id, close)),
      });
    },
    [frames],
  );

  useEffect(() => {
    let spawned = false;
    for (const [key, request] of requests.current) {
      const session = sessions.find(
        (candidate) => candidate.localSeat?.key === key,
      );
      if (session) {
        if (ready.current.has(session.id)) openSeat(key, request, session);
        continue;
      }
      if (request.spawned || !canSpawn) {
        requests.current.delete(key);
        request.resolve(null);
        continue;
      }
      requests.current.set(key, { ...request, spawned: true });
      spawned = true;
      spawn({ localSeat: request.seat });
    }
    // Look again once the spawn lands, so a phone that never appears is refused.
    if (spawned) setRequested((count) => count + 1);
    for (const sessionId of ready.current)
      if (!sessions.some((session) => session.id === sessionId))
        ready.current.delete(sessionId);
    for (const [sessionId, close] of closings.current)
      if (!sessions.some((session) => session.id === sessionId)) {
        closings.current.delete(sessionId);
        close();
      }
  }, [requested, sessions, canSpawn, spawn, openSeat]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isLocalSeatReadyMessage(event.data)) return;
      const session = sessions.find(
        (candidate) =>
          candidate.localSeat &&
          frames.get(candidate.id)?.contentWindow === event.source,
      );
      if (!session?.localSeat || event.origin !== new URL(session.url).origin)
        return;
      ready.current.add(session.id);
      const key = session.localSeat.key;
      const request = requests.current.get(key);
      // A reloaded phone keeps the seat it already opened.
      if (request) openSeat(key, request, session);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sessions, frames, openSeat]);

  return provider;
};
