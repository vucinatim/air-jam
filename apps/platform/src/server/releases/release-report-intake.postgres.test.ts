import * as schema from "@/db/schema";
import {
  RELEASE_REPORT_INTAKE_POLICY,
  type PublicReleaseReportInput,
} from "@/lib/releases/release-report-policy";
import * as authority from "@/server/operations/database-authority";
import { eq, inArray } from "drizzle-orm";
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
  getReleaseReportIntakeStatus,
  submitPublicReleaseReport,
} from "./release-report-intake";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("public report intake PostgreSQL authority", () => {
  const client = postgres(databaseUrl!, { max: 6 });
  const database = drizzle(client, { schema });
  const prefix = `report-intake-test:${crypto.randomUUID()}`;
  const userId = `${prefix}:creator`;
  const gameIds = [`${prefix}:game-a`, `${prefix}:game-b`];
  const releaseIds = [`${prefix}:release-a`, `${prefix}:release-b`];
  const generationIds = [`${prefix}:generation-a`, `${prefix}:generation-b`];
  const baseTime = new Date("2042-01-01T12:34:30.000Z");
  let now = baseTime;
  const request = (
    patch: Partial<PublicReleaseReportInput> = {},
  ): PublicReleaseReportInput => ({
    submissionId: crypto.randomUUID(),
    releaseId: releaseIds[0]!,
    source: "arcade",
    reason: "Private evidence",
    details: "Private report details",
    reporterEmail: "reporter@example.invalid",
    ...patch,
  });
  const submit = (input: PublicReleaseReportInput) =>
    submitPublicReleaseReport({ database, input });
  const rows = () =>
    database
      .select()
      .from(schema.gameReleaseReports)
      .where(inArray(schema.gameReleaseReports.releaseId, releaseIds));
  const seed = async (size: number, createdAt = now) => {
    if (!size) return;
    await database.insert(schema.gameReleaseReports).values(
      Array.from({ length: size }, (_, index) => ({
        id: crypto.randomUUID(),
        releaseId: releaseIds[index % 2]!,
        status: "open" as const,
        source: "arcade" as const,
        reason: `Seed evidence ${index}`,
        createdAt,
      })),
    );
  };

  beforeAll(async () => {
    await database.insert(schema.users).values({
      id: userId,
      name: "Report intake fixture",
      email: `${userId}@example.invalid`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (let index = 0; index < 2; index++) {
      await database.insert(schema.games).values({
        id: gameIds[index]!,
        userId,
        name: "Public fixture",
        arcadeVisibility: "listed",
      });
      await database.insert(schema.gameReleases).values({
        id: releaseIds[index]!,
        gameId: gameIds[index]!,
        sourceKind: "upload",
        status: "archived",
      });
      await database.insert(schema.gameReleaseGenerations).values({
        id: generationIds[index]!,
        releaseId: releaseIds[index]!,
        sequence: 1,
        status: "ready",
        originalFilename: "fixture.zip",
        contentType: "application/zip",
        declaredSizeBytes: 10,
        zipObjectKey: `${prefix}/${index}/fixture.zip`,
        siteRootKey: `${prefix}/${index}/site`,
        observedSizeBytes: 10,
        observedContentType: "application/zip",
        extractedSizeBytes: 20,
        fileCount: 1,
        entryPath: "host.html",
        contentHash: "a".repeat(64),
        uploadObservedAt: baseTime,
        processingStartedAt: baseTime,
        readyAt: baseTime,
      });
      await database
        .update(schema.gameReleases)
        .set({ status: "live", promotedGenerationId: generationIds[index]! })
        .where(eq(schema.gameReleases.id, releaseIds[index]!));
    }
  });

  beforeEach(async () => {
    now = new Date(baseTime);
    // Keep UTC-boundary cases deterministic; all locking, queries and writes
    // remain real PostgreSQL. A separate case exercises its real authority clock.
    vi.spyOn(authority, "resolveDatabaseAuthorityNow").mockImplementation(
      async () => new Date(now),
    );
    await database
      .delete(schema.gameReleaseReports)
      .where(inArray(schema.gameReleaseReports.releaseId, releaseIds));
    await database
      .update(schema.games)
      .set({ arcadeVisibility: "listed" })
      .where(inArray(schema.games.id, gameIds));
    for (let index = 0; index < 2; index++) {
      await database
        .update(schema.gameReleaseGenerations)
        .set({
          status: "ready",
          readyAt: baseTime,
          failedAt: null,
          siteRootKey: `${prefix}/${index}/site`,
          extractedSizeBytes: 20,
          fileCount: 1,
          entryPath: "host.html",
          contentHash: "a".repeat(64),
        })
        .where(eq(schema.gameReleaseGenerations.id, generationIds[index]!));
      await database
        .update(schema.gameReleases)
        .set({ status: "live", promotedGenerationId: generationIds[index]! })
        .where(eq(schema.gameReleases.id, releaseIds[index]!));
    }
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    try {
      await database
        .update(schema.gameReleases)
        .set({ status: "archived", promotedGenerationId: null })
        .where(inArray(schema.gameReleases.id, releaseIds));
      await database
        .delete(schema.gameReleases)
        .where(inArray(schema.gameReleases.id, releaseIds));
      await database
        .delete(schema.games)
        .where(inArray(schema.games.id, gameIds));
      await database.delete(schema.users).where(eq(schema.users.id, userId));
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it("uses PostgreSQL time and stores one private report with only an opaque receipt", async () => {
    vi.restoreAllMocks();
    const input = request();
    const result = await submit(input);
    expect(result).toEqual({
      submissionId: input.submissionId,
      received: true,
    });
    const [stored] = await rows();
    const status = await getReleaseReportIntakeStatus({ database });
    expect(stored).toMatchObject({
      reporterEmail: input.reporterEmail,
      reason: input.reason,
      details: input.details,
      reviewRevision: 0,
      submissionId: input.submissionId,
    });
    expect(stored!.id).not.toBe(input.submissionId);
    expect(stored!.createdAt.getTime()).toBeLessThanOrEqual(
      status.observedAt.getTime(),
    );
    expect(
      status.observedAt.getTime() - stored!.createdAt.getTime(),
    ).toBeLessThan(5000);
    expect(status.windows.map((window) => window.used)).toEqual([1, 1]);
    expect(JSON.stringify(status)).not.toContain(input.reporterEmail!);
  });

  it("serializes same-key retries without coalescing independent reporters' identical content", async () => {
    const input = request();
    const results = await Promise.all([
      submit(input),
      submit(input),
      submit({ ...input, submissionId: crypto.randomUUID() }),
      submit({ ...input, submissionId: crypto.randomUUID() }),
    ]);
    expect(new Set(results.map((result) => result.submissionId)).size).toBe(3);
    expect(results[0]).toEqual(results[1]);
    expect(await rows()).toHaveLength(3);
    expect(
      (await getReleaseReportIntakeStatus({ database })).windows.map(
        (window) => window.used,
      ),
    ).toEqual([3, 3]);
  });

  it("replays the exact original ID after quarantine without revealing private decision status", async () => {
    const input = request();
    await submit(input);
    await database
      .update(schema.gameReleaseReports)
      .set({ status: "dismissed", reviewRevision: 3, reviewedAt: now })
      .where(eq(schema.gameReleaseReports.submissionId, input.submissionId));
    await database
      .update(schema.gameReleases)
      .set({ status: "quarantined" })
      .where(eq(schema.gameReleases.id, input.releaseId));
    expect(await submit(input)).toEqual({
      submissionId: input.submissionId,
      received: true,
    });
    await expect(
      submit({ ...input, submissionId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await rows()).toHaveLength(1);
  });

  it.each([
    { reason: "Changed reason" },
    { details: "Changed details" },
    { reporterEmail: "other@example.invalid" },
    { source: "play_page" as const },
  ])(
    "rejects a submission-ID collision with changed private content %j",
    async (patch) => {
      const input = request();
      await submit(input);
      await expect(submit({ ...input, ...patch })).rejects.toMatchObject({
        code: "conflict",
      });
      expect(await rows()).toHaveLength(1);
    },
  );

  it("binds the private idempotency key to the exact release", async () => {
    const input = request();
    await submit(input);
    await expect(
      submit({ ...input, releaseId: releaseIds[1]! }),
    ).rejects.toMatchObject({ code: "conflict" });
    const other = await submit({
      ...input,
      releaseId: releaseIds[1]!,
      submissionId: crypto.randomUUID(),
    });
    expect(other.submissionId).not.toBe(input.submissionId);
    expect(await rows()).toHaveLength(2);
  });

  it("does not let creator-visible report IDs act as private retry keys or content oracles", async () => {
    const input = request();
    await submit(input);
    const [stored] = await rows();
    const claimedKey = stored!.id;
    expect(
      await submit({
        ...input,
        submissionId: claimedKey,
        reporterEmail: "guessed@example.invalid",
      }),
    ).toEqual({ submissionId: claimedKey, received: true });
    const independentKey = crypto.randomUUID();
    expect(await submit({ ...input, submissionId: independentKey })).toEqual({
      submissionId: independentKey,
      received: true,
    });
    expect(await rows()).toHaveLength(3);
  });

  it("enforces the minute new-row budget across concurrent requests for different games", async () => {
    await seed(RELEASE_REPORT_INTAKE_POLICY.minuteLimit - 1);
    const results = await Promise.allSettled([
      submit(request()),
      submit(
        request({ releaseId: releaseIds[1]!, reason: "Other game evidence" }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { code: "rate_limited", retryAfterSeconds: 30 },
    });
    expect(await rows()).toHaveLength(RELEASE_REPORT_INTAKE_POLICY.minuteLimit);
    const status = await getReleaseReportIntakeStatus({ database });
    expect(status.windows[0]).toMatchObject({
      name: "minute",
      remaining: 0,
      resetsAt: new Date("2042-01-01T12:35:00Z"),
    });
  });

  it("lets only exact private-key retries bypass exhausted new-row budgets", async () => {
    const input = request();
    await submit(input);
    await seed(RELEASE_REPORT_INTAKE_POLICY.minuteLimit - 1);
    expect(await submit(input)).toEqual({
      submissionId: input.submissionId,
      received: true,
    });
    await expect(
      submit({ ...input, submissionId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    await expect(
      submit(request({ reason: "Different evidence" })),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(await rows()).toHaveLength(RELEASE_REPORT_INTAKE_POLICY.minuteLimit);
  });

  it("resets the minute window without discarding the UTC-day usage", async () => {
    await seed(RELEASE_REPORT_INTAKE_POLICY.minuteLimit);
    await expect(submit(request())).rejects.toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
    now = new Date("2042-01-01T12:35:00Z");
    const status = await getReleaseReportIntakeStatus({ database });
    expect(status.windows.map((window) => window.used)).toEqual([0, 120]);
    expect(status.retryAfterSeconds).toBe(0);
    await submit(request());
    expect(
      (await getReleaseReportIntakeStatus({ database })).windows.map(
        (window) => window.used,
      ),
    ).toEqual([1, 121]);
  });

  it("enforces the shared day cap and resets exactly at UTC midnight", async () => {
    now = new Date("2042-01-01T23:59:30Z");
    await seed(
      RELEASE_REPORT_INTAKE_POLICY.utcDayLimit,
      new Date("2042-01-01T01:00:00Z"),
    );
    const status = await getReleaseReportIntakeStatus({ database });
    expect(status.windows.map((window) => window.used)).toEqual([0, 1000]);
    expect(status.retryAfterSeconds).toBe(30);
    await expect(submit(request())).rejects.toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
    now = new Date("2042-01-02T00:00:00Z");
    expect(
      (await getReleaseReportIntakeStatus({ database })).windows.map(
        (window) => window.used,
      ),
    ).toEqual([0, 0]);
    await submit(request());
    expect(
      (await getReleaseReportIntakeStatus({ database })).windows.map(
        (window) => window.used,
      ),
    ).toEqual([1, 1]);
  });

  it.each(["hidden", "quarantined", "archived", "missing"] as const)(
    "rejects an unavailable exact target: %s",
    async (state) => {
      if (state === "hidden")
        await database
          .update(schema.games)
          .set({ arcadeVisibility: "hidden" })
          .where(eq(schema.games.id, gameIds[0]!));
      if (state === "quarantined" || state === "archived")
        await database
          .update(schema.gameReleases)
          .set({ status: state })
          .where(eq(schema.gameReleases.id, releaseIds[0]!));
      await expect(
        submit(
          request(
            state === "missing" ? { releaseId: `${prefix}:missing` } : {},
          ),
        ),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await rows()).toEqual([]);
    },
  );

  it("cannot commit a live release whose promoted generation is not ready", async () => {
    await expect(
      database.transaction(async (tx) => {
        await tx
          .update(schema.gameReleaseGenerations)
          .set({
            status: "failed",
            readyAt: null,
            failedAt: now,
            siteRootKey: null,
            extractedSizeBytes: null,
            fileCount: null,
            entryPath: null,
            contentHash: null,
          })
          .where(eq(schema.gameReleaseGenerations.id, generationIds[0]!));
      }),
    ).rejects.toMatchObject({
      code: "23514",
      constraint_name: "game_release_generation_state_guard",
    });
    expect(
      await database.query.gameReleaseGenerations.findFirst({
        where: eq(schema.gameReleaseGenerations.id, generationIds[0]!),
      }),
    ).toMatchObject({ status: "ready" });
    expect(await rows()).toEqual([]);
  });
});
