/**
 * The arena's physics world: ground, obstacle blocks and ship bodies, built
 * from the arena layout rather than from what the scene draws, so the match
 * runs the same in a browser and headless.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { ARENA_RADIUS } from "../constants";
import { AIR_CAPTURE_ARENA_OBSTACLES } from "../prefabs/arena/layout";

await RAPIER.init();

const SHIP_COLLIDER_HALF_HEIGHT = 1.5;
const SHIP_COLLIDER_RADIUS = 1.8;
/** The sphere weapons hit, larger than the body that collides. */
const SHIP_HITBOX_RADIUS = 3.8;
export const SHIP_COLLIDER_CENTER_Y = 1.8;
const SHIP_LINEAR_DAMPING = 0.5;

export interface ArenaPhysics {
  world: RAPIER.World;
  /** Weapon hitbox collider handle to the ship it belongs to. */
  hitboxes: Map<number, string>;
  /** Body collider handle to the ship it belongs to; weapons pass through these. */
  hulls: Map<number, string>;
}

export interface ProjectileHit {
  point: Vector3;
  normal: Vector3;
  /** The ship hit, or null for an obstacle or the ground. */
  controllerId: string | null;
}

export const createArenaPhysics = (stepSeconds: number): ArenaPhysics => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = stepSeconds;
  const extent = ARENA_RADIUS * 1.5;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(extent, 0.05, extent).setTranslation(
      0,
      -0.05,
      0,
    ),
  );
  for (const obstacle of AIR_CAPTURE_ARENA_OBSTACLES) {
    const [x, y, z] = obstacle.position;
    const half = Math.sin(obstacle.rotationY / 2);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        obstacle.size[0] / 2,
        obstacle.size[1] / 2,
        obstacle.size[2] / 2,
      )
        .setTranslation(x, y, z)
        .setRotation({
          x: 0,
          y: half,
          z: 0,
          w: Math.cos(obstacle.rotationY / 2),
        }),
    );
  }
  return { world, hitboxes: new Map(), hulls: new Map() };
};

export const addShipBody = (
  physics: ArenaPhysics,
  controllerId: string,
  position: [number, number, number],
): RAPIER.RigidBody => {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...position)
      .lockRotations()
      .setLinearDamping(SHIP_LINEAR_DAMPING),
  );
  const hull = physics.world.createCollider(
    RAPIER.ColliderDesc.capsule(
      SHIP_COLLIDER_HALF_HEIGHT,
      SHIP_COLLIDER_RADIUS,
    ).setTranslation(0, SHIP_COLLIDER_CENTER_Y, 0),
    body,
  );
  const hitbox = physics.world.createCollider(
    RAPIER.ColliderDesc.ball(SHIP_HITBOX_RADIUS)
      .setTranslation(0, SHIP_COLLIDER_CENTER_Y, 0)
      .setSensor(true)
      .setDensity(0),
    body,
  );
  physics.hulls.set(hull.handle, controllerId);
  physics.hitboxes.set(hitbox.handle, controllerId);
  return body;
};

export const removeShipBody = (
  physics: ArenaPhysics,
  body: RAPIER.RigidBody,
): void => {
  for (let index = 0; index < body.numColliders(); index += 1) {
    const handle = body.collider(index).handle;
    physics.hitboxes.delete(handle);
    physics.hulls.delete(handle);
  }
  physics.world.removeRigidBody(body);
};

/** Places a ship at a spot with no motion left over. */
export const teleportShip = (
  body: RAPIER.RigidBody,
  position: [number, number, number],
): void => {
  body.setEnabled(true);
  body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
};

/** The first ship hitbox, obstacle or ground a projectile meets between two points. */
export const castProjectile = (
  physics: ArenaPhysics,
  from: Vector3,
  to: Vector3,
  shooterId: string,
): ProjectileHit | null => {
  const delta = to.clone().sub(from);
  const distance = delta.length();
  if (distance <= 0) return null;
  const direction = delta.divideScalar(distance);
  const hit = physics.world.castRayAndGetNormal(
    new RAPIER.Ray(from, direction),
    distance,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    (collider) =>
      !physics.hulls.has(collider.handle) &&
      physics.hitboxes.get(collider.handle) !== shooterId,
  );
  if (!hit) return null;
  return {
    point: from.clone().addScaledVector(direction, hit.timeOfImpact),
    normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    controllerId: physics.hitboxes.get(hit.collider.handle) ?? null,
  };
};

/** Keeps every ship inside the arena's forcefield. */
export const enforceArenaBounds = (physics: ArenaPhysics): void => {
  physics.world.bodies.forEach((body) => {
    if (!body.isDynamic()) return;
    const position = body.translation();
    if (Math.hypot(position.x, position.z) <= ARENA_RADIUS) return;
    const clamped = new Vector3(position.x, position.y, position.z).setLength(
      ARENA_RADIUS - 1,
    );
    body.setTranslation({ x: clamped.x, y: position.y, z: clamped.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  });
};
