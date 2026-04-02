import { describe, expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import {
  buildProjectileDecalPlacement,
  calculateDirectHitDamage,
  calculateExplosionDamage,
  calculateExplosionImpulse,
  calculateLaserKnockbackImpulse,
  findHitControllerId,
} from "../../../../src/game/engine/projectiles/impact";

describe("air-capture projectile impact engine", () => {
  it("walks scene parents to resolve the authoritative hit player", () => {
    const shipRoot = new Object3D();
    shipRoot.userData.controllerId = "pilot-7";
    const mesh = new Object3D();
    shipRoot.add(mesh);

    expect(findHitControllerId(mesh)).toBe("pilot-7");
  });

  it("builds decals as pure geometry data", () => {
    const decal = buildProjectileDecalPlacement(
      new Vector3(1, 2, 3),
      new Vector3(0, 1, 0),
    );

    expect(decal.position).toEqual([1, 2.01, 3]);
    expect(decal.normal.toArray()).toEqual([0, 1, 0]);
  });

  it("keeps laser knockback independent from the entity component", () => {
    const impulse = calculateLaserKnockbackImpulse(new Vector3(0, 0, -2), 300);

    expect(impulse.toArray()).toEqual([0, 0, -300]);
  });

  it("calculates explosion falloff explicitly", () => {
    expect(calculateExplosionDamage(0, 5, 50)).toBe(50);
    expect(calculateExplosionDamage(2.5, 5, 50)).toBe(25);
    expect(calculateExplosionDamage(6, 5, 50)).toBe(0);
  });

  it("treats direct hits as lethal regardless of remaining health", () => {
    expect(calculateDirectHitDamage(100)).toBe(100);
    expect(calculateDirectHitDamage(37)).toBe(37);
  });

  it("returns zero impulse outside the blast radius", () => {
    const impulse = calculateExplosionImpulse({
      explosionOrigin: new Vector3(0, 0, 0),
      targetPosition: new Vector3(10, 0, 0),
      radius: 5,
      maxForce: 500,
    });

    expect(impulse.length()).toBe(0);
  });
});
