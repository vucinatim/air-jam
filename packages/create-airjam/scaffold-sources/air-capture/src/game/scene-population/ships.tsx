import { TEAM_IDS, type TeamId } from "../domain/team";
import { useCaptureTheFlagStore } from "../stores/match/capture-the-flag-store";
import { useGameStore } from "../stores/players/game-store";
import { Ship } from "../components/entities/ship";

export function Ships() {
  const players = useGameStore((state) => state.players);
  const roundId = useGameStore((state) => state.roundId);
  const playerTeams = useCaptureTheFlagStore((state) => state.playerTeams);
  const basePositions = useCaptureTheFlagStore((state) => state.basePositions);

  const teamSpawnCounters: Record<TeamId, number> = TEAM_IDS.reduce(
    (acc, key) => {
      acc[key] = 0;
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
            key={`${roundId}:${player.controllerId}`}
            controllerId={player.controllerId}
            position={position}
          />
        );
      })}
    </>
  );
}
