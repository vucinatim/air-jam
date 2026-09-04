import { db } from "@/db";
import {
  normalizeUnknownOperationalFailure,
  type DeploymentEnvironment,
  type OperationalFailureV1,
} from "@air-jam/operations-contract";
import type { OperationalEventDatabase } from "./operational-event-delivery-service";
import { OPERATIONAL_SYNTHETIC_CHECKS } from "./operational-reliability-policy";
import {
  resolveOperationalSyntheticRuntimeConfig,
  runOperationalSynthetic,
  type OperationalSyntheticPersistenceResult,
  type OperationalSyntheticRuntimeConfig,
} from "./operational-synthetic-service";

export type OperationalSyntheticScheduleResult = {
  environment: DeploymentEnvironment;
  scheduledAt: string;
  dueCount: number;
  completedCount: number;
  failureCount: number;
  staleIgnoredCount: number;
  skippedCount: number;
  checks: Array<
    | {
        checkId: string;
        status: "completed";
        result: OperationalSyntheticPersistenceResult;
      }
    | {
        checkId: string;
        status: "failed";
        failure: OperationalFailureV1;
      }
    | {
        checkId: string;
        status: "not_due";
        latestCompletedAt: string;
      }
  >;
};

export const runDueOperationalSynthetics = async ({
  database = db,
  actor,
  config = resolveOperationalSyntheticRuntimeConfig(),
  now = new Date(),
  runSynthetic = runOperationalSynthetic,
}: {
  database?: OperationalEventDatabase;
  actor: string;
  config?: OperationalSyntheticRuntimeConfig;
  now?: Date;
  runSynthetic?: typeof runOperationalSynthetic;
}): Promise<OperationalSyntheticScheduleResult> => {
  const checks: OperationalSyntheticScheduleResult["checks"] = [];
  let dueCount = 0;
  let completedCount = 0;
  let failureCount = 0;
  let staleIgnoredCount = 0;
  let skippedCount = 0;
  for (const check of OPERATIONAL_SYNTHETIC_CHECKS) {
    try {
      const latest = await database.query.operationalSyntheticRuns.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.checkId, check.checkId),
            eq(table.environment, config.environment),
          ),
        orderBy: (table, { desc }) => desc(table.completedAt),
      });
      if (
        latest &&
        latest.completedAt.getTime() + check.intervalSeconds * 1_000 >
          now.getTime()
      ) {
        checks.push({
          checkId: check.checkId,
          status: "not_due",
          latestCompletedAt: latest.completedAt.toISOString(),
        });
        skippedCount += 1;
        continue;
      }
      dueCount += 1;
      const bucket = Math.floor(
        now.getTime() / (check.intervalSeconds * 1_000),
      );
      const result = await runSynthetic({
        database,
        checkId: check.checkId,
        actor,
        reason: "Scheduled launch-critical synthetic check.",
        idempotencyKey: `scheduled:${config.environment}:${check.checkId}:${bucket}`,
        config,
      });
      completedCount += 1;
      if (result.evaluationDisposition === "stale_ignored") {
        staleIgnoredCount += 1;
      }
      checks.push({ checkId: check.checkId, status: "completed", result });
    } catch (error) {
      failureCount += 1;
      checks.push({
        checkId: check.checkId,
        status: "failed",
        failure: normalizeUnknownOperationalFailure({
          error,
          code: "synthetic.schedule_item_failed",
          summary:
            "A due operational synthetic could not be executed or retained.",
          retryable: true,
          stage: "synthetic-schedule",
          details: { checkId: check.checkId },
        }),
      });
    }
  }
  return {
    environment: config.environment,
    scheduledAt: now.toISOString(),
    dueCount,
    completedCount,
    failureCount,
    staleIgnoredCount,
    skippedCount,
    checks,
  };
};
