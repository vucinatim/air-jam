import { useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import { useMemo } from "react";
import { resolveSlotParticipants } from "../../game/engine/slot-participants";
import type { PlayerKey, SlotParticipant } from "../../game/engine/types";
import { gameStore } from "../../game/stores";

export const useCodeReviewHostTeams = () => {
  const players = useAirJamHost((state) => state.players);
  const connectionStatus = useAirJamHost((state) => state.connectionStatus);
  const teamAssignments = useAirJamStore(
    gameStore,
    (state) => state.teamAssignments,
  );
  const botCounts = useAirJamStore(gameStore, (state) => state.botCounts);
  const matchPhase = useAirJamStore(gameStore, (state) => state.matchPhase);
  const assignedHumanPlayers = useMemo(
    () => players.filter((player) => teamAssignments[player.id]),
    [players, teamAssignments],
  );
  const slotParticipants = useMemo<SlotParticipant[]>(
    () => resolveSlotParticipants(players, teamAssignments, botCounts),
    [botCounts, players, teamAssignments],
  );
  const participantBySlot = useMemo(
    () =>
      Object.fromEntries(
        slotParticipants.map((participant) => [
          participant.slotKey,
          participant,
        ]),
      ) as Partial<Record<PlayerKey, SlotParticipant>>,
    [slotParticipants],
  );
  const botCount = useMemo(
    () => slotParticipants.filter((participant) => participant.isBot).length,
    [slotParticipants],
  );
  const team1BotCount = useMemo(
    () =>
      slotParticipants.filter(
        (participant) => participant.isBot && participant.team === "team1",
      ).length,
    [slotParticipants],
  );
  const team2BotCount = useMemo(
    () =>
      slotParticipants.filter(
        (participant) => participant.isBot && participant.team === "team2",
      ).length,
    [slotParticipants],
  );
  const team1Occupancy = useMemo(
    () =>
      slotParticipants.filter((participant) => participant.team === "team1")
        .length,
    [slotParticipants],
  );
  const team2Occupancy = useMemo(
    () =>
      slotParticipants.filter((participant) => participant.team === "team2")
        .length,
    [slotParticipants],
  );
  const canStartMatch = useMemo(
    () =>
      matchPhase === "lobby" &&
      connectionStatus === "connected" &&
      team1Occupancy > 0 &&
      team2Occupancy > 0 &&
      assignedHumanPlayers.length > 0,
    [
      assignedHumanPlayers.length,
      connectionStatus,
      matchPhase,
      team1Occupancy,
      team2Occupancy,
    ],
  );

  return {
    assignedHumanPlayers,
    botCount,
    canStartMatch,
    participantBySlot,
    slotParticipants,
    team1BotCount,
    team2BotCount,
  };
};

export type CodeReviewHostTeams = ReturnType<typeof useCodeReviewHostTeams>;
