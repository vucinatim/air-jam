import { db } from "@/db";
import { gameReleaseReportDecisions, gameReleaseReports } from "@/db/schema";
import { releaseReportStatusSchema } from "@/lib/releases/release-contract";
import { PlatformApplicationError } from "@/server/application-error";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

const text = z.string().trim().min(1).max(200);
export const reportListInputSchema = z
  .object({
    status: releaseReportStatusSchema.optional(),
    releaseId: text.optional(),
    beforeId: text.optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
export const reportDecisionInputSchema = z
  .object({
    reportId: text,
    expectedRevision: z.number().int().min(0).max(2_147_483_646),
    status: releaseReportStatusSchema,
    actor: text,
    reason: z.string().trim().min(1).max(2000),
    idempotencyKey: text,
  })
  .strict();
export type ReportDecisionInput = z.infer<typeof reportDecisionInputSchema>;

const notFound = () =>
  new PlatformApplicationError({
    code: "not_found",
    message: "Report not found.",
  });
const conflict = (message: string) =>
  new PlatformApplicationError({ code: "conflict", message });

// Trusted operator IO boundary, like the other repo database operators. Web
// adapters must check their operations actor before calling these functions.
export const listReleaseReportsForOperator = async ({
  database = db,
  input,
}: {
  database?: typeof db;
  input: z.input<typeof reportListInputSchema>;
}) => {
  const query = reportListInputSchema.parse(input);
  const rows = await database
    .select({
      id: gameReleaseReports.id,
      releaseId: gameReleaseReports.releaseId,
      status: gameReleaseReports.status,
      source: gameReleaseReports.source,
      createdAt: gameReleaseReports.createdAt,
      reviewedAt: gameReleaseReports.reviewedAt,
      reviewRevision: gameReleaseReports.reviewRevision,
    })
    .from(gameReleaseReports)
    .where(
      and(
        query.status ? eq(gameReleaseReports.status, query.status) : undefined,
        query.releaseId
          ? eq(gameReleaseReports.releaseId, query.releaseId)
          : undefined,
        query.beforeId ? lt(gameReleaseReports.id, query.beforeId) : undefined,
      ),
    )
    .orderBy(desc(gameReleaseReports.id))
    .limit(query.limit + 1);
  const reports = rows.slice(0, query.limit);
  return {
    reports,
    nextBeforeId: rows.length > query.limit ? reports.at(-1)!.id : null,
  };
};

export const inspectReleaseReportForOperator = async ({
  database = db,
  reportId,
  beforeRevision,
}: {
  database?: typeof db;
  reportId: string;
  beforeRevision?: number;
}) => {
  const id = text.parse(reportId);
  const before = z.number().int().positive().optional().parse(beforeRevision);
  return database.transaction(
    async (tx) => {
      const report = await tx.query.gameReleaseReports.findFirst({
        where: eq(gameReleaseReports.id, id),
      });
      if (!report) throw notFound();
      const rows = await tx
        .select()
        .from(gameReleaseReportDecisions)
        .where(
          and(
            eq(gameReleaseReportDecisions.reportId, id),
            before === undefined
              ? undefined
              : lt(gameReleaseReportDecisions.revision, before),
          ),
        )
        .orderBy(desc(gameReleaseReportDecisions.revision))
        .limit(101);
      const decisions = rows.slice(0, 100);
      return {
        report,
        decisions,
        nextBeforeRevision:
          rows.length > 100 ? decisions.at(-1)!.revision : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
};

export const decideReleaseReportForOperator = async ({
  database = db,
  input,
  apply = false,
}: {
  database?: typeof db;
  input: ReportDecisionInput;
  apply?: boolean;
}) => {
  const request = reportDecisionInputSchema.parse(input);
  return database.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(gameReleaseReports)
      .where(eq(gameReleaseReports.id, request.reportId))
      .for("update");
    if (!report) throw notFound();
    const [previous] = await tx
      .select()
      .from(gameReleaseReportDecisions)
      .where(
        and(
          eq(gameReleaseReportDecisions.reportId, request.reportId),
          eq(gameReleaseReportDecisions.idempotencyKey, request.idempotencyKey),
        ),
      );
    if (previous) {
      if (
        previous.actor !== request.actor ||
        previous.reason !== request.reason ||
        previous.status !== request.status ||
        previous.revision !== request.expectedRevision + 1
      ) {
        throw conflict(
          "This report decision key already belongs to a different command.",
        );
      }
      return { applied: false, replayed: true, decision: previous };
    }
    if (report.reviewRevision !== request.expectedRevision) {
      throw conflict(
        "Report changed since inspection. Inspect it again before deciding.",
      );
    }
    const decision = {
      reportId: report.id,
      revision: report.reviewRevision + 1,
      status: request.status,
      actor: request.actor,
      reason: request.reason,
      idempotencyKey: request.idempotencyKey,
    };
    if (!apply) return { applied: false, replayed: false, decision };
    const [stored] = await tx
      .insert(gameReleaseReportDecisions)
      .values({ id: crypto.randomUUID(), ...decision })
      .returning();
    if (!stored) throw new Error("Report decision could not be recorded.");
    await tx
      .update(gameReleaseReports)
      .set({
        status: stored.status,
        reviewRevision: stored.revision,
        reviewedAt: stored.status === "open" ? null : stored.createdAt,
      })
      .where(eq(gameReleaseReports.id, report.id));
    return { applied: true, replayed: false, decision: stored };
  });
};
