import { useAirJamHost } from "@air-jam/sdk";
import type { RefObject } from "react";
import { gameInputSchema } from "../../game/contracts/input";
import { usePongStore } from "../../game/stores";
import { MatchOverlay } from "./match-overlay";
import { ScoreStrip } from "./score-strip";

interface PlayingScreenProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export const PlayingScreen = ({ canvasRef }: PlayingScreenProps) => {
  const host = useAirJamHost<typeof gameInputSchema>();
  const matchPhase = usePongStore((state) => state.matchPhase);
  const showPausedOverlay =
    matchPhase === "playing" && host.runtimeState !== "playing";

  return (
    <div className="pong-app-shell h-full w-full text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 sm:px-6">
        <ScoreStrip />
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4 pt-28 pb-6 sm:px-6 sm:pt-32 sm:pb-8">
        <div className="pong-stage-frame flex max-h-full max-w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            className="block max-h-full max-w-full rounded-[22px] border border-white/16 bg-black"
          />
        </div>
      </div>

      {showPausedOverlay ? <MatchOverlay /> : null}
    </div>
  );
};
