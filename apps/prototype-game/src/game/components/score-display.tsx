import { memo } from "react";
import { Fragment } from "react/jsx-runtime";
import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "../capture-the-flag-store";
import { useDebugStore } from "../debug-store";
import { useGameStore } from "../game-store";

export const ScoreDisplay = memo(function ScoreDisplay() {
  const scores = useCaptureTheFlagStore((state) => state.scores);
  const players = useGameStore((state) => state.players);
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);

  const teams = (Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => ({
    id: teamId,
    config: TEAM_CONFIG[teamId],
    score: scores[teamId] ?? 0,
  }));

  // In free fly mode, always position at top
  // Otherwise, center vertically when 2+ players, top when 1 or 0 players
  const isCentered = !freeFlyMode && players.length >= 2;

  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 ${
        isCentered ? "top-1/2 -translate-y-1/2" : "top-4"
      }`}
    >
      <div className="bg-background/20 border-border flex items-center gap-4 rounded-lg border px-4 py-2 shadow-lg backdrop-blur-sm">
        {teams.map((team, index) => (
          <Fragment key={team.id}>
            <div key={team.id} className="flex w-20 items-center">
              {/* Team Score */}
              <div className="flex w-full flex-col items-center">
                <div
                  className="text-xl font-bold"
                  style={{ color: team.config.color }}
                >
                  {team.score}
                </div>
                <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  {team.config.label}
                </div>
              </div>
            </div>
            {index < teams.length - 1 && (
              <div className="bg-border h-10 w-px" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
});
