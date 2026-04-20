import type { useAirJamHost } from "@air-jam/sdk";
import { useEffect, useMemo } from "react";
import { gameInputSchema } from "../../game/contracts/input";
import { FIGHTER_SLOTS } from "../../game/engine/constants";
import type { PlayerKey, SlotParticipant } from "../../game/engine/types";
import { useGameStore } from "../../game/stores";

type CodeReviewHost = ReturnType<typeof useAirJamHost<typeof gameInputSchema>>;

export const useCodeReviewHostTeams = (host: CodeReviewHost) => {
  const teamAssignments = useGameStore((state) => state.teamAssignments);
  const botCounts = useGameStore((state) => state.botCounts);
  const matchPhase = useGameStore((state) => state.matchPhase);
  const actions = useGameStore.useActions();

  const connectedPlayerIds = useMemo(
    () => host.players.map((player) => player.id),
    [host.players],
  );
  const assignedHumanPlayers = useMemo(
    () => host.players.filter((player) => teamAssignments[player.id]),
    [host.players, teamAssignments],
  );
  const humanBySlotKey = useMemo(() => {
    const bySlot = new Map<PlayerKey, { id: string; label: string }>();

    assignedHumanPlayers.forEach((player) => {
      const assignment = teamAssignments[player.id];
      if (!assignment) {
        return;
      }

      const slotKey =
        `${assignment.team === "team1" ? "player1" : "player2"}${assignment.position === "front" ? "Front" : "Back"}` as PlayerKey;
      bySlot.set(slotKey, { id: player.id, label: player.label });
    });

    return bySlot;
  }, [assignedHumanPlayers, teamAssignments]);
  const slotParticipants = useMemo<SlotParticipant[]>(() => {
    const remainingBots = { ...botCounts };
    const participants: SlotParticipant[] = [];

    FIGHTER_SLOTS.forEach((slot) => {
      const human = humanBySlotKey.get(slot.slotKey);
      if (human) {
        participants.push({
          id: human.id,
          label: human.label,
          slotKey: slot.slotKey,
          team: slot.team,
          position: slot.position,
          isBot: false,
        });
        return;
      }

      if (remainingBots[slot.team] <= 0) {
        return;
      }

      remainingBots[slot.team] -= 1;
      participants.push({
        id: slot.botId,
        label: slot.botLabel,
        slotKey: slot.slotKey,
        team: slot.team,
        position: slot.position,
        isBot: true,
      });
    });

    return participants;
  }, [botCounts, humanBySlotKey]);
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
      host.connectionStatus === "connected" &&
      team1Occupancy > 0 &&
      team2Occupancy > 0 &&
      assignedHumanPlayers.length > 0,
    [
      assignedHumanPlayers.length,
      host.connectionStatus,
      matchPhase,
      team1Occupancy,
      team2Occupancy,
    ],
  );

  useEffect(() => {
    actions.syncConnectedPlayers({ connectedPlayerIds });
  }, [actions, connectedPlayerIds]);

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
