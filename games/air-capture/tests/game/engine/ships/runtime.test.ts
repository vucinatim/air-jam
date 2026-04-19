import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  applyPendingShipRespawn,
  applyShipPhysics,
  clearTrackedShipPose,
  createShipRuntimeState,
  readShipPhysicsSnapshot,
  resetShipRuntimeMotion,
  shipPositions,
  shipRotations,
  updateTrackedShipPose,
} from "../../../../src/game/engine/ships/runtime";

describe("air-capture ship runtime helpers", () => {
  it("creates explicit mutable runtime state", () => {
    const runtime = createShipRuntimeState();

    expect(runtime.smoothedInput).toEqual({ x: 0, y: 0 });
    expect(runtime.velocity.toArray()).toEqual([0, 0, 0]);
    expect(runtime.pendingRespawnPosition).toBeNull();
  });

  it("tracks and clears ship pose centrally", () => {
    updateTrackedShipPose("pilot-1", new Vector3(1, 2, 3), new Quaternion());

    expect(shipPositions.get("pilot-1")?.toArray()).toEqual([1, 2, 3]);
    expect(shipRotations.get("pilot-1")).toBeDefined();

    clearTrackedShipPose("pilot-1");

    expect(shipPositions.has("pilot-1")).toBe(false);
    expect(shipRotations.has("pilot-1")).toBe(false);
  });

  it("resets runtime motion and applies respawn teleports", () => {
    const runtime = createShipRuntimeState();
    runtime.pendingRespawnPosition = [4, 5, 6];
    runtime.velocity.set(1, 2, 3);
    runtime.angularVelocity = 4;
    runtime.pitchAngularVelocity = 5;

    const calls: Array<[string, unknown]> = [];
    const rigidBody = {
      setTranslation(value: unknown) {
        calls.push(["setTranslation", value]);
      },
      setLinvel(value: unknown) {
        calls.push(["setLinvel", value]);
      },
      setAngvel(value: unknown) {
        calls.push(["setAngvel", value]);
      },
    };

    const applied = applyPendingShipRespawn(rigidBody as never, runtime);

    expect(applied).toBe(true);
    expect(calls).toEqual([
      ["setTranslation", { x: 4, y: 5, z: 6 }],
      ["setLinvel", { x: 0, y: 0, z: 0 }],
      ["setAngvel", { x: 0, y: 0, z: 0 }],
    ]);
    expect(runtime.pendingRespawnPosition).toBeNull();
    expect(runtime.velocity.toArray()).toEqual([0, 0, 0]);
    expect(runtime.angularVelocity).toBe(0);
    expect(runtime.pitchAngularVelocity).toBe(0);
  });

  it("reads and applies physics through one adapter seam", () => {
    const rigidBody = {
      translation: () => ({ x: 1, y: 2, z: 3 }),
      linvel: () => ({ x: 4, y: 5, z: 6 }),
      setLinvel: () => undefined,
      setRotation: () => undefined,
      setAngvel: () => undefined,
    };

    expect(readShipPhysicsSnapshot(rigidBody as never)).toMatchObject({
      position: { x: 1, y: 2, z: 3 },
      linearVelocity: { x: 4, y: 5, z: 6 },
    });

    expect(() =>
      applyShipPhysics(
        rigidBody as never,
        new Vector3(1, 0, 0),
        new Quaternion(),
      ),
    ).not.toThrow();
  });

  it("can reset runtime motion directly", () => {
    const runtime = createShipRuntimeState();
    runtime.velocity.set(1, 2, 3);
    runtime.angularVelocity = 1;
    runtime.pitchAngularVelocity = 2;

    resetShipRuntimeMotion(runtime);

    expect(runtime.velocity.toArray()).toEqual([0, 0, 0]);
    expect(runtime.angularVelocity).toBe(0);
    expect(runtime.pitchAngularVelocity).toBe(0);
  });
});
