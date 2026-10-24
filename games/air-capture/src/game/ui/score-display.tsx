import { useSimulationSelector } from "@air-jam/sdk";
import { memo } from "react";
import { Fragment } from "react/jsx-runtime";
import { TEAM_CONFIG, TEAM_IDS } from "../domain/team";
import type { AirCaptureSim } from "../simulation/state";
import { useDebugStore } from "../stores/debug/debug-store";

const scoresOf = (sim: AirCaptureSim) => sim.ctf.scores;
const shipCountOf = (sim: AirCaptureSim) => sim.ships.size;

export const ScoreDisplay = memo(function ScoreDisplay() {
  const scores = useSimulationSelector(scoresOf);
  const shipCount = useSimulationSelector(shipCountOf);
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);

  const teams = TEAM_IDS.map((teamId) => ({
    id: teamId,
    config: TEAM_CONFIG[teamId],
    score: scores[teamId] ?? 0,
  }));

  const hasLiveMatch = shipCount >= 2 && !freeFlyMode;

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`border-border/60 flex items-center gap-4 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-md ${
          hasLiveMatch ? "bg-background/78" : "bg-background/55"
        }`}
      >
        {teams.map((team, index) => (
          <Fragment key={team.id}>
            <div
              key={team.id}
              className="flex min-w-[86px] items-center justify-center"
            >
              <div className="flex w-full flex-col items-center">
                <div
                  className={`font-black ${hasLiveMatch ? "text-3xl" : "text-2xl"}`}
                  style={{ color: team.config.color }}
                >
                  {team.score}
                </div>
                <div
                  className={`text-muted-foreground font-semibold tracking-[0.16em] uppercase ${
                    hasLiveMatch ? "text-[11px]" : "text-[10px]"
                  }`}
                >
                  {team.config.label}
                </div>
              </div>
            </div>
            {index < teams.length - 1 && (
              <div className="bg-border/70 h-12 w-px" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
});
