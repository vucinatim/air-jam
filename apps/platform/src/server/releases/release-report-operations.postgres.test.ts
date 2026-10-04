import * as schema from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  decideReleaseReportForOperator,
  inspectReleaseReportForOperator,
  listReleaseReportsForOperator,
  type ReportDecisionInput,
} from "./release-report-operations";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("release report decisions PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!, { max: 4 });
  const database = drizzle(client, { schema });
  const prefix = `report-operations-test:${crypto.randomUUID()}`;
  const userId = `${prefix}:creator`;
  const gameId = `${prefix}:game`;
  const releaseId = `${prefix}:release`;
  const reportId = `${prefix}:report`;
  const input: ReportDecisionInput = {
    reportId,
    expectedRevision: 0,
    status: "reviewed",
    actor: `${prefix}:operator`,
    reason: "Reviewed the private evidence",
    idempotencyKey: "review-1",
  };
  const report = () =>
    database.query.gameReleaseReports.findFirst({
      where: eq(schema.gameReleaseReports.id, reportId),
    });
  const decisions = () =>
    database
      .select()
      .from(schema.gameReleaseReportDecisions)
      .where(eq(schema.gameReleaseReportDecisions.reportId, reportId));
  const decide = (patch: Partial<ReportDecisionInput> = {}, apply = true) =>
    decideReleaseReportForOperator({
      database,
      input: { ...input, ...patch },
      apply,
    });

  beforeAll(async () => {
    await database.insert(schema.users).values({
      id: userId,
      name: "Report review test",
      email: `${userId}@example.invalid`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await database.insert(schema.games).values({
      id: gameId,
      userId,
      name: "Unchanged game",
      arcadeVisibility: "hidden",
    });
    await database.insert(schema.gameReleases).values({
      id: releaseId,
      gameId,
      sourceKind: "upload",
      status: "archived",
    });
  });

  beforeEach(async () => {
    await database
      .delete(schema.gameReleaseReports)
      .where(eq(schema.gameReleaseReports.releaseId, releaseId));
    await database.insert(schema.gameReleaseReports).values({
      id: reportId,
      releaseId,
      status: "open",
      source: "arcade",
      reason: "Private reporter reason",
      details: "Private identifying details",
      reporterEmail: "reporter@example.invalid",
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    try {
      await database
        .delete(schema.gameReleases)
        .where(eq(schema.gameReleases.id, releaseId));
      await database.delete(schema.games).where(eq(schema.games.id, gameId));
      await database.delete(schema.users).where(eq(schema.users.id, userId));
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it("previews the next revision without writing report or decision evidence", async () => {
    const before = await report();
    const preview = await decideReleaseReportForOperator({ database, input });
    expect(preview).toMatchObject({
      applied: false,
      replayed: false,
      decision: { reportId, revision: 1, status: "reviewed" },
    });
    expect(await report()).toEqual(before);
    expect(await decisions()).toEqual([]);
  });

  it("commits decision and report revision together without changing game or release state", async () => {
    const beforeGame = await database.query.games.findFirst({
      where: eq(schema.games.id, gameId),
    });
    const beforeRelease = await database.query.gameReleases.findFirst({
      where: eq(schema.gameReleases.id, releaseId),
    });
    const result = await decide();
    expect(result).toMatchObject({
      applied: true,
      replayed: false,
      decision: {
        revision: 1,
        actor: input.actor,
        reason: input.reason,
        status: "reviewed",
      },
    });
    const [stored] = await decisions();
    expect(stored).toEqual(result.decision);
    expect(await report()).toMatchObject({
      status: "reviewed",
      reviewRevision: 1,
      reviewedAt: stored?.createdAt,
    });
    expect(
      await database.query.games.findFirst({
        where: eq(schema.games.id, gameId),
      }),
    ).toEqual(beforeGame);
    expect(
      await database.query.gameReleases.findFirst({
        where: eq(schema.gameReleases.id, releaseId),
      }),
    ).toEqual(beforeRelease);
  });

  it("rolls back an inserted decision when the report update fails in PostgreSQL", async () => {
    const before = await report();
    const transaction = database.transaction.bind(database);
    vi.spyOn(database, "transaction").mockImplementation((operation, config) =>
      transaction(async (tx) => {
        // Only replace the update's SQL: the decision INSERT and enclosing
        // service transaction run unchanged, and PostgreSQL aborts that transaction.
        vi.spyOn(tx, "update").mockReturnValue({
          set: () => ({ where: () => tx.execute(sql`select 1 / 0`) }),
        } as unknown as ReturnType<typeof tx.update>);
        return operation(tx);
      }, config),
    );
    await expect(decide()).rejects.toMatchObject({ cause: { code: "22012" } });
    expect(await decisions()).toEqual([]);
    expect(await report()).toEqual(before);
  });

  it("rejects stale revisions without adding evidence", async () => {
    await decide();
    const before = await report();
    await expect(
      decide({ idempotencyKey: "stale-command", status: "dismissed" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await decisions()).toHaveLength(1);
    expect(await report()).toEqual(before);
  });

  it("serializes concurrent identical commands into one exact replay", async () => {
    const results = await Promise.all([decide(), decide()]);
    expect(results.map((result) => result.replayed).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0]?.decision).toEqual(results[1]?.decision);
    expect(await decisions()).toHaveLength(1);
    expect(await report()).toMatchObject({ reviewRevision: 1 });
  });

  it("conflicts concurrent different decisions at the same inspected revision", async () => {
    const results = await Promise.allSettled([
      decide(),
      decide({ idempotencyKey: "other-command", status: "dismissed" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { code: "conflict" } });
    expect(await decisions()).toHaveLength(1);
    expect(await report()).toMatchObject({ reviewRevision: 1 });
  });

  it.each([
    { actor: "another-operator" },
    { reason: "Different evidence" },
    { status: "dismissed" as const },
    { expectedRevision: 1 },
  ])(
    "rejects reuse of a decision key with changed content %j",
    async (patch) => {
      await decide();
      await expect(decide(patch)).rejects.toMatchObject({ code: "conflict" });
      expect(await decisions()).toHaveLength(1);
    },
  );

  it("allows reopening and replays an earlier receipt without undoing later decisions", async () => {
    const reviewed = await decide();
    const reopened = await decide({
      expectedRevision: 1,
      status: "open",
      reason: "New evidence requires review",
      idempotencyKey: "reopen-2",
    });
    expect(reopened).toMatchObject({
      applied: true,
      decision: { revision: 2, status: "open" },
    });
    expect(await report()).toMatchObject({
      reviewRevision: 2,
      status: "open",
      reviewedAt: null,
    });
    for (const apply of [false, true]) {
      expect(await decide({}, apply)).toEqual({
        applied: false,
        replayed: true,
        decision: reviewed.decision,
      });
    }
    expect(await decisions()).toHaveLength(2);
    expect(await report()).toMatchObject({
      reviewRevision: 2,
      status: "open",
      reviewedAt: null,
    });
  });

  it("lists bounded summary pages without private text and keeps private evidence in explicit inspection", async () => {
    const extraIds = [`${prefix}:report-a`, `${prefix}:report-z`];
    await database.insert(schema.gameReleaseReports).values(
      extraIds.map((id) => ({
        id,
        releaseId,
        status: "open" as const,
        source: "play_page" as const,
        reason: "Private text",
        reporterEmail: "private@example.invalid",
      })),
    );
    const first = await listReleaseReportsForOperator({
      database,
      input: { releaseId, status: "open", limit: 2 },
    });
    expect(first.reports.map((row) => row.id)).toEqual(
      [...extraIds].sort().reverse(),
    );
    expect(first.nextBeforeId).toBe(extraIds[0]);
    expect(Object.keys(first.reports[0]!).sort()).toEqual(
      [
        "id",
        "releaseId",
        "status",
        "source",
        "createdAt",
        "reviewedAt",
        "reviewRevision",
      ].sort(),
    );
    const last = await listReleaseReportsForOperator({
      database,
      input: { releaseId, beforeId: first.nextBeforeId!, limit: 2 },
    });
    expect(last.reports.map((row) => row.id)).toEqual([reportId]);
    expect(last.nextBeforeId).toBeNull();
    await decide();
    const inspection = await inspectReleaseReportForOperator({
      database,
      reportId,
    });
    expect(inspection.report).toMatchObject({
      reason: "Private reporter reason",
      details: "Private identifying details",
      reporterEmail: "reporter@example.invalid",
    });
    expect(inspection.decisions).toHaveLength(1);
    expect(inspection.decisions[0]).toMatchObject({
      actor: input.actor,
      reason: input.reason,
    });
    expect(
      (
        await listReleaseReportsForOperator({
          database,
          input: { releaseId, status: "reviewed" },
        })
      ).reports.map((row) => row.id),
    ).toEqual([reportId]);
  });

  it("pages the complete private decision history with a bounded newest-first cursor", async () => {
    await database.transaction(async (tx) => {
      await tx.insert(schema.gameReleaseReportDecisions).values(
        Array.from({ length: 101 }, (_, index) => ({
          id: `${prefix}:decision-${index + 1}`,
          reportId,
          revision: index + 1,
          status: "reviewed" as const,
          actor: input.actor,
          reason: `Private review ${index + 1}`,
          idempotencyKey: `historical-${index + 1}`,
        })),
      );
      await tx
        .update(schema.gameReleaseReports)
        .set({
          reviewRevision: 101,
          status: "reviewed",
          reviewedAt: new Date(),
        })
        .where(eq(schema.gameReleaseReports.id, reportId));
    });
    const first = await inspectReleaseReportForOperator({ database, reportId });
    expect(first.report.reviewRevision).toBe(101);
    expect(first.decisions.map((row) => row.revision)).toEqual(
      Array.from({ length: 100 }, (_, index) => 101 - index),
    );
    expect(first.nextBeforeRevision).toBe(2);
    const last = await inspectReleaseReportForOperator({
      database,
      reportId,
      beforeRevision: first.nextBeforeRevision!,
    });
    expect(last.decisions.map((row) => row.revision)).toEqual([1]);
    expect(last.nextBeforeRevision).toBeNull();
  });

  it("reports missing IDs without writes", async () => {
    await expect(
      inspectReleaseReportForOperator({
        database,
        reportId: `${prefix}:missing`,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      decide({ reportId: `${prefix}:missing` }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await decisions()).toEqual([]);
  });
});
