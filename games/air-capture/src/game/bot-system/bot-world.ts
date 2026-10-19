import { z } from "zod";
import { useAbilitiesStore } from "../abilities-store";
import { TEAM_IDS, type TeamId } from "../domain/team";
import { shipPositions, shipRotations } from "../engine/ships/runtime";
import { useCaptureTheFlagStore } from "../stores/match/capture-the-flag-store";
import { useGameStore } from "../stores/players/game-store";
import { useHealthStore } from "../stores/players/health-store";
import { useCollectiblesStore } from "../stores/world/collectibles-store";

const vectorSchema = z.tuple([z.number(), z.number(), z.number()]);
const teamIdSchema = z.enum(TEAM_IDS as [TeamId, ...TeamId[]]);

/**
 * Everything a pilot needs to know about the arena at one moment, as plain
 * data. Host bots and agent observations read the same snapshot, so a test
 * player can fly with the game's own bot logic.
 */
export const botWorldSchema = z.object({
  ships: z.array(
    z.object({
      controllerId: z.string(),
      teamId: teamIdSchema,
      position: vectorSchema,
      rotation: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        w: z.number(),
      }),
      health: z.number(),
      /** The ability this ship has picked up and not used yet. */
      queuedAbility: z.string().nullable(),
    }),
  ),
  flags: z.array(
    z.object({
      teamId: teamIdSchema,
      status: z.enum(["atBase", "carried", "dropped"]),
      position: vectorSchema,
      carrierId: z.string().optional(),
    }),
  ),
  basePositions: z.record(teamIdSchema, vectorSchema),
  collectibles: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["box", "powerup", "coin"]),
      position: vectorSchema,
      timestamp: z.number(),
      abilityId: z.string(),
    }),
  ),
});
export type BotWorld = z.infer<typeof botWorldSchema>;
export type ShipInfo = BotWorld["ships"][number];
export type FlagInfo = BotWorld["flags"][number];

/** The live arena from the host's stores. */
export function readBotWorld(): BotWorld {
  const ctf = useCaptureTheFlagStore.getState();
  const health = useHealthStore.getState();
  const abilities = useAbilitiesStore.getState();
  return {
    ships: useGameStore.getState().players.flatMap((player) => {
      const position = shipPositions.get(player.controllerId);
      const rotation = shipRotations.get(player.controllerId);
      if (!position || !rotation) return [];
      return [
        {
          controllerId: player.controllerId,
          teamId: ctf.getPlayerTeam(player.controllerId) ?? player.teamId,
          position: [position.x, position.y, position.z],
          rotation: {
            x: rotation.x,
            y: rotation.y,
            z: rotation.z,
            w: rotation.w,
          },
          health: health.getHealth(player.controllerId),
          queuedAbility:
            abilities.getQueuedAbility(player.controllerId)?.id ?? null,
        },
      ];
    }),
    flags: Object.values(ctf.flags).map((flag) => ({
      teamId: flag.teamId,
      status: flag.status,
      position: [...flag.position],
      ...(flag.carrierId ? { carrierId: flag.carrierId } : {}),
    })),
    basePositions: {
      ...ctf.basePositions,
    },
    collectibles: useCollectiblesStore.getState().collectibles,
  };
}
