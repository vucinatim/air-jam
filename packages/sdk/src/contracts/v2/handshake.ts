import { z } from "zod";

export const AIR_JAM_PROTOCOL_V2 = "2" as const;

const semanticVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const v2ProtocolVersionSchema = z.literal(AIR_JAM_PROTOCOL_V2);

export const runtimeKindSchema = z.enum([
  "standalone-host",
  "standalone-controller",
  "arcade-runtime",
  "arcade-game-iframe",
  "arcade-controller-runtime",
  "arcade-controller-iframe",
]);

export const capabilityFlagsSchema = z.record(z.string(), z.boolean());

export const sdkVersionSchema = z
  .string()
  .regex(
    semanticVersionPattern,
    "sdkVersion must use semantic version format (for example 1.2.3)",
  );

export const v2HandshakeSchema = z
  .object({
    protocolVersion: v2ProtocolVersionSchema,
    sdkVersion: sdkVersionSchema,
    runtimeKind: runtimeKindSchema,
    capabilityFlags: capabilityFlagsSchema.default({}),
  })
  .strict();

export type RuntimeKind = z.infer<typeof runtimeKindSchema>;
export type V2Handshake = z.infer<typeof v2HandshakeSchema>;
