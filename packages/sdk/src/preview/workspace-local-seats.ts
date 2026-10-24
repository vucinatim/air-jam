import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    for (const [key, request] of requests.current) {
      if (sessions.some((session) => session.localSeat?.key === key)) continue;
      if (request.spawned || !canSpawn) {
        requests.current.delete(key);
        request.resolve(null);
        continue;
      }
      request.spawned = true;
      spawn({ localSeat: request.seat });
    }
    for (const [sessionId, close] of closings.current)
      if (!sessions.some((session) => session.id === sessionId)) {
        closings.current.delete(sessionId);
        close();
      }
  }, [requested, sessions, canSpawn, spawn]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isLocalSeatReadyMessage(event.data)) return;
      const session = sessions.find(
        (candidate) =>
          candidate.localSeat &&
          frames.get(candidate.id)?.contentWindow === event.source,
      );
      const key = session?.localSeat?.key;
      const origin = session && new URL(session.url).origin;
      const request = key && requests.current.get(key);
      // A reloaded phone keeps the seat it already opened.
      if (!session || !request || event.origin !== origin) return;
      requests.current.delete(key);
      request.resolve({
        send: (operation) => {
          const target = frames.get(session.id)?.contentWindow;
          if (target) sendLocalSeatOperation(target, origin, operation);
        },
        closed: new Promise((close) => closings.current.set(session.id, close)),
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sessions, frames]);

  return provider;
};
