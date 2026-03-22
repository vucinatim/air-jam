import { useEffect, useRef } from "react";
import { useAssertSessionScope } from "../context/session-providers";

export interface ControllerTickInfo {
  now: number;
  deltaMs: number;
  deltaSeconds: number;
  tick: number;
}

export interface ControllerTickOptions {
  enabled?: boolean;
  intervalMs?: number;
}

const DEFAULT_CONTROLLER_TICK_MS = 16;

/**
 * Canonical fixed-cadence controller tick helper.
 *
 * Use this to publish controller input at a stable cadence via `useInputWriter`.
 */
export const useControllerTick = (
  callback: (info: ControllerTickInfo) => void,
  options: ControllerTickOptions = {},
): void => {
  useAssertSessionScope("controller", "useControllerTick");

  const { enabled = true, intervalMs = DEFAULT_CONTROLLER_TICK_MS } = options;
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let tick = 0;
    let lastTime = performance.now();

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const deltaMs = now - lastTime;
      lastTime = now;
      tick += 1;

      callbackRef.current({
        now,
        deltaMs,
        deltaSeconds: deltaMs / 1000,
        tick,
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
};
