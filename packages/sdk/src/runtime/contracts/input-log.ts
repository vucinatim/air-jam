import { z } from "zod";
import { airJamInputLogSchema } from "../../core/input-log";
import { hostObservationIdentitySchema } from "./runtime-identity";

/** Serialized entry bytes one page aims for, so it fits the editor socket. */
export const INPUT_LOG_PAGE_BYTES = 512 * 1024;

export const inputLogCutSchema = z
  .object({
    ticks: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
  })
  .strict();

/** One stable prefix of the match, paged through the host-agent channel. */
export const hostInputLogPageSchema = z
  .object({
    identity: hostObservationIdentitySchema,
    header: airJamInputLogSchema.omit({ entries: true }),
    entryCount: z.number().int().nonnegative(),
    full: z.boolean(),
    entries: airJamInputLogSchema.shape.entries,
    nextEntry: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type HostInputLogPage = z.infer<typeof hostInputLogPageSchema>;

export const inputLogNotReplayableReasonSchema = z.enum([
  "no-simulation",
  "loading",
  "runtime-replaced",
  "host-unavailable",
]);
export type InputLogNotReplayableReason = z.infer<
  typeof inputLogNotReplayableReasonSchema
>;
