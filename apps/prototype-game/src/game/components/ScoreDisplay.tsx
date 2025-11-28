import { memo } from "react";
import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "../capture-the-flag-store";
import { useGameStore } from "../game-store";
import { useDebugStore } from "../debug-store";
import { Fragment } from "react/jsx-runtime";

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
      className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
        isCentered ? "top-1/2 -translate-y-1/2" : "top-4"
      }`}
    >
      <div className="flex items-center gap-4 px-4 py-2 bg-background/20 backdrop-blur-sm border border-border rounded-lg shadow-lg">
        {teams.map((team, index) => (
          <Fragment key={team.id}>
            <div key={team.id} className="flex items-center w-20">
              {/* Team Score */}
              <div className="flex flex-col items-center w-full">
                <div
                  className="text-xl font-bold"
                  style={{ color: team.config.color }}
                >
                  {team.score}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {team.config.label}
                </div>
              </div>
            </div>
            {index < teams.length - 1 && (
              <div className="h-10 w-px bg-border" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
});
