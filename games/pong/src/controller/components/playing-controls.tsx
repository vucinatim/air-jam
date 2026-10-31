import { AxisButton } from "@air-jam/sdk/ui";
import { pongInput } from "../../game/contracts/input";
import { getTeamColor, getTeamLabel } from "../../game/domain/team";
import { pongTheme } from "../../game/theme";
import { useControllerConnectionNotice } from "../hooks/use-controller-connection-notice";
import { usePongControllerTeams } from "../hooks/use-pong-controller-teams";
import { PRESS_FEEL_CLASS } from "./classes";

const DIRECTION_BUTTON_CLASS = `pong-controller-touch flex flex-1 items-center justify-center rounded-[32px] px-4 text-center text-4xl font-black tracking-[0.2em] text-white ${PRESS_FEEL_CLASS}`;

export const PlayingControls = () => {
  const { controlsDisabled } = useControllerConnectionNotice();
  const { myTeam } = usePongControllerTeams();
  const teamColor = myTeam ? getTeamColor(myTeam) : pongTheme.colors.text;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-4"
      data-testid="pong-controller-playing-controls"
    >
      <div className="pong-panel rounded-[28px] px-5 py-4 text-center">
        <div className="pong-caption">Active Paddle</div>
        <div
          className="mt-2 text-2xl font-black tracking-[0.18em] uppercase"
          style={{ color: teamColor }}
        >
          {myTeam ? getTeamLabel(myTeam) : "Join A Team In Lobby"}
        </div>
        <div className="mt-2 text-[11px] tracking-[0.16em] text-zinc-500 uppercase">
          Hold to move. Release to stop.
        </div>
      </div>
      <AxisButton
        control={pongInput.direction}
        value={-1}
        disabled={controlsDisabled}
        className={DIRECTION_BUTTON_CLASS}
      >
        UP
      </AxisButton>
      <AxisButton
        control={pongInput.direction}
        value={1}
        disabled={controlsDisabled}
        className={DIRECTION_BUTTON_CLASS}
      >
        DOWN
      </AxisButton>
    </div>
  );
};
