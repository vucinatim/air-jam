import type { TeamId } from "../../shared/team";
import { getTeamColor, getTeamLabel } from "../../shared/team";
import { POINTS_TO_WIN_OPTIONS, PRESS_FEEL_CLASS } from "../constants";

interface LobbyPanelProps {
  myTeam: TeamId | null;
  botTeam: TeamId | null;
  pointsToWin: number;
  canStartMatch: boolean;
  controlsDisabled: boolean;
  readinessText: string;
  onJoinTeam: (team: TeamId) => void;
  onToggleBotEnabled: (enabled: boolean) => void;
  onSetPointsToWin: (pointsToWin: number) => void;
  onStartMatch: () => void;
}

const TeamJoinButton = ({
  team,
  myTeam,
  isBot,
  disabled,
  onJoin,
}: {
  team: TeamId;
  myTeam: TeamId | null;
  isBot: boolean;
  disabled: boolean;
  onJoin: (team: TeamId) => void;
}) => {
  const selected = myTeam === team;
  const label = getTeamLabel(team).toUpperCase();

  return (
    <button
      type="button"
      className={`flex-1 touch-none rounded-xl text-4xl font-bold text-white shadow-lg select-none hover:opacity-90 ${PRESS_FEEL_CLASS} ${
        selected
          ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
          : isBot
            ? "cursor-not-allowed opacity-40"
            : "opacity-70"
      }`}
      style={{
        backgroundColor: selected ? getTeamColor(team) : "#3f3f46",
      }}
      disabled={disabled}
      onPointerDown={() => {
        if (!disabled) {
          onJoin(team);
        }
      }}
    >
      {isBot ? `${label} BOT` : label}
    </button>
  );
};

export const LobbyPanel = ({
  myTeam,
  botTeam,
  pointsToWin,
  canStartMatch,
  controlsDisabled,
  readinessText,
  onJoinTeam,
  onToggleBotEnabled,
  onSetPointsToWin,
  onStartMatch,
}: LobbyPanelProps) => {
  const botEnabled = botTeam !== null;
  const team1IsBot = botTeam === "team1";
  const team2IsBot = botTeam === "team2";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3 text-center">
        <div className="text-sm font-semibold uppercase tracking-wide text-white">
          Choose Team
        </div>
        <div className="mt-1 text-[11px] uppercase text-zinc-400">
          {botEnabled
            ? team1IsBot
              ? "Bot controls Solaris"
              : "Bot controls Nebulon"
            : "Bot optional. Human controls whichever team you join."}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {readinessText}
        </div>
      </div>

      <TeamJoinButton
        team="team1"
        myTeam={myTeam}
        isBot={team1IsBot}
        disabled={team1IsBot || controlsDisabled}
        onJoin={onJoinTeam}
      />
      <TeamJoinButton
        team="team2"
        myTeam={myTeam}
        isBot={team2IsBot}
        disabled={team2IsBot || controlsDisabled}
        onJoin={onJoinTeam}
      />

      <button
        type="button"
        className={`rounded-lg border px-4 py-3 text-sm font-semibold uppercase tracking-wide ${
          botEnabled
            ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-200"
            : "border-white/20 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
        } disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={controlsDisabled}
        onClick={() => onToggleBotEnabled(!botEnabled)}
      >
        {botEnabled
          ? team1IsBot
            ? "Bot On Solaris (Tap To Disable)"
            : "Bot On Nebulon (Tap To Disable)"
          : "Enable Bot Opponent"}
      </button>

      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
        <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Points to Win
        </div>
        <div className="grid grid-cols-4 gap-2">
          {POINTS_TO_WIN_OPTIONS.map((value) => {
            const selected = pointsToWin === value;
            return (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-2 py-2 text-sm font-bold ${
                  selected
                    ? "border-white/70 bg-white/15 text-white"
                    : "border-white/20 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={controlsDisabled}
                onClick={() => onSetPointsToWin(value)}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className={`rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
        disabled={!canStartMatch || controlsDisabled}
        onClick={onStartMatch}
      >
        Start Match
      </button>
    </div>
  );
};
