import { z } from "zod";
import { TEAM_IDS, type TeamId } from "../domain/team";

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
export type CollectibleInfo = BotWorld["collectibles"][number];
