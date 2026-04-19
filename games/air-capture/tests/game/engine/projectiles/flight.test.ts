import { Euler, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  advanceProjectilePosition,
  buildProjectileRaySegment,
  getProjectileRotation,
  shouldExpireProjectile,
} from "../../../../src/game/engine/projectiles/flight";

describe("air-capture projectile flight helpers", () => {
  it("builds a quaternion aligned with projectile travel", () => {
    const rotation = getProjectileRotation(new Vector3(1, 0, 0));
    const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);

    expect(forward.x).toBeCloseTo(1, 5);
    expect(new Euler().setFromQuaternion(rotation).y).toBeDefined();
  });

  it("advances projectile positions from normalized direction", () => {
    const result = advanceProjectilePosition(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -2),
      10,
      0.5,
    );

    expect(result.normalizedDirection.toArray()).toEqual([0, 0, -1]);
    expect(result.nextPosition.toArray()).toEqual([0, 0, -5]);
  });

  it("builds ray segments only when travel happened", () => {
    expect(
      buildProjectileRaySegment(new Vector3(1, 1, 1), new Vector3(1, 1, 1)),
    ).toBeNull();

    const segment = buildProjectileRaySegment(
      new Vector3(0, 0, 0),
      new Vector3(0, 3, 4),
    );
    expect(segment?.distance).toBe(5);
    expect(segment?.direction.y).toBeCloseTo(0.6, 10);
    expect(segment?.direction.z).toBeCloseTo(0.8, 10);
  });

  it("expires projectiles once they exceed their lifetime", () => {
    expect(shouldExpireProjectile(2.1, 2)).toBe(true);
    expect(shouldExpireProjectile(2, 2)).toBe(false);
  });
});
