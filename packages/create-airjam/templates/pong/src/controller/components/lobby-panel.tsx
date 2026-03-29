import type { TeamId } from "../../game/domain/team";
import { MAX_TEAM_SLOTS, type BotCounts, type TeamCounts } from "../../game/domain/team-slots";
import { getTeamColor } from "../../game/domain/team";
import { TeamName } from "../../game/ui";
import { POINTS_TO_WIN_OPTIONS, PRESS_FEEL_CLASS } from "../constants";

interface LobbyPanelProps {
  myTeam: TeamId | null;
  teamCounts: TeamCounts;
  botCounts: BotCounts;
  pointsToWin: number;
  canStartMatch: boolean;
  controlsDisabled: boolean;
  readinessText: string;
  onJoinTeam: (team: TeamId) => void;
  onSetBotCount: (team: TeamId, count: number) => void;
  onSetPointsToWin: (pointsToWin: number) => void;
  onStartMatch: () => void;
}

const TeamJoinButton = ({
  team,
  myTeam,
  isFull,
  disabled,
  onJoin,
}: {
  team: TeamId;
  myTeam: TeamId | null;
  isFull: boolean;
  disabled: boolean;
  onJoin: (team: TeamId) => void;
}) => {
  const selected = myTeam === team;

  return (
    <button
      type="button"
      className={`flex min-h-24 touch-none flex-1 items-center justify-center rounded-[24px] px-4 py-5 text-center text-2xl font-black tracking-[0.14em] text-white select-none ${PRESS_FEEL_CLASS} ${
        selected
          ? "ring-4 ring-white/70 ring-offset-2 ring-offset-transparent"
          : "opacity-88"
      }`}
      style={{
        background: selected
          ? `linear-gradient(180deg, ${getTeamColor(team)}, color-mix(in srgb, ${getTeamColor(team)} 70%, black))`
          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(12,18,33,0.92)",
        border: `1px solid ${selected ? `${getTeamColor(team)}aa` : "rgba(255,255,255,0.12)"}`,
        boxShadow: selected
          ? `0 20px 40px color-mix(in srgb, ${getTeamColor(team)} 25%, transparent)`
          : undefined,
      }}
      disabled={disabled}
      onPointerDown={() => {
        if (!disabled) {
          onJoin(team);
        }
      }}
    >
      {isFull && !selected ? (
        <TeamName team={team} suffix="Full" className="" />
      ) : (
        <TeamName team={team} className="" />
      )}
    </button>
  );
};

export const LobbyPanel = ({
  myTeam,
  teamCounts,
  botCounts,
  pointsToWin,
  canStartMatch,
  controlsDisabled,
  readinessText,
  onJoinTeam,
  onSetBotCount,
  onSetPointsToWin,
  onStartMatch,
}: LobbyPanelProps) => {
  const team1IsFull = teamCounts.team1 + botCounts.team1 >= MAX_TEAM_SLOTS;
  const team2IsFull = teamCounts.team2 + botCounts.team2 >= MAX_TEAM_SLOTS;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="pong-scroll-hidden flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pb-3 pt-3">
        <div className="pong-panel rounded-[24px] px-4 py-3 text-center">
          <div className="pong-caption">Lobby Setup</div>
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            <span>
              Bots {botCounts.team1}:{botCounts.team2}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">{readinessText}</span>
          </div>
        </div>

        <div className="grid gap-3">
          <TeamJoinButton
            team="team1"
            myTeam={myTeam}
            isFull={team1IsFull}
            disabled={team1IsFull || controlsDisabled}
            onJoin={onJoinTeam}
          />
          <TeamJoinButton
            team="team2"
            myTeam={myTeam}
            isFull={team2IsFull}
            disabled={team2IsFull || controlsDisabled}
            onJoin={onJoinTeam}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["team1", "team2"] as const).map((team) => {
            const botCount = botCounts[team];
            const humanCount = teamCounts[team];
            const maxBots = Math.max(0, MAX_TEAM_SLOTS - humanCount);

            return (
              <div key={team} className="pong-panel rounded-[24px] px-4 py-4 text-center">
                <div className="pong-caption">
                  <TeamName team={team} />
                </div>
                <div className="mt-2 text-2xl font-black text-white">{botCount}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {humanCount} human • {maxBots} free bot slot{maxBots === 1 ? "" : "s"}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((value) => {
                    const disabled = controlsDisabled || value > maxBots;
                    const selected = botCount === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-2xl border px-2 py-3 text-sm font-black ${
                          selected
                            ? "border-white/50 bg-white/14 text-white"
                            : "border-white/10 bg-white/6 text-zinc-300 hover:bg-white/10"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                        disabled={disabled}
                        onClick={() => onSetBotCount(team, value)}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pong-panel rounded-[24px] px-4 py-4">
          <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Points to Win
          </div>
          <div className="grid grid-cols-4 gap-2">
            {POINTS_TO_WIN_OPTIONS.map((value) => {
              const selected = pointsToWin === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`rounded-2xl border px-2 py-3 text-sm font-black ${
                    selected
                      ? "border-white/50 bg-white/14 text-white"
                      : "border-white/10 bg-white/6 text-zinc-300 hover:bg-white/10"
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
      </div>

      <div className="px-3 pb-3 pt-2">
        <button
          type="button"
          className={`w-full rounded-[22px] border border-white/16 bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-black shadow-[0_18px_40px_rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
          disabled={!canStartMatch || controlsDisabled}
          onClick={onStartMatch}
        >
          Start Match
        </button>
      </div>
    </div>
  );
};
