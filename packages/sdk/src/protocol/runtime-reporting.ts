import { z } from "zod";
import { roomCodeSchema } from "./core";

export const AIRJAM_RUNTIME_ERROR_REPORT_CONTRACT_VERSION = 1 as const;

export const runtimeErrorReportSchema = z
  .object({
    contractVersion: z.literal(AIRJAM_RUNTIME_ERROR_REPORT_CONTRACT_VERSION),
    reportId: z.string().uuid(),
    roomId: roomCodeSchema,
    role: z.enum(["host", "controller"]),
    code: z.literal("AJ_RUNTIME_RENDER_CRASH"),
    errorName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
    digest: z.string().regex(/^[a-f0-9]{8}$/u),
    occurredAt: z.string().datetime(),
  })
  .strict();

export type RuntimeErrorReport = z.infer<typeof runtimeErrorReportSchema>;

export type RuntimeErrorReportAck =
  | { ok: true; reportId: string }
  | {
      ok: false;
      reportId?: string;
      code: "invalid_payload" | "unauthorized" | "rate_limited" | "unavailable";
    };
