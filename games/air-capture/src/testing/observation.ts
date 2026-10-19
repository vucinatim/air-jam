import { z } from "zod";
import { botWorldSchema } from "../game/bot-system/bot-world";
import { TEAM_IDS, type TeamId } from "../game/domain/team";

/** The parts of Air Capture's agent snapshot and host observation its tests read. */
const teamIdSchema = z.enum(TEAM_IDS as [TeamId, ...TeamId[]]);
export const snapshotSchema = z.object({
  matchPhase: z.string(),
  myAssignment: z.object({ teamId: teamIdSchema }).nullable(),
  teams: z.array(
    z.object({ id: teamIdSchema, label: z.string(), totalCount: z.number() }),
  ),
});
/** The host surface: the arena as the game's own bots see it, plus scores. */
export const runtimeSchema = botWorldSchema.extend({
  scores: z.record(teamIdSchema, z.number()),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Runtime = z.infer<typeof runtimeSchema>;
