import { z } from "zod";

/** The parts of Code Review's agent snapshot and host observation its tests read. */
const teamSchema = z.enum(["team1", "team2"]);
const scoresSchema = z.object({
  team1: z.number().int().nonnegative(),
  team2: z.number().int().nonnegative(),
});
export const snapshotSchema = z.object({
  matchPhase: z.string(),
  scores: scoresSchema,
  myAssignment: z
    .object({ team: teamSchema, position: z.enum(["front", "back"]) })
    .nullable(),
  teams: z.array(
    z.object({
      id: teamSchema,
      label: z.string(),
      totalCount: z.number().int().nonnegative(),
    }),
  ),
});
const fighterSchema = z.object({
  playerId: z.string(),
  team: teamSchema,
  isBot: z.boolean(),
  x: z.number(),
  y: z.number(),
  punching: z.boolean(),
  defending: z.boolean(),
  stunned: z.boolean(),
  empowered: z.boolean(),
});
export const runtimeSchema = z.object({
  ring: z.object({
    minX: z.number(),
    maxX: z.number(),
    minY: z.number(),
    maxY: z.number(),
  }),
  punchReach: z.number().positive(),
  hp: z.object({ team1: z.number(), team2: z.number() }),
  knockout: z.object({ active: z.boolean(), winner: teamSchema.nullable() }),
  fighters: z.array(fighterSchema),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type Runtime = z.infer<typeof runtimeSchema>;
export type Fighter = z.infer<typeof fighterSchema>;

/**
 * The seat's own fighter and the nearest opposing one, while a round is on;
 * null in the lobby, between rounds or before the seat has a fighter.
 */
export function fightOf(controllerId: string | null, runtime: Runtime) {
  if (runtime.knockout.active) return null;
  const me = runtime.fighters.find(
    (fighter) => fighter.playerId === controllerId,
  );
  if (!me) return null;
  const opponents = runtime.fighters
    .filter((fighter) => fighter.team !== me.team)
    .map((fighter) => ({
      fighter,
      dx: fighter.x - me.x,
      dy: fighter.y - me.y,
      distance: Math.hypot(fighter.x - me.x, fighter.y - me.y),
    }))
    .sort((left, right) => left.distance - right.distance);
  const nearest = opponents[0];
  return nearest ? { me, opponent: nearest } : null;
}
export type Fight = NonNullable<ReturnType<typeof fightOf>>;

/** A movement input towards (+1) or away from (-1) the nearest opponent. */
export function moveRelative({ opponent }: Fight, sign: 1 | -1) {
  const distance = Math.max(opponent.distance, 1);
  return {
    horizontal: (sign * opponent.dx) / distance,
    vertical: (sign * opponent.dy) / distance,
  };
}
