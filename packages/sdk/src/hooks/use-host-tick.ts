import { useEffect, useRef } from "react";
import { useAssertSessionScope } from "../context/session-providers";

export interface HostTickInfo {
  now: number;
  deltaMs: number;
  deltaSeconds: number;
  tick: number;
}

export interface HostTickOptions {
  enabled?: boolean;
  mode?: "raf" | "interval";
  intervalMs?: number;
}

const DEFAULT_HOST_TICK_MS = 16;

/**
 * Canonical host tick helper.
 *
 * - `mode: "raf"` (default) for render-aligned host loops.
 * - `mode: "interval"` for fixed-cadence host polling loops.
 */
export const useHostTick = (
  callback: (info: HostTickInfo) => void,
  options: HostTickOptions = {},
): void => {
  useAssertSessionScope("host", "useHostTick");

  const {
    enabled = true,
    mode = "raf",
    intervalMs = DEFAULT_HOST_TICK_MS,
  } = options;
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

    if (mode === "interval") {
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
    }

    let rafId = 0;
    const frame = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      tick += 1;

      callbackRef.current({
        now,
        deltaMs,
        deltaSeconds: deltaMs / 1000,
        tick,
      });

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [enabled, mode, intervalMs]);
};
