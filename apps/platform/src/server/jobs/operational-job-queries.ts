import { db } from "@/db";
import { operationalJobs } from "@/db/schema";
import type {
  OperationalJobKind,
  OperationalJobResourceKind,
  OperationalJobStatus,
} from "@air-jam/database-contract";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  OperationalJobConflictError,
  serializeOperationalJobAttemptForOperator,
  serializeOperationalJobEventForOperator,
  serializeOperationalJobForOperator,
  type JobDatabase,
} from "./operational-job-internals";

export const getOperationalJobAuthorityTime = async ({
  database = db,
}: {
  database?: JobDatabase;
} = {}): Promise<Date> => {
  const rows = await database.execute(
    sql`select clock_timestamp() as authority_now`,
  );
  const value = (rows[0] as { authority_now?: Date | string } | undefined)
    ?.authority_now;
  if (!value) throw new Error("Database authority time was unavailable.");
  const authorityNow = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(authorityNow.getTime())) {
    throw new Error("Database authority time was invalid.");
  }
  return authorityNow;
};

export const getOperationalJob = async ({
  database = db,
  jobId,
}: {
  database?: JobDatabase;
  jobId: string;
}) => {
  const job = await database.query.operationalJobs.findFirst({
    where: (table, { eq }) => eq(table.id, jobId),
  });
  if (!job) {
    throw new OperationalJobConflictError("Operational job was not found.");
  }
  const events = await database.query.operationalJobEvents.findMany({
    where: (table, { eq }) => eq(table.jobId, jobId),
    orderBy: (table, { asc }) => [asc(table.nextRevision)],
  });
  const attempts = await database.query.operationalJobAttempts.findMany({
    where: (table, { eq }) => eq(table.jobId, jobId),
    orderBy: (table, { asc }) => [asc(table.attempt)],
  });
  return {
    job: serializeOperationalJobForOperator(job),
    attempts: attempts.map(serializeOperationalJobAttemptForOperator),
    events: events.map(serializeOperationalJobEventForOperator),
  };
};

export const listOperationalJobs = async ({
  database = db,
  kind,
  statuses,
  creatorId,
  releaseId,
  resourceKind,
  resourceId,
  limit = 100,
}: {
  database?: JobDatabase;
  kind?: OperationalJobKind;
  statuses?: OperationalJobStatus[];
  creatorId?: string;
  releaseId?: string;
  resourceKind?: OperationalJobResourceKind;
  resourceId?: string;
  limit?: number;
}) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalJobConflictError(
      "Job list limit must be between 1 and 500.",
    );
  }
  const conditions = [];
  if (kind) conditions.push(eq(operationalJobs.kind, kind));
  if (statuses?.length) {
    conditions.push(inArray(operationalJobs.status, statuses));
  }
  if (creatorId) conditions.push(eq(operationalJobs.creatorId, creatorId));
  if (releaseId) conditions.push(eq(operationalJobs.releaseId, releaseId));
  if (resourceKind) {
    conditions.push(eq(operationalJobs.resourceKind, resourceKind));
  }
  if (resourceId) conditions.push(eq(operationalJobs.resourceId, resourceId));
  const jobs = await database
    .select()
    .from(operationalJobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(operationalJobs.createdAt))
    .limit(limit);
  return jobs.map(serializeOperationalJobForOperator);
};
