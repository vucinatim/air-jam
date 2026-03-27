import type { TeamId } from "../../shared/team";
import { getTeamColor, getTeamLabel } from "../../shared/team";
import { PRESS_FEEL_CLASS } from "../constants";

interface PlayingControlsProps {
  controlsDisabled: boolean;
  myTeam: TeamId | null;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
}

interface DirectionButtonProps {
  label: string;
  direction: -1 | 1;
  controlsDisabled: boolean;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
}

const DirectionButton = ({
  label,
  direction,
  controlsDisabled,
  onDirectionChange,
}: DirectionButtonProps) => {
  return (
    <button
      type="button"
      className={`flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg select-none hover:bg-zinc-700 active:bg-zinc-700 ${PRESS_FEEL_CLASS}`}
      disabled={controlsDisabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onDirectionChange(direction);
      }}
      onPointerUp={() => onDirectionChange(0)}
      onPointerCancel={() => onDirectionChange(0)}
      onPointerLeave={() => onDirectionChange(0)}
      onLostPointerCapture={() => onDirectionChange(0)}
    >
      {label}
    </button>
  );
};

export const PlayingControls = ({
  controlsDisabled,
  myTeam,
  onDirectionChange,
}: PlayingControlsProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Active Paddle
        </div>
        <div
          className="mt-1 text-base font-black uppercase tracking-[0.08em]"
          style={{ color: myTeam ? getTeamColor(myTeam) : "#f4f4f5" }}
        >
          {myTeam ? getTeamLabel(myTeam) : "Join A Team In Lobby"}
        </div>
      </div>
      <DirectionButton
        label="▲ UP"
        direction={-1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
      <DirectionButton
        label="▼ DOWN"
        direction={1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
    </div>
  );
};
