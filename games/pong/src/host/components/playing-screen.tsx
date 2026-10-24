import { useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import type { Ref } from "react";
import { FIELD_HEIGHT, FIELD_WIDTH } from "../../game/engine";
import { pongStore } from "../../game/stores";
import { MatchOverlay } from "./match-overlay";
import { ScoreStrip } from "./score-strip";

interface PlayingScreenProps {
  canvasRef: Ref<HTMLCanvasElement>;
}

export const PlayingScreen = ({ canvasRef }: PlayingScreenProps) => {
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const matchPhase = useAirJamStore(pongStore, (state) => state.matchPhase);
  const showPausedOverlay =
    matchPhase === "playing" && runtimeState !== "playing";

  return (
    // Container-driven: the host may own only part of the window. The score
    // strip takes its own row and the stage gets the rest, so the canvas and
    // the pause overlay are both sized below the score and never cover it.
    <div className="pong-app-shell @container flex h-full w-full flex-col text-white">
      <div className="pointer-events-none relative z-10 shrink-0 px-4 @3xl:px-6">
        <ScoreStrip />
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 px-4 pt-4 pb-6 @3xl:px-6 @3xl:pt-6 @3xl:pb-8">
          <div className="pong-stage-frame size-full">
            {/* A size container lets the court take the largest box with the
                field's own aspect ratio that fits both stage dimensions. */}
            <div className="@container-[size] flex size-full items-center justify-center">
              <canvas
                ref={canvasRef}
                className="block rounded-[22px] border border-white/16 bg-black"
                style={{
                  aspectRatio: `${FIELD_WIDTH} / ${FIELD_HEIGHT}`,
                  width: `min(100cqw, 100cqh * ${FIELD_WIDTH / FIELD_HEIGHT})`,
                }}
              />
            </div>
          </div>
        </div>

        {showPausedOverlay ? <MatchOverlay /> : null}
      </div>
    </div>
  );
};
