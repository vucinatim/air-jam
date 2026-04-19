import {
  ControllerPlayerNameField,
  ControllerPrimaryAction,
} from "@air-jam/sdk/ui";
import type { TeamId } from "../../game/domain/team";
import { getTeamColor } from "../../game/domain/team";
import { buildTeamSlots, MAX_TEAM_SLOTS } from "../../game/domain/team-slots";
import { usePongStore } from "../../game/stores";
import { TeamName } from "../../game/ui";
import { TeamSlotTile } from "../../game/ui/team-slot-tile";
import { POINTS_TO_WIN_OPTIONS, PRESS_FEEL_CLASS } from "../constants";
import { useControllerConnectionNotice } from "../use-controller-connection-notice";
import { usePongControllerTeams } from "../use-pong-controller-teams";

export const LobbyPanel = () => {
  const actions = usePongStore.useActions();
  const {
    myTeam,
    teamCounts,
    botCounts,
    team1Players,
    team2Players,
    pointsToWin,
    readiness,
    readinessText,
  } = usePongControllerTeams();
  const { controlsDisabled } = useControllerConnectionNotice();

  const setBotCount = (team: TeamId, count: number) =>
    actions.setBotCount({ team, count });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="pong-controller-lobby-panel"
    >
      <ControllerPlayerNameField
        className="px-3 pt-1 pb-2"
        labelClassName="text-[0.625rem] font-semibold tracking-[0.18em] text-zinc-400 uppercase"
        inputClassName="w-full rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-white/30 focus:ring-1 focus:ring-white/20"
      />

      <div className="pong-scroll-hidden flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 pt-3 pb-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["team1", "team2"] as const).map((team) => {
            const botCount = botCounts[team];
            const humanCount = teamCounts[team];
            const teamPlayers = team === "team1" ? team1Players : team2Players;
            const slots = buildTeamSlots(teamPlayers, botCount);
            const teamIsFull = humanCount + botCount >= MAX_TEAM_SLOTS;
            const joined = myTeam === team;

            return (
              <div
                key={team}
                className="pong-panel rounded-2xl px-4 py-3 text-center"
                data-testid={`pong-controller-team-card-${team}`}
              >
                <TeamName team={team} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid={`pong-controller-join-team-${team}`}
                    className={`rounded-xl border px-3 py-3 text-[0.6875rem] font-black tracking-[0.16em] text-white uppercase ${PRESS_FEEL_CLASS}`}
                    style={{
                      background: joined
                        ? `linear-gradient(180deg, ${getTeamColor(team)}, color-mix(in srgb, ${getTeamColor(team)} 70%, black))`
                        : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(12,18,33,0.92)",
                      borderColor: joined
                        ? `${getTeamColor(team)}aa`
                        : "rgba(255,255,255,0.12)",
                      boxShadow: joined
                        ? `0 16px 28px color-mix(in srgb, ${getTeamColor(team)} 22%, transparent)`
                        : undefined,
                    }}
                    disabled={controlsDisabled || (teamIsFull && !joined)}
                    onClick={() => actions.joinTeam({ team })}
                  >
                    {joined ? "Joined" : teamIsFull ? "Full" : "Join Team"}
                  </button>
                  <button
                    type="button"
                    data-testid={`pong-controller-add-bot-${team}`}
                    className={`rounded-xl border px-3 py-3 text-[0.6875rem] font-black tracking-[0.16em] uppercase ${
                      teamIsFull
                        ? "border-white/10 bg-white/4 text-zinc-500"
                        : "border-cyan-400/40 bg-cyan-400/12 text-cyan-100"
                    }`}
                    disabled={controlsDisabled || teamIsFull}
                    onClick={() => setBotCount(team, botCount + 1)}
                  >
                    Add Bot
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {slots.map((slot, index) => {
                    const canRemoveBot =
                      slot.kind === "bot" && !controlsDisabled;
                    return (
                      <TeamSlotTile
                        key={`${team}-slot-${index}`}
                        slot={slot}
                        surface="controller"
                        testId={`pong-controller-team-slot-${team}-${index}`}
                        disabled={!canRemoveBot}
                        onBotAction={() => {
                          if (canRemoveBot) {
                            setBotCount(team, Math.max(0, botCount - 1));
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pong-panel rounded-2xl px-4 py-3">
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
                  onClick={() => actions.setPointsToWin({ pointsToWin: value })}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <ControllerPrimaryAction
          testId="pong-controller-start-match"
          label="Play Match"
          helper={readinessText}
          disabled={!readiness.canStart}
          onPress={() => actions.startMatch()}
          className="pb-1"
          buttonClassName="bg-white text-black hover:bg-white/95"
        />
      </div>
    </div>
  );
};
