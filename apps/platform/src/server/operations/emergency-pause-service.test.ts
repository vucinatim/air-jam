import { db } from "@/db";
import { operationalControlEvents } from "@/db/schema";
import { operationalLaneValues } from "@air-jam/database-contract";
import { describe, expect, it, vi } from "vitest";
import {
  applyOperationalEmergencyPause,
  OPERATIONAL_EMERGENCY_PAUSE_LANES,
  previewOperationalEmergencyPause,
} from "./emergency-pause-service";
import { OperationalControlConflictError } from "./production-control-service";

const input = {
  actor: "agent:incident",
  reason: "Unexpected costly traffic",
  idempotencyKey: "incident-1",
  retryAfterSeconds: 60,
};

const fakeDatabase = (events: unknown[] = []) => {
  const transaction = vi.fn();
  const select = vi.fn(() => ({
    from: (table: unknown) =>
      table === operationalControlEvents
        ? { where: async () => events }
        : Promise.resolve([]),
  }));
  return {
    database: { select, transaction } as unknown as typeof db,
    transaction,
    select,
  };
};

describe("emergency pause contract", () => {
  it("covers exactly the expensive canonical lanes and leaves recovery lanes outside its scope", () => {
    expect(OPERATIONAL_EMERGENCY_PAUSE_LANES).toEqual(
      operationalLaneValues.filter(
        (lane) => lane !== "product_telemetry" && lane !== "lifecycle_cleanup",
      ),
    );
    expect(OPERATIONAL_EMERGENCY_PAUSE_LANES).toHaveLength(11);
    expect(Object.isFrozen(OPERATIONAL_EMERGENCY_PAUSE_LANES)).toBe(true);
  });

  it("previews current/default states without a transaction or write", async () => {
    const fake = fakeDatabase();
    const preview = await previewOperationalEmergencyPause({
      database: fake.database,
      input,
    });
    expect(preview.scope.excludedLanes).toEqual([
      "product_telemetry",
      "lifecycle_cleanup",
    ]);
    expect(preview.lanes.map(({ lane }) => lane)).toEqual(
      OPERATIONAL_EMERGENCY_PAUSE_LANES,
    );
    expect(
      preview.lanes.every(
        ({ current, requestedMode }) =>
          current.mode === "normal" &&
          current.revision === 0 &&
          requestedMode === "paused",
      ),
    ).toBe(true);
    expect(fake.transaction).not.toHaveBeenCalled();
    expect(fake.select).toHaveBeenCalledTimes(2);
  });

  it.each([
    { actor: " " },
    { reason: " " },
    { idempotencyKey: " " },
    { retryAfterSeconds: 0 },
    { retryAfterSeconds: 1.5 },
    { retryAfterSeconds: Number.NaN },
  ])("rejects invalid intent before reads or writes: %j", async (invalid) => {
    const fake = fakeDatabase();
    for (const operation of [
      previewOperationalEmergencyPause,
      applyOperationalEmergencyPause,
    ]) {
      await expect(
        operation({ database: fake.database, input: { ...input, ...invalid } }),
      ).rejects.toBeInstanceOf(OperationalControlConflictError);
    }
    expect(fake.select).not.toHaveBeenCalled();
    expect(fake.transaction).not.toHaveBeenCalled();
  });

  it("rejects incomplete or conflicting original receipts during read-only preview", async () => {
    const fake = fakeDatabase([
      {
        idempotencyKey: "emergency-pause:incident-1:game_creation",
        action: "set_lane_mode",
        lane: "game_creation",
        actor: "different-actor",
      },
    ]);
    await expect(
      previewOperationalEmergencyPause({ database: fake.database, input }),
    ).rejects.toBeInstanceOf(OperationalControlConflictError);
    expect(fake.transaction).not.toHaveBeenCalled();
  });
});
