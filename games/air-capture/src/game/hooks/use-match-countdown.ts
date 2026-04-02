import { useEffect, useMemo, useState } from "react";

const computeRemainingSeconds = (
  countdownEndsAtMs: number | null,
  nowMs: number,
): number => {
  if (!countdownEndsAtMs) {
    return 0;
  }

  return Math.max(0, Math.ceil((countdownEndsAtMs - nowMs) / 1000));
};

export function useMatchCountdown(countdownEndsAtMs: number | null): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!countdownEndsAtMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [countdownEndsAtMs]);

  return useMemo(
    () => computeRemainingSeconds(countdownEndsAtMs, nowMs),
    [countdownEndsAtMs, nowMs],
  );
}
