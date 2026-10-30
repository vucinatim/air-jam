import type { RefObject } from "react";
import { codeReviewTheme } from "../../game/theme";

interface PlayingScreenProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hpDisplay: {
    team1: number;
    team2: number;
  };
}

export const PlayingScreen = ({ canvasRef, hpDisplay }: PlayingScreenProps) => (
  <div
    className="relative flex h-full w-full flex-col items-center justify-center p-4"
    style={{ backgroundColor: "var(--ring-mat-color)" }}
  >
    <div className="mb-4 flex w-full items-center">
      <div className="flex w-1/3 justify-center">
        <div className="relative">
          <span
            style={{
              color: codeReviewTheme.colors.team1ControllerAccent,
              whiteSpace: "nowrap",
            }}
            className="pixel-font text-7xl leading-none"
          >
            {hpDisplay.team1}
          </span>
        </div>
      </div>

      <div className="flex w-1/3 justify-center">
        <canvas ref={canvasRef} className="block" />
      </div>

      <div className="flex w-1/3 justify-center">
        <div className="relative">
          <span
            style={{
              color: codeReviewTheme.colors.team2ControllerAccent,
              whiteSpace: "nowrap",
            }}
            className="pixel-font text-7xl leading-none"
          >
            {hpDisplay.team2}
          </span>
        </div>
      </div>
    </div>
  </div>
);
