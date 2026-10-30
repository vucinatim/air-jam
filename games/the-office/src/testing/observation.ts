import { z } from "zod";

/** The parts of The Office's agent snapshot and host observation its tests read. */
export const snapshotSchema = z.object({
  phase: z.string(),
  lobby: z.object({
    availablePlayers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        selectedByControllerId: z.string().nullable(),
        stats: z
          .object({
            energy: z.number(),
            boredom: z.number(),
            alive: z.boolean(),
          })
          .nullable(),
      }),
    ),
  }),
  mySelection: z.object({ playerId: z.string(), name: z.string() }).nullable(),
  scoreboard: z.object({
    totalMoney: z.number(),
    totalMoneyPenalty: z.number(),
    finalTotalMoney: z.number(),
  }),
});
export const runtimeSchema = z.object({
  taskDurationMs: z.number(),
  timeLeftMs: z.number().nonnegative(),
  coworkers: z.array(
    z.object({
      playerId: z.string(),
      x: z.number(),
      y: z.number(),
      doingTask: z.boolean(),
      holdingAction: z.boolean(),
      onBreakAt: z.string().nullable(),
    }),
  ),
  tasks: z.array(
    z.object({
      taskId: z.string(),
      name: z.string(),
      reward: z.number(),
      locationId: z.string(),
      expiresInMs: z.number().nonnegative(),
    }),
  ),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
export type Runtime = z.infer<typeof runtimeSchema>;

/** This seat's coworker, its stats and position while a shift is on. */
export function selfOf(
  controllerId: string | null,
  snapshot: Snapshot,
  runtime: Runtime,
) {
  if (!controllerId || !snapshot.mySelection) return null;
  const position = runtime.coworkers.find(
    (coworker) => coworker.playerId === controllerId,
  );
  const stats = snapshot.lobby.availablePlayers.find(
    (player) => player.selectedByControllerId === controllerId,
  )?.stats;
  if (!position || !stats) return null;
  return {
    ...position,
    ...stats,
    coworkerId: snapshot.mySelection.playerId,
    name: snapshot.mySelection.name,
  };
}
export type Self = NonNullable<ReturnType<typeof selfOf>>;
