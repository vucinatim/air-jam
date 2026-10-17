import { controllerLeasedControlAckSchema } from "@air-jam/sdk/protocol";
import { z } from "zod";

export const controllerDisconnectionSchema = z
  .object({
    release: z.union([
      controllerLeasedControlAckSchema,
      z.object({ status: z.literal("not-leased") }).strict(),
    ]),
    leave: z.discriminatedUnion("status", [
      z.object({ status: z.literal("acknowledged") }).strict(),
      z.object({ status: z.literal("not-connected") }).strict(),
      z.object({ status: z.literal("rejected"), message: z.string() }).strict(),
      z
        .object({ status: z.literal("unconfirmed"), message: z.string() })
        .strict(),
    ]),
  })
  .strict();
export type ControllerDisconnection = z.infer<
  typeof controllerDisconnectionSchema
>;
