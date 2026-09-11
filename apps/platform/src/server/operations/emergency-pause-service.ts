import { db } from "@/db";
import { operationalControlEvents } from "@/db/schema";
import {
  operationalLaneValues,
  type OperationalLane,
  type OperationalLaneControlSnapshot,
} from "@air-jam/database-contract";
import { inArray } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "./database-authority";
import { acquireOperationalLaneLock } from "./operational-lane-lock";
import {
  listOperationalLaneControls,
  OPERATIONAL_RECOVERY_LANES,
  OperationalControlConflictError,
  PRODUCTION_CONTROL_CONTRACT_VERSION,
  setOperationalLaneControlInTransaction,
} from "./production-control-service";

/** Stop new expensive work without disabling the sensors and cleanup needed to recover. */
export const OPERATIONAL_EMERGENCY_PAUSE_LANES: readonly OperationalLane[] =
  Object.freeze(
    operationalLaneValues.filter(
      (lane) => !OPERATIONAL_RECOVERY_LANES.includes(lane),
    ),
  );

const scope = Object.freeze({
  lanes: OPERATIONAL_EMERGENCY_PAUSE_LANES,
  excludedLanes: OPERATIONAL_RECOVERY_LANES,
});

export type OperationalEmergencyPauseInput = {
  actor: string;
  reason: string;
  idempotencyKey: string;
  retryAfterSeconds: number | null;
};

const normalizeInput = (
  input: OperationalEmergencyPauseInput,
): OperationalEmergencyPauseInput => {
  const normalized = {
    actor: input.actor.trim(),
    reason: input.reason.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    retryAfterSeconds: input.retryAfterSeconds,
  };
  if (!normalized.actor || !normalized.reason || !normalized.idempotencyKey) {
    throw new OperationalControlConflictError(
      "Emergency pause requires actor, reason, and idempotency key.",
    );
  }
  if (
    normalized.retryAfterSeconds !== null &&
    (!Number.isSafeInteger(normalized.retryAfterSeconds) ||
      normalized.retryAfterSeconds <= 0)
  ) {
    throw new OperationalControlConflictError(
      "Retry-after seconds must be a positive integer when provided.",
    );
  }
  return normalized;
};

const laneCommandKey = (idempotencyKey: string, lane: OperationalLane) =>
  `emergency-pause:${idempotencyKey}:${lane}`;

const readPauseReceipt = async (
  database: Pick<typeof db, "select">,
  input: OperationalEmergencyPauseInput,
) => {
  const events = await database
    .select()
    .from(operationalControlEvents)
    .where(
      inArray(
        operationalControlEvents.idempotencyKey,
        OPERATIONAL_EMERGENCY_PAUSE_LANES.map((lane) =>
          laneCommandKey(input.idempotencyKey, lane),
        ),
      ),
    );
  if (events.length === 0) return null;
  const eventsByKey = new Map(
    events.map((event) => [event.idempotencyKey, event]),
  );
  return OPERATIONAL_EMERGENCY_PAUSE_LANES.map((lane) => {
    const event = eventsByKey.get(laneCommandKey(input.idempotencyKey, lane));
    if (
      !event ||
      event.action !== "set_lane_mode" ||
      event.lane !== lane ||
      event.actor !== input.actor ||
      event.reason !== input.reason ||
      event.next.mode !== "paused" ||
      event.next.retryAfterSeconds !== input.retryAfterSeconds
    ) {
      throw new OperationalControlConflictError(
        "The emergency pause idempotency key has an incomplete or conflicting receipt.",
      );
    }
    return event;
  });
};

/** Read-only preview. Apply resolves current revisions atomically; preview is not a reservation. */
export const previewOperationalEmergencyPause = async ({
  database = db,
  input,
}: {
  database?: typeof db;
  input: OperationalEmergencyPauseInput;
}) => {
  const request = normalizeInput(input);
  const receipt = await readPauseReceipt(database, request);
  const controls = await listOperationalLaneControls({ database });
  return {
    contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
    scope,
    request,
    replayed: receipt !== null,
    wouldApply: receipt === null,
    lanes: controls
      .filter((control) =>
        OPERATIONAL_EMERGENCY_PAUSE_LANES.includes(control.lane),
      )
      .map((current) => ({
        lane: current.lane,
        current,
        requestedMode: "paused" as const,
      })),
  };
};

/**
 * Atomically pauses the fixed expensive lanes through existing audited controls.
 * Replay returns the original previous/applied receipt plus current state; it
 * never re-pauses lanes explicitly restored after the original incident command.
 */
export const applyOperationalEmergencyPause = async ({
  database = db,
  input,
}: {
  database?: typeof db;
  input: OperationalEmergencyPauseInput;
}) => {
  const request = normalizeInput(input);
  return database.transaction(async (tx) => {
    // Every multi-lane pause acquires the same canonical order before writing.
    for (const lane of OPERATIONAL_EMERGENCY_PAUSE_LANES) {
      await acquireOperationalLaneLock(tx, lane);
    }
    const receipt = await readPauseReceipt(tx, request);
    const controls = await listOperationalLaneControls({ database: tx });
    const currentByLane = new Map(
      controls.map((control) => [control.lane, control]),
    );
    const lanes: Array<{
      lane: OperationalLane;
      previous: OperationalLaneControlSnapshot;
      applied: OperationalLaneControlSnapshot;
      current: OperationalLaneControlSnapshot;
    }> = [];
    if (receipt) {
      for (const event of receipt) {
        lanes.push({
          lane: event.lane,
          previous: event.previous,
          applied: event.next,
          current: currentByLane.get(event.lane)!,
        });
      }
    } else {
      const now = await resolveDatabaseAuthorityNow(tx);
      for (const lane of OPERATIONAL_EMERGENCY_PAUSE_LANES) {
        const previous = currentByLane.get(lane)!;
        const applied = await setOperationalLaneControlInTransaction({
          tx,
          now,
          input: {
            ...request,
            lane,
            mode: "paused",
            expectedRevision: previous.revision,
            idempotencyKey: laneCommandKey(request.idempotencyKey, lane),
          },
        });
        lanes.push({ lane, previous, applied, current: applied });
      }
    }
    return {
      contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
      scope,
      request,
      replayed: receipt !== null,
      lanes,
    };
  });
};
