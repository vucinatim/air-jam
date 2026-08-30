import type {
  OperationalJobKind,
  OperationalJobStatus,
} from "@air-jam/database-contract";
import { getOperationalJobPolicy } from "./operational-job-policy";

type OperationalJobPlanningSnapshot = {
  id: string;
  kind: OperationalJobKind;
  status: OperationalJobStatus;
  revision: number;
  attemptCount: number;
  maxAttempts: number;
  deadlineAt: Date | string;
  leaseExpiresAt: Date | string | null;
};

const asDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

export type OperationalJobCancellationPlan = {
  eligible: boolean;
  currentStatus: OperationalJobStatus;
  currentRevision: number;
  nextStatus: OperationalJobStatus | null;
  rejectionReason: string | null;
};

export const planOperationalJobCancellation = (
  job: Pick<OperationalJobPlanningSnapshot, "status" | "revision">,
): OperationalJobCancellationPlan => {
  if (["succeeded", "failed", "canceled"].includes(job.status)) {
    return {
      eligible: false,
      currentStatus: job.status,
      currentRevision: job.revision,
      nextStatus: null,
      rejectionReason: `Terminal ${job.status} job cannot accept a new cancellation request.`,
    };
  }
  if (job.status === "cancel_requested") {
    return {
      eligible: false,
      currentStatus: job.status,
      currentRevision: job.revision,
      nextStatus: null,
      rejectionReason:
        "Job already has a cancellation request with a different idempotency key.",
    };
  }
  return {
    eligible: true,
    currentStatus: job.status,
    currentRevision: job.revision,
    nextStatus: job.status === "queued" ? "canceled" : "cancel_requested",
    rejectionReason: null,
  };
};

export const isOperationalJobExpired = (
  job: OperationalJobPlanningSnapshot,
  now: Date,
): boolean =>
  (job.status === "queued" && asDate(job.deadlineAt) <= now) ||
  ((job.status === "running" || job.status === "cancel_requested") &&
    ((job.leaseExpiresAt !== null && asDate(job.leaseExpiresAt) <= now) ||
      asDate(job.deadlineAt) <= now));

export type ExpiredOperationalJobRepairPlan = {
  jobId: string;
  kind: OperationalJobKind;
  currentStatus: OperationalJobStatus;
  currentRevision: number;
  nextStatus: OperationalJobStatus;
  retryAt: Date | null;
  error: { code: "deadline_expired" | "lease_expired"; message: string };
  repairAction:
    | "finalize_cancellation"
    | "recover_for_retry"
    | "terminal_failure";
};

export const planExpiredOperationalJobRepair = (
  job: OperationalJobPlanningSnapshot,
  now: Date,
): ExpiredOperationalJobRepairPlan | null => {
  if (!isOperationalJobExpired(job, now)) return null;

  const policy = getOperationalJobPolicy(job.kind);
  const deadlineAt = asDate(job.deadlineAt);
  const deadlineExpired = deadlineAt <= now;
  const retryAt = new Date(
    now.getTime() +
      policy.retryBackoffSeconds *
        2 ** Math.max(job.attemptCount - 1, 0) *
        1_000,
  );
  const canceled = job.status === "cancel_requested";
  const willRetry =
    job.status === "running" &&
    !deadlineExpired &&
    job.attemptCount < job.maxAttempts &&
    retryAt < deadlineAt;
  return {
    jobId: job.id,
    kind: job.kind,
    currentStatus: job.status,
    currentRevision: job.revision,
    nextStatus: canceled ? "canceled" : willRetry ? "queued" : "failed",
    retryAt: willRetry ? retryAt : null,
    error: {
      code: deadlineExpired ? "deadline_expired" : "lease_expired",
      message: deadlineExpired
        ? "Job deadline expired before the work completed."
        : "Worker lease expired before the attempt completed.",
    },
    repairAction: canceled
      ? "finalize_cancellation"
      : willRetry
        ? "recover_for_retry"
        : "terminal_failure",
  };
};
