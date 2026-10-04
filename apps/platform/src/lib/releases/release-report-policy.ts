import { z } from "zod";
import { releaseReportSourceSchema } from "./release-contract";

export const RELEASE_REPORT_INTAKE_POLICY = Object.freeze({
  requestsPerProcessMinute: 240,
  minuteLimit: 120,
  utcDayLimit: 1000,
});

export const publicReleaseReportInputSchema = z
  .object({
    submissionId: z.uuid(),
    releaseId: z.string().trim().min(1).max(200),
    source: releaseReportSourceSchema,
    reason: z.string().trim().min(3).max(120),
    details: z.string().trim().max(2000).optional(),
    reporterEmail: z.string().trim().email().max(320).optional(),
  })
  .strict();

export type PublicReleaseReportInput = z.infer<
  typeof publicReleaseReportInputSchema
>;
