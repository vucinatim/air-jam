import { z } from "zod";
import { processScopeReceiptSchema } from "./process-scope.js";

export const processGuardStartupTimeoutMs = 10000;

export const processGuardRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("open"),
      id: z.uuid(),
      token: z.uuid(),
      rootDir: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("register"),
      id: z.uuid(),
      token: z.uuid(),
      processId: z.number().int().positive(),
      root: z.boolean(),
    })
    .strict(),
  z
    .object({ kind: z.literal("close"), id: z.uuid(), token: z.uuid() })
    .strict(),
]);
export type ProcessGuardRequest = z.infer<typeof processGuardRequestSchema>;
export const processGuardResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  z.object({ kind: z.literal("startup-error"), message: z.string() }).strict(),
  z
    .object({
      kind: z.literal("result"),
      id: z.uuid(),
      receipt: processScopeReceiptSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("error"),
      id: z.uuid(),
      message: z.string(),
      scopeUnconfirmed: z.boolean(),
    })
    .strict(),
]);
export type ProcessGuardResponse = z.infer<typeof processGuardResponseSchema>;
export const processScopeAdmissionSchema = z
  .object({
    type: z.literal("airjam-process-scope/admit"),
    id: z.uuid(),
    token: z.uuid(),
    processId: z.number().int().positive(),
  })
  .strict();
export const processScopeAdmittedSchema = z
  .object({
    type: z.literal("airjam-process-scope/admitted"),
    id: z.uuid(),
    error: z.string().optional(),
  })
  .strict();
