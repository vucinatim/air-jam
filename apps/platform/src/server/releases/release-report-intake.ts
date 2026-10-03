import { db } from "@/db";
import {
  gameReleaseGenerations,
  gameReleaseReports,
  gameReleases,
  games,
} from "@/db/schema";
import {
  publicReleaseReportInputSchema,
  RELEASE_REPORT_INTAKE_POLICY,
  type PublicReleaseReportInput,
} from "@/lib/releases/release-report-policy";
import { PlatformApplicationError } from "@/server/application-error";
import { resolveDatabaseAuthorityNow } from "@/server/operations/database-authority";
import { and, count, eq, gte, sql } from "drizzle-orm";

type DatabaseReader = Pick<typeof db, "select">;
const intakeStatus = async (database: DatabaseReader, now: Date) => {
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const dayStart = new Date(
    Math.floor(now.getTime() / 86_400_000) * 86_400_000,
  );
  const [usage] = await database
    .select({
      day: count(),
      minute:
        sql<number>`count(*) filter (where ${gte(gameReleaseReports.createdAt, minuteStart)})`.mapWith(
          Number,
        ),
    })
    .from(gameReleaseReports)
    .where(gte(gameReleaseReports.createdAt, dayStart));
  const windows = [
    {
      name: "minute",
      used: usage?.minute ?? 0,
      limit: RELEASE_REPORT_INTAKE_POLICY.minuteLimit,
      resetsAt: new Date(minuteStart.getTime() + 60_000),
    },
    {
      name: "utc_day",
      used: usage?.day ?? 0,
      limit: RELEASE_REPORT_INTAKE_POLICY.utcDayLimit,
      resetsAt: new Date(dayStart.getTime() + 86_400_000),
    },
  ].map((window) => ({
    ...window,
    remaining: Math.max(0, window.limit - window.used),
  }));
  return {
    observedAt: now,
    windows,
    retryAfterSeconds: Math.max(
      0,
      ...windows
        .filter((window) => window.remaining === 0)
        .map((window) =>
          Math.ceil((window.resetsAt.getTime() - now.getTime()) / 1000),
        ),
    ),
  };
};

export const getReleaseReportIntakeStatus = ({
  database = db,
}: { database?: typeof db } = {}) =>
  database.transaction(
    async (tx) => intakeStatus(tx, await resolveDatabaseAuthorityNow(tx)),
    { accessMode: "read only" },
  );

const receipt = (submissionId: string) => ({
  submissionId,
  received: true as const,
});

export const submitPublicReleaseReport = async ({
  database = db,
  input,
}: {
  database?: typeof db;
  input: PublicReleaseReportInput;
}) => {
  const request = publicReleaseReportInputSchema.parse(input);
  const content = {
    releaseId: request.releaseId,
    source: request.source,
    reason: request.reason,
    details: request.details || null,
    reporterEmail: request.reporterEmail || null,
  };
  return database.transaction(async (tx) => {
    // One low-volume anonymous inbox: a single transaction lock keeps shared
    // budgets and private-key retries authoritative across app instances.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('airjam:release-report-intake'))`,
    );
    const [existing] = await tx
      .select()
      .from(gameReleaseReports)
      .where(eq(gameReleaseReports.submissionId, request.submissionId));
    if (existing) {
      if (
        Object.entries(content).some(
          ([key, value]) => existing[key as keyof typeof content] !== value,
        )
      ) {
        throw new PlatformApplicationError({
          code: "conflict",
          message: "This submission ID already belongs to another report.",
        });
      }
      // Replay acknowledges original intake, not private operator decisions.
      return receipt(request.submissionId);
    }
    const [target] = await tx
      .select({ id: gameReleases.id })
      .from(gameReleases)
      .innerJoin(games, eq(games.id, gameReleases.gameId))
      .innerJoin(
        gameReleaseGenerations,
        and(
          eq(gameReleaseGenerations.id, gameReleases.promotedGenerationId),
          eq(gameReleaseGenerations.releaseId, gameReleases.id),
        ),
      )
      .where(
        and(
          eq(gameReleases.id, request.releaseId),
          eq(gameReleases.status, "live"),
          eq(games.arcadeVisibility, "listed"),
          eq(gameReleaseGenerations.status, "ready"),
        ),
      );
    if (!target)
      throw new PlatformApplicationError({
        code: "not_found",
        message: "This hosted release is no longer publicly available.",
      });
    const now = await resolveDatabaseAuthorityNow(tx);
    const status = await intakeStatus(tx, now);
    if (status.retryAfterSeconds > 0)
      throw new PlatformApplicationError({
        code: "rate_limited",
        retryAfterSeconds: status.retryAfterSeconds,
        message: `Report intake is busy. Your draft has not been submitted; please retry in ${status.retryAfterSeconds} seconds.`,
      });
    await tx.insert(gameReleaseReports).values({
      id: crypto.randomUUID(),
      submissionId: request.submissionId,
      ...content,
      status: "open",
      createdAt: now,
    });
    return receipt(request.submissionId);
  });
};
