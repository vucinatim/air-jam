import { z } from "zod";

/** The parts of Pong's agent snapshot and host observation its tests read. */
const teamSchema = z.enum(["team1", "team2"]);
const scoresSchema = z.object({
  team1: z.number().int().nonnegative(),
  team2: z.number().int().nonnegative(),
});
const assignmentSchema = z.object({
  team: teamSchema,
  position: z.enum(["front", "back"]),
});
export const snapshotSchema = z.object({
  matchPhase: z.string(),
  scores: scoresSchema,
  myAssignment: assignmentSchema.nullable(),
  teams: z.array(
    z.object({
      id: teamSchema,
      botCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      players: z.array(
        z.object({ playerId: z.string(), position: z.string() }),
      ),
    }),
  ),
});
const simulationSchema = z.object({
  ballX: z.number(),
  ballY: z.number(),
  ballVX: z.number(),
  ballVY: z.number(),
  paddle1FrontY: z.number(),
  paddle1BackY: z.number(),
  paddle2FrontY: z.number(),
  paddle2BackY: z.number(),
  awaitingServe: z.boolean(),
});
export const runtimeSchema = z.object({
  simulation: simulationSchema,
  goals: z.array(
    z.object({
      sequence: z.number().int().positive(),
      serve: z.number().int().nonnegative(),
      ballX: z.number(),
      team: teamSchema,
      before: scoresSchema,
      after: scoresSchema,
    }),
  ),
});
/** The live simulation alone, for policies that only steer a paddle. */
export const simulationOf = (runtime: unknown) =>
  runtimeSchema.pick({ simulation: true }).parse(runtime).simulation;

export type Snapshot = z.infer<typeof snapshotSchema>;
export type PaddleAssignment = z.infer<typeof assignmentSchema>;
export type Simulation = z.infer<typeof simulationSchema>;

export function paddleTop(
  { team, position }: PaddleAssignment,
  simulation: Simulation,
) {
  if (team === "team1")
    return position === "front"
      ? simulation.paddle1FrontY
      : simulation.paddle1BackY;
  return position === "front"
    ? simulation.paddle2FrontY
    : simulation.paddle2BackY;
}
