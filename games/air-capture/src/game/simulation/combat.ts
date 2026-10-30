/**
 * Lasers and rockets: flight, hits against ships and obstacles, damage,
 * knockback and blasts, on the simulation's clock.
 */
import type { Vector3 } from "three";
import {
  advanceProjectilePosition,
  shouldExpireProjectile,
} from "../engine/projectiles/flight";
import {
  buildProjectileDecalPlacement,
  calculateDirectHitDamage,
  calculateExplosionDamage,
  calculateExplosionImpulse,
  calculateLaserKnockbackImpulse,
} from "../engine/projectiles/impact";
import { castProjectile, type ProjectileHit } from "./physics";
import type { AirCaptureSim, Emit, RocketSim } from "./state";

const ROCKET_RADIUS = 18;

const toTuple = (vector: Vector3): [number, number, number] => [
  vector.x,
  vector.y,
  vector.z,
];

const emitImpact = (hit: ProjectileHit, emit: Emit) => {
  const decal = buildProjectileDecalPlacement(hit.point, hit.normal);
  emit({
    type: "impact",
    position: decal.position,
    normal: toTuple(decal.normal),
  });
};

export const stepLasers = (
  sim: AirCaptureSim,
  delta: number,
  emit: Emit,
): void => {
  for (const laser of sim.lasers.values()) {
    const { normalizedDirection, nextPosition } = advanceProjectilePosition(
      laser.position,
      laser.direction,
      sim.settings.laserSpeed,
      delta,
    );
    const hit = castProjectile(
      sim.physics,
      laser.position,
      nextPosition,
      laser.controllerId,
    );
    if (hit) {
      const target = hit.controllerId ? sim.ships.get(hit.controllerId) : null;
      if (target) {
        target.health = Math.max(0, target.health - sim.settings.laserDamage);
        emit({ type: "sound", sound: "hit" });
        emit({
          type: "haptic",
          controllerId: target.controllerId,
          pattern: "heavy",
        });
        emit({
          type: "haptic",
          controllerId: laser.controllerId,
          pattern: "success",
        });
        const impulse = calculateLaserKnockbackImpulse(
          normalizedDirection,
          sim.settings.laserKnockback,
        );
        target.body.applyImpulse(impulse, true);
      }
      emitImpact(hit, emit);
      sim.lasers.delete(laser.id);
      continue;
    }
    laser.previousPosition.copy(laser.position);
    laser.position.copy(nextPosition);
    laser.age += delta;
    if (shouldExpireProjectile(laser.age, sim.settings.laserLifetime))
      sim.lasers.delete(laser.id);
  }
};

const explode = (
  sim: AirCaptureSim,
  rocket: RocketSim,
  origin: Vector3,
  directTargetId: string | null,
  emit: Emit,
) => {
  for (const ship of sim.ships.values()) {
    if (ship.controllerId === rocket.controllerId || ship.dead) continue;
    const distance = origin.distanceTo(ship.position);
    if (distance > ROCKET_RADIUS) continue;
    ship.health = Math.max(
      0,
      ship.health -
        (ship.controllerId === directTargetId
          ? calculateDirectHitDamage(ship.health)
          : calculateExplosionDamage(
              distance,
              ROCKET_RADIUS,
              sim.settings.rocketDamage,
            )),
    );
    ship.body.applyImpulse(
      calculateExplosionImpulse({
        explosionOrigin: origin,
        targetPosition: ship.position,
        radius: ROCKET_RADIUS,
        maxForce: sim.settings.rocketKnockback,
      }),
      true,
    );
  }
  emit({ type: "rocket-exploded", position: toTuple(origin) });
  emit({ type: "sound", sound: "rocket_explosion" });
};

export const stepRockets = (
  sim: AirCaptureSim,
  delta: number,
  emit: Emit,
): void => {
  for (const rocket of sim.rockets.values()) {
    if (rocket.detonate) {
      explode(sim, rocket, rocket.position, null, emit);
      sim.rockets.delete(rocket.id);
      continue;
    }
    const { nextPosition } = advanceProjectilePosition(
      rocket.position,
      rocket.direction,
      sim.settings.rocketSpeed,
      delta,
    );
    const hit = castProjectile(
      sim.physics,
      rocket.position,
      nextPosition,
      rocket.controllerId,
    );
    if (hit) {
      // A rocket bursts on ships; against walls it only scorches.
      if (hit.controllerId)
        explode(sim, rocket, hit.point, hit.controllerId, emit);
      else {
        emit({ type: "rocket-exploded", position: toTuple(hit.point) });
        emit({ type: "sound", sound: "rocket_explosion" });
      }
      emitImpact(hit, emit);
      sim.rockets.delete(rocket.id);
      continue;
    }
    rocket.previousPosition.copy(rocket.position);
    rocket.position.copy(nextPosition);
    rocket.age += delta;
    if (shouldExpireProjectile(rocket.age, sim.settings.rocketLifetime))
      sim.rockets.delete(rocket.id);
  }
};
