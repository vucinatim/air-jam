import * as schema from "@/db/schema";
import { platformSchemaMigrationRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { acquirePlatformSchemaMigrationLock } from "./platform-schema-migration-lock";
import {
  PlatformSchemaMigrationRunConflictError,
  beginPlatformSchemaMigrationRun,
  markPlatformSchemaMigrationApplied,
  markPlatformSchemaMigrationApplyFailed,
  markPlatformSchemaMigrationVerificationFailed,
  markPlatformSchemaMigrationVerified,
  restartFailedPlatformSchemaMigrationRun,
} from "./platform-schema-migration-run-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres(
  "platform schema migration run PostgreSQL invariants",
  () => {
    const client = postgres(databaseUrl!, { max: 2 });
    const database = drizzle(client, { schema });
    const planDigest = crypto.randomUUID().replaceAll("-", "").padEnd(64, "0");
    const idempotencyKey = `migration-test:${crypto.randomUUID()}`;
    const input = {
      id: crypto.randomUUID(),
      planDigest,
      idempotencyKey,
      targetFingerprint: `target:${crypto.randomUUID()}`,
      sourceCommit: "a".repeat(40),
      sourceHeadTag: "0036_test",
      sourceHeadCreatedAt: 1_788_493_929_558,
      sourceHeadHash: "b".repeat(64),
      actor: "agent:postgres-proof",
      reason: "prove durable migration lifecycle",
      plan: { digest: planDigest },
      backupEvidence: { sha256: "c".repeat(64) },
      drainEvidence: { paused: [] },
    };

    afterAll(async () => {
      await database
        .delete(platformSchemaMigrationRuns)
        .where(eq(platformSchemaMigrationRuns.planDigest, planDigest));
      await client.end();
    });

    it("serializes migration lifecycle operations across independent invocations", async () => {
      const release = await acquirePlatformSchemaMigrationLock({ client });
      await expect(
        acquirePlatformSchemaMigrationLock({ client }),
      ).rejects.toThrow(
        "Another platform schema migration lifecycle operation is in progress",
      );
      await release();

      const releaseAfterRetry = await acquirePlatformSchemaMigrationLock({
        client,
      });
      await releaseAfterRetry();
    });

    it("replays intent, fences conflicting identity, and enforces lifecycle transitions", async () => {
      const applying = await beginPlatformSchemaMigrationRun({
        database,
        input,
      });
      const replay = await beginPlatformSchemaMigrationRun({ database, input });
      expect(applying.status).toBe("applying");
      expect(replay.id).toBe(applying.id);

      await expect(
        beginPlatformSchemaMigrationRun({
          database,
          input: { ...input, planDigest: "d".repeat(64) },
        }),
      ).rejects.toBeInstanceOf(PlatformSchemaMigrationRunConflictError);

      const applyFailed = await markPlatformSchemaMigrationApplyFailed({
        database,
        planDigest,
        verification: { phase: "apply", passed: false },
      });
      expect(applyFailed.status).toBe("apply_failed");

      const restarted = await restartFailedPlatformSchemaMigrationRun({
        database,
        planDigest,
      });
      expect(restarted).toMatchObject({
        status: "applying",
        completedAt: null,
        verification: null,
      });

      const applied = await markPlatformSchemaMigrationApplied({
        database,
        planDigest,
      });
      expect(applied.status).toBe("applied");
      expect(applied.appliedAt).toBeInstanceOf(Date);

      const verificationFailed =
        await markPlatformSchemaMigrationVerificationFailed({
          database,
          planDigest,
          verification: { phase: "deployment", passed: false },
        });
      expect(verificationFailed.status).toBe("verification_failed");

      const verified = await markPlatformSchemaMigrationVerified({
        database,
        planDigest,
        verification: { passed: true },
      });
      expect(verified).toMatchObject({ status: "verified" });
      expect(verified.completedAt).toBeInstanceOf(Date);

      await expect(
        restartFailedPlatformSchemaMigrationRun({ database, planDigest }),
      ).rejects.toBeInstanceOf(PlatformSchemaMigrationRunConflictError);
    });
  },
);
