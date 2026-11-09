import { z } from "zod";
import { airJamSettingsValuesSchema } from "../../core/settings";
import { hostObservationIdentitySchema } from "./runtime-identity";

const facts = {
  id: z.string().min(1),
  tick: z.number().int().nonnegative(),
  /** Epoch milliseconds, unlike the simulation's game clock. */
  at: z.number().nonnegative(),
};
export const hostTimelineEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...facts,
    kind: z.enum(["join", "drop", "leave", "name"]),
    controllerId: z.string(),
    name: z.string().optional(),
    previousName: z.string().optional(),
  }),
  z.object({
    ...facts,
    kind: z.literal("state"),
    state: z.enum(["paused", "playing"]),
  }),
  z.object({
    ...facts,
    kind: z.literal("settings"),
    values: airJamSettingsValuesSchema,
    previousValues: airJamSettingsValuesSchema,
  }),
  z.object({
    ...facts,
    kind: z.literal("moment"),
    text: z.string().min(1).max(240),
  }),
]);
export const hostTimelinePaceSchema = z.object({
  /** End of the five-second sampling window, in epoch milliseconds. */
  at: z.number().nonnegative(),
  fps: z.number().nonnegative(),
  speed: z.number().nonnegative(),
});
export const hostTimelineSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    identity: hostObservationIdentitySchema,
    startedAt: z.number().nonnegative(),
    stepMs: z.number().positive(),
    entries: z.array(hostTimelineEntrySchema),
    pace: z.array(hostTimelinePaceSchema).max(360),
  }),
  z.object({
    status: z.literal("unavailable"),
    identity: hostObservationIdentitySchema,
    reason: z.enum(["no-simulation", "simulation-loading"]),
  }),
]);
export type HostTimeline = z.infer<typeof hostTimelineSchema>;
export type HostTimelineEntry = z.infer<typeof hostTimelineEntrySchema>;
export type HostTimelinePace = z.infer<typeof hostTimelinePaceSchema>;
