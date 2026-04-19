import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { ControllerPrimaryAction } from "@air-jam/sdk/ui";
import {
  buildTeamSlots,
  MAX_TEAM_SLOTS,
  type TeamId,
} from "../../game/domain/team-slots";
import { MATCH_POINTS_TO_WIN } from "../../game/match-config";
import { TeamSlotTile } from "../../game/ui/team-slot-tile";
import { PRESS_FEEL_CLASS } from "../constants";

const TEAM1_COLOR = "#dc2626";
const TEAM2_COLOR = "#2563eb";

const TEAM_LABEL: Record<TeamId, string> = {
  team1: "Coder",
  team2: "Reviewer",
};

const TEAM_COLOR: Record<TeamId, string> = {
  team1: TEAM1_COLOR,
  team2: TEAM2_COLOR,
};

type TeamCounts = { team1: number; team2: number };

interface LobbyPanelProps {
  myTeam: TeamId | null;
  teamCounts: TeamCounts;
  botCounts: TeamCounts;
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  controlsDisabled: boolean;
  canStartMatch: boolean;
  readinessText: string;
  onJoinTeam: (team: TeamId) => void;
  onSetBotCount: (team: TeamId, count: number) => void;
  onStartMatch: () => void;
}

const capturePanelClass =
  "rounded-none border-4 border-zinc-600 bg-zinc-900/85 shadow-[6px_6px_0_rgba(0,0,0,0.55)]";

export const LobbyPanel = ({
  myTeam,
  teamCounts,
  botCounts,
  team1Players,
  team2Players,
  controlsDisabled,
  canStartMatch,
  readinessText,
  onJoinTeam,
  onSetBotCount,
  onStartMatch,
}: LobbyPanelProps) => {
  return (
    <div
      className="pixel-font flex min-h-0 flex-1 flex-col"
      data-testid="code-review-controller-lobby-panel"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 pt-3 pb-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["team1", "team2"] as const).map((team) => {
            const botCount = botCounts[team];
            const humanCount = teamCounts[team];
            const teamPlayers = team === "team1" ? team1Players : team2Players;
            const slots = buildTeamSlots(teamPlayers, botCount);
            const teamIsFull = humanCount + botCount >= MAX_TEAM_SLOTS;
            const joined = myTeam === team;
            const teamColor = TEAM_COLOR[team];

            return (
              <div
                key={team}
                className={`${capturePanelClass} px-3 py-3 text-center`}
                data-testid={`code-review-controller-team-card-${team}`}
              >
                <div
                  className="text-[10px] font-black tracking-[0.18em] uppercase"
                  style={{ color: teamColor }}
                >
                  {TEAM_LABEL[team]}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid={`code-review-controller-join-team-${team}`}
                    className={`rounded-none border-4 px-2 py-3 text-[9px] font-black tracking-[0.14em] text-white uppercase ${PRESS_FEEL_CLASS}`}
                    style={{
                      background: joined
                        ? `linear-gradient(180deg, ${teamColor}, color-mix(in srgb, ${teamColor} 72%, black))`
                        : "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04)), #18181b",
                      borderColor: joined ? teamColor : "rgb(82 82 91)",
                      boxShadow: joined
                        ? `4px 4px 0 color-mix(in srgb, ${teamColor} 35%, transparent)`
                        : undefined,
                    }}
                    disabled={controlsDisabled || (teamIsFull && !joined)}
                    onClick={() => onJoinTeam(team)}
                  >
                    {joined ? "Joined" : teamIsFull ? "Full" : "Join Team"}
                  </button>
                  <button
                    type="button"
                    data-testid={`code-review-controller-add-bot-${team}`}
                    className={`rounded-none border-4 px-2 py-3 text-[9px] font-black tracking-[0.14em] uppercase ${
                      teamIsFull
                        ? "border-zinc-700 bg-zinc-950 text-zinc-600"
                        : "border-cyan-500/55 bg-zinc-950 text-cyan-100"
                    }`}
                    disabled={controlsDisabled || teamIsFull}
                    onClick={() => onSetBotCount(team, botCount + 1)}
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
                        testId={`code-review-controller-team-slot-${team}-${index}`}
                        disabled={!canRemoveBot}
                        onBotAction={() => {
                          if (canRemoveBot) {
                            onSetBotCount(team, Math.max(0, botCount - 1));
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

        <div className={`${capturePanelClass} px-3 py-3`}>
          <div className="grid grid-cols-4 gap-2">
            {([3, 5, 7, 11] as const).map((value) => {
              const selected = value === MATCH_POINTS_TO_WIN;
              return (
                <div
                  key={value}
                  className={`rounded-none border-4 py-3 text-center text-sm font-black ${
                    selected
                      ? "border-zinc-300 bg-zinc-700 text-white"
                      : "border-zinc-800 bg-zinc-950 text-zinc-600"
                  }`}
                >
                  {value}
                </div>
              );
            })}
          </div>
        </div>

        <ControllerPrimaryAction
          label="Play Match"
          helper={readinessText}
          disabled={!canStartMatch}
          onPress={onStartMatch}
          className="pb-1"
          icon={<PlayIcon />}
          buttonClassName="rounded-none border-4 border-zinc-400 bg-white text-black hover:bg-zinc-100 disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
        />
      </div>
    </div>
  );
};

function PlayIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />
    </svg>
  );
}
