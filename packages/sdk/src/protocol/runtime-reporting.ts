import { z } from "zod";
import { roomCodeSchema, seatIdSchema } from "../room-protocol";

export const AIRJAM_RUNTIME_ERROR_REPORT_CONTRACT_VERSION = 2 as const;

/**
 * A page's report that its runtime crashed while rendering. It names the
 * room and, through the room's instance, the runtime session it belongs to;
 * a phone's report names its seat. It carries a digest of the error, never
 * the message or stack.
 */
export const runtimeErrorReportSchema = z
  .object({
    contractVersion: z.literal(AIRJAM_RUNTIME_ERROR_REPORT_CONTRACT_VERSION),
    reportId: z.uuid(),
    roomId: roomCodeSchema,
    instance: z.string().min(1).max(64),
    role: z.enum(["host", "controller"]),
    seat: seatIdSchema.optional(),
    code: z.literal("AJ_RUNTIME_RENDER_CRASH"),
    errorName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u),
    digest: z.string().regex(/^[a-f0-9]{8}$/u),
    occurredAt: z.iso.datetime(),
  })
  .strict();

export type RuntimeErrorReport = z.infer<typeof runtimeErrorReportSchema>;

/**
 * Where a page's runtime error reports go. The SDK writes them to the
 * development log unless the app passes its own, as a hosted platform does
 * to keep them with its operational records.
 */
export type RuntimeErrorReporter = (report: RuntimeErrorReport) => void;

/**
 * How long to wait before sending a report again after its platform answered
 * 404: a room's facts reach the platform moments after the room welcomes its
 * pages, so a crash just after joining can arrive first.
 */
const RUNTIME_ERROR_REPORT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

/**
 * A reporter that posts each report to a platform route, fire and forget:
 * the page is already showing its crash. A 404 means the platform has not
 * recorded the room yet, so the same report goes again a few times; the
 * platform keeps a report once, by its id.
 */
export const createRuntimeErrorReporter = ({
  endpoint,
  credentials,
}: {
  endpoint: string;
  credentials: RequestCredentials;
}): RuntimeErrorReporter => {
  return (report) => {
    const body = JSON.stringify(report);
    const send = async (retries: readonly number[]): Promise<void> => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        credentials,
        keepalive: true,
      }).catch(() => null);
      const [delay, ...later] = retries;
      if (response?.status !== 404 || delay === undefined) return;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await send(later);
    };
    void send(RUNTIME_ERROR_REPORT_RETRY_DELAYS_MS);
  };
};
