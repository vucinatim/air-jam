import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { ControllerShell, useAirJamController } from "@air-jam/sdk";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const ControllerView = (): JSX.Element => {
  const { roomId, connectionStatus, sendInput } = useAirJamController();
  const [vector, setVector] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [actionPressed, setActionPressed] = useState(false);

  useEffect(() => {
    if (connectionStatus !== "connected") {
      return undefined;
    }
    const pushInput = (): void => {
      sendInput({
        vector,
        action: actionPressed,
        timestamp: Date.now(),
      });
    };
    pushInput();
    const interval = window.setInterval(pushInput, 50);
    return () => window.clearInterval(interval);
  }, [actionPressed, connectionStatus, sendInput, vector]);

  const setDirection = (x: number, y: number): void => {
    setVector({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
  };

  const resetDirection = (): void => {
    setVector({ x: 0, y: 0 });
  };

  return (
    <ControllerShell
      roomId={roomId}
      connectionStatus={connectionStatus}
      requiredOrientation="landscape"
    >
      <div className="flex h-full w-full items-center justify-center gap-3 p-2 sm:gap-6">
        <div className="relative flex h-full max-h-[min(60vw,60vh)] w-full max-w-[min(60vw,60vh)] items-center justify-center">
          <div className="absolute inset-0 rounded-xl border border-slate-800 bg-slate-900/60 shadow-inner sm:rounded-2xl" />
          <div className="relative grid h-full w-full grid-cols-3 grid-rows-3 gap-1.5 p-1.5 sm:gap-2 sm:p-2">
            <button
              type="button"
              className="col-start-2 row-start-1 rounded-lg bg-slate-800/80 text-base font-semibold text-slate-100 shadow-md active:scale-95 sm:rounded-xl sm:text-lg"
              onPointerDown={() => setDirection(0, 1)}
              onPointerUp={resetDirection}
              onPointerLeave={resetDirection}
            >
              ↑
            </button>
            <button
              type="button"
              className="col-start-1 row-start-2 rounded-lg bg-slate-800/80 text-base font-semibold text-slate-100 shadow-md active:scale-95 sm:rounded-xl sm:text-lg"
              onPointerDown={() => setDirection(-1, 0)}
              onPointerUp={resetDirection}
              onPointerLeave={resetDirection}
            >
              ←
            </button>
            <div className="col-start-2 row-start-2 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800/60 shadow-inner sm:h-12 sm:w-12" />
            </div>
            <button
              type="button"
              className="col-start-3 row-start-2 rounded-lg bg-slate-800/80 text-base font-semibold text-slate-100 shadow-md active:scale-95 sm:rounded-xl sm:text-lg"
              onPointerDown={() => setDirection(1, 0)}
              onPointerUp={resetDirection}
              onPointerLeave={resetDirection}
            >
              →
            </button>
            <button
              type="button"
              className="col-start-2 row-start-3 rounded-lg bg-slate-800/80 text-base font-semibold text-slate-100 shadow-md active:scale-95 sm:rounded-xl sm:text-lg"
              onPointerDown={() => setDirection(0, -1)}
              onPointerUp={resetDirection}
              onPointerLeave={resetDirection}
            >
              ↓
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center">
          <button
            type="button"
            className="aspect-square h-[min(25vw,25vh,120px)] rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-base font-bold text-slate-950 shadow-[0_15px_30px_rgba(6,182,212,0.35)] active:scale-95 sm:h-[min(30vw,30vh,128px)] sm:rounded-3xl sm:text-xl"
            onPointerDown={() => setActionPressed(true)}
            onPointerUp={() => setActionPressed(false)}
            onPointerLeave={() => setActionPressed(false)}
          >
            Boost
          </button>
        </div>
      </div>
    </ControllerShell>
  );
};
