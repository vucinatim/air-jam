import { useEffect, useState } from "react";

export const useNowTick = (intervalMs: number): number => {
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return nowMs;
};
