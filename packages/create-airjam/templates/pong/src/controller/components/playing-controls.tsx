import type { TeamId } from "../../game/domain/team";
import { getTeamColor, getTeamLabel } from "../../game/domain/team";
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
      className={`pong-controller-touch flex flex-1 touch-none items-center justify-center rounded-[32px] px-4 text-center text-4xl font-black tracking-[0.2em] text-white select-none ${PRESS_FEEL_CLASS}`}
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
  const teamColor = myTeam ? getTeamColor(myTeam) : "#f8fafc";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 pt-3"
      data-testid="pong-controller-playing-controls"
    >
      <div className="pong-panel rounded-[28px] px-5 py-4 text-center">
        <div className="pong-caption">Active Paddle</div>
        <div
          className="mt-2 text-2xl font-black uppercase tracking-[0.18em]"
          style={{ color: teamColor }}
        >
          {myTeam ? getTeamLabel(myTeam) : "Join A Team In Lobby"}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          Hold to move. Release to stop.
        </div>
      </div>
      <DirectionButton
        label="UP"
        direction={-1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
      <DirectionButton
        label="DOWN"
        direction={1}
        controlsDisabled={controlsDisabled}
        onDirectionChange={onDirectionChange}
      />
    </div>
  );
};
