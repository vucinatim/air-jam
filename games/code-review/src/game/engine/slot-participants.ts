import type { TeamAssignment } from "../domain/team-assignments";
import type { BotCounts } from "../stores/code-review-store-types";
import { FIGHTER_SLOTS } from "./constants";
import type { PlayerKey, SlotParticipant } from "./types";

const slotKeyOf = ({ team, position }: TeamAssignment): PlayerKey =>
  `${team === "team1" ? "player1" : "player2"}${position === "front" ? "Front" : "Back"}`;

/** Who fights in each ring slot: assigned players first, then bots. */
export const resolveSlotParticipants = (
  players: readonly { id: string; label: string }[],
  teamAssignments: Record<string, TeamAssignment>,
  botCounts: BotCounts,
): SlotParticipant[] => {
  const humanBySlot = new Map<PlayerKey, { id: string; label: string }>();
  for (const player of players) {
    const assignment = teamAssignments[player.id];
    if (assignment) humanBySlot.set(slotKeyOf(assignment), player);
  }
  const remainingBots = { ...botCounts };
  const participants: SlotParticipant[] = [];
  for (const slot of FIGHTER_SLOTS) {
    const human = humanBySlot.get(slot.slotKey);
    if (human) {
      participants.push({
        id: human.id,
        label: human.label,
        slotKey: slot.slotKey,
        team: slot.team,
        position: slot.position,
        isBot: false,
      });
    } else if (remainingBots[slot.team] > 0) {
      remainingBots[slot.team] -= 1;
      participants.push({
        id: slot.botId,
        label: slot.botLabel,
        slotKey: slot.slotKey,
        team: slot.team,
        position: slot.position,
        isBot: true,
      });
    }
  }
  return participants;
};
