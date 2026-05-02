import type { PlayerProfile } from "@air-jam/sdk/protocol";

export type TeamId = "team1" | "team2";

export type TeamSlotVisual =
  | { kind: "human"; player: PlayerProfile }
  | { kind: "bot" }
  | { kind: "open" };

export const MAX_TEAM_SLOTS = 2;

export const clampBotCount = (value: number): number =>
  Math.max(0, Math.min(MAX_TEAM_SLOTS, Math.round(value)));

export const buildTeamSlots = (
  players: PlayerProfile[],
  botCount: number,
): TeamSlotVisual[] => {
  const slots: TeamSlotVisual[] = [];
  const normalizedBotCount = clampBotCount(botCount);

  for (let index = 0; index < MAX_TEAM_SLOTS; index += 1) {
    const player = players[index];

    if (player) {
      slots.push({ kind: "human", player });
      continue;
    }

    if (index < players.length + normalizedBotCount) {
      slots.push({ kind: "bot" });
      continue;
    }

    slots.push({ kind: "open" });
  }

  return slots;
};
