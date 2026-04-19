import { useEffect, useRef } from "react";
import { useAssertSessionScope } from "../context/session-scope";

export interface HostTickInfo {
  now: number;
  deltaMs: number;
  deltaSeconds: number;
  tick: number;
}

export interface HostFrameInfo {
  now: number;
  deltaMs: number;
  deltaSeconds: number;
  frame: number;
  fixedStepAlpha: number;
}

export interface HostTickOptions {
  enabled?: boolean;
  mode?: "raf" | "interval" | "fixed";
  intervalMs?: number;
  maxDeltaMs?: number;
  maxStepsPerFrame?: number;
  onFrame?: (info: HostFrameInfo) => void;
}

const DEFAULT_HOST_TICK_MS = 16;
const DEFAULT_HOST_MAX_DELTA_MS = 250;
const DEFAULT_HOST_MAX_STEPS_PER_FRAME = 5;

/**
 * Canonical host tick helper.
 *
 * - `mode: "raf"` (default) for render-aligned host loops.
 * - `mode: "interval"` for fixed-cadence host polling loops.
 * - `mode: "fixed"` for deterministic fixed-step host simulation loops.
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
    maxDeltaMs = DEFAULT_HOST_MAX_DELTA_MS,
    maxStepsPerFrame = DEFAULT_HOST_MAX_STEPS_PER_FRAME,
    onFrame,
  } = options;
  const tickIntervalMs = Math.max(1, intervalMs);
  const frameDeltaCapMs = Math.max(tickIntervalMs, maxDeltaMs);
  const frameStepCap = Math.max(1, maxStepsPerFrame);
  const callbackRef = useRef(callback);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let tick = 0;
    let frameCount = 0;
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
      }, tickIntervalMs);

      return () => {
        window.clearInterval(intervalId);
      };
    }

    let rafId = 0;

    if (mode === "fixed") {
      let accumulatorMs = 0;

      const frame = (now: number) => {
        const frameDeltaMs = Math.max(
          0,
          Math.min(now - lastTime, frameDeltaCapMs),
        );
        frameCount += 1;
        lastTime = now;
        accumulatorMs += frameDeltaMs;

        let stepsThisFrame = 0;
        while (
          accumulatorMs >= tickIntervalMs &&
          stepsThisFrame < frameStepCap
        ) {
          tick += 1;
          callbackRef.current({
            now,
            deltaMs: tickIntervalMs,
            deltaSeconds: tickIntervalMs / 1000,
            tick,
          });
          accumulatorMs -= tickIntervalMs;
          stepsThisFrame += 1;
        }

        if (stepsThisFrame === frameStepCap) {
          accumulatorMs = 0;
        }

        onFrameRef.current?.({
          now,
          deltaMs: frameDeltaMs,
          deltaSeconds: frameDeltaMs / 1000,
          frame: frameCount,
          fixedStepAlpha: Math.min(1, accumulatorMs / tickIntervalMs),
        });

        rafId = window.requestAnimationFrame(frame);
      };

      rafId = window.requestAnimationFrame(frame);

      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

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
  }, [enabled, mode, tickIntervalMs, frameDeltaCapMs, frameStepCap]);
};
