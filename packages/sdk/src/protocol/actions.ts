import { z } from "zod";

/**
 * A store action invoked over a room is a request on the store's channel,
 * named for the action, whose answer is one of these results.
 */
export type AirJamActionActorRole = "controller" | "host";

export interface AirJamActionActor {
  id: string;
  role: AirJamActionActorRole;
}

export type AirJamActionPayload = Record<string, unknown>;

export const airJamActionPayloadSchema = z.record(z.string(), z.unknown());

export const airJamActionAcceptedSchema = z.object({
  ok: z.literal(true),
  status: z.literal("accepted"),
  source: z.enum(["client", "host"]),
  result: z.unknown().optional(),
});
export const airJamActionRejectedSchema = z.object({
  ok: z.literal(false),
  status: z.literal("rejected"),
  source: z.enum(["client", "server", "host"]),
  reason: z.string(),
  message: z.string(),
  details: airJamActionPayloadSchema.optional(),
});
/** The connection dropped before the host answered: it may or may not have run the action. */
export const airJamActionUnconfirmedSchema = z.object({
  ok: z.literal(false),
  status: z.literal("unconfirmed"),
  source: z.literal("client"),
});
export const airJamActionInvocationResultSchema = z.discriminatedUnion(
  "status",
  [
    airJamActionAcceptedSchema,
    airJamActionRejectedSchema,
    airJamActionUnconfirmedSchema,
  ],
);
export type AirJamActionAccepted<TResult = unknown> = Omit<
  z.infer<typeof airJamActionAcceptedSchema>,
  "result"
> & { result?: TResult };
export type AirJamActionRejected = z.infer<typeof airJamActionRejectedSchema>;
export type AirJamActionUnconfirmed = z.infer<
  typeof airJamActionUnconfirmedSchema
>;

export type AirJamActionInvocationResult<TResult = unknown> =
  | AirJamActionAccepted<TResult>
  | AirJamActionRejected
  | AirJamActionUnconfirmed;
