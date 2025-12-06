import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "../capture-the-flag-store";
import { useGameStore } from "../game-store";
import { Ship } from "./Ship";

export function Ships() {
  const players = useGameStore((state) => state.players);
  const playerTeams = useCaptureTheFlagStore((state) => state.playerTeams);
  const basePositions = useCaptureTheFlagStore((state) => state.basePositions);

  const teamSpawnCounters: Record<TeamId, number> = Object.keys(
    TEAM_CONFIG,
  ).reduce(
    (acc, key) => {
      acc[key as TeamId] = 0;
      return acc;
    },
    {} as Record<TeamId, number>,
  );

  return (
    <>
      {players.map((player) => {
        const teamId = playerTeams[player.controllerId] ?? player.teamId;
        const basePos = basePositions[teamId] ?? basePositions.solaris;
        const spawnIndex = teamSpawnCounters[teamId]++;
        const radius = 8;
        const angle = (spawnIndex / 4) * Math.PI * 2;
        const position: [number, number, number] = [
          basePos[0] + Math.cos(angle) * radius,
          5,
          basePos[2] + Math.sin(angle) * radius,
        ];

        return (
          <Ship
            key={player.controllerId}
            controllerId={player.controllerId}
            position={position}
          />
        );
      })}
    </>
  );
}
