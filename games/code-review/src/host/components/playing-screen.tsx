import type { RefObject } from "react";

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
    style={{ backgroundColor: "var(--ring-mat-color, #e5e7eb)" }}
  >
    <div className="mb-4 flex w-full items-center">
      <div className="flex w-1/3 justify-center">
        <div className="relative">
          <span
            style={{
              color: "rgb(220, 38, 38)",
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
              color: "rgb(37, 99, 235)",
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
