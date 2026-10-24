/**
 * Ships: flight, weapons, abilities, damage, death and respawn, one step at
 * a time on the simulation's clock.
 */
import { Euler, MathUtils, Vector3 } from "three";
import { ABILITY_DEFINITIONS, type AbilityId } from "../abilities/definitions";
import type { GameLoopInput } from "../contracts/input";
import { stepShipAbility } from "../engine/ships/abilities";
import {
  advanceShipRotation,
  calculateShipPitchVelocity,
  calculateShipVelocity,
  calculateShipVerticalVelocityDelta,
  calculateShipWingRoll,
  calculateShipYawVelocity,
  resolveShipControls,
  SHIP_ENGINE_CONFIG,
  smoothShipInput,
  stepAirControlEnergy,
} from "../engine/ships/flight";
import {
  buildShipRespawnPosition,
  getShipDeathPosition,
  scheduleShipRespawn,
  shouldRespawnShip,
} from "../engine/ships/lifecycle";
import {
  buildShipLaserShots,
  shouldFireShipWeapons,
} from "../engine/ships/weapons";
import { reduceDropFlagAtPosition } from "../stores/match/capture-the-flag-store-state";
import { teleportShip } from "./physics";
import {
  MAX_HEALTH,
  nextEntityId,
  type AirCaptureSim,
  type Emit,
  type ShipSim,
} from "./state";

const HEALTH_PACK_AMOUNT = 25;
const SPEED_BOOST_MULTIPLIER = 2;
const ROCKET_UPWARD_OFFSET = 0.9;

/** Keeps the pose a step starts from, so drawing can interpolate to the next. */
export const beginShipStep = (ship: ShipSim): void => {
  ship.previousPosition.copy(ship.position);
  ship.previousRotation.copy(ship.rotation);
};

/** Reads where the physics step moved the ship. */
export const readShipPosition = (ship: ShipSim): void => {
  const position = ship.body.translation();
  ship.position.set(position.x, position.y, position.z);
};

/** Puts a ship back to rest, as at the start of a round. */
export const resetShipMotion = (ship: ShipSim): void => {
  ship.rotation.identity();
  ship.previousRotation.identity();
  ship.angularVelocity = 0;
  ship.pitchAngularVelocity = 0;
  ship.smoothedInput = { x: 0, y: 0 };
  ship.wingRoll = 0;
  ship.thrusting = false;
};

const deactivateAbility = (ship: ShipSim): void => {
  if (ship.activeAbility?.id === "speed_boost") ship.speedMultiplier = 1;
  ship.activeAbility = null;
};

/** Takes a pickup's ability into the ship's slot, ending any running one. */
export const collectAbility = (ship: ShipSim, abilityId: AbilityId): void => {
  const definition = ABILITY_DEFINITIONS[abilityId];
  deactivateAbility(ship);
  ship.queuedAbility = {
    id: definition.id,
    name: definition.name,
    icon: definition.icon,
    duration: definition.duration,
    startTime: null,
  };
};

const fireRocket = (sim: AirCaptureSim, ship: ShipSim): void => {
  const forward = new Vector3(0, 0, -1).applyQuaternion(ship.rotation);
  const up = new Vector3(0, 1, 0).applyQuaternion(ship.rotation);
  const position = ship.position
    .clone()
    .addScaledVector(up, ROCKET_UPWARD_OFFSET);
  const id = nextEntityId(sim, `${ship.controllerId}-rocket`);
  sim.rockets.set(id, {
    id,
    controllerId: ship.controllerId,
    previousPosition: position.clone(),
    position,
    direction: forward,
    age: 0,
    detonate: false,
  });
};

const activateAbility = (
  sim: AirCaptureSim,
  ship: ShipSim,
  abilityId: AbilityId,
): void => {
  const queued = ship.queuedAbility;
  if (!queued || queued.id !== abilityId) return;
  deactivateAbility(ship);
  if (abilityId === "speed_boost")
    ship.speedMultiplier = SPEED_BOOST_MULTIPLIER;
  else if (abilityId === "health_pack")
    ship.health = Math.min(MAX_HEALTH, ship.health + HEALTH_PACK_AMOUNT);
  else fireRocket(sim, ship);
  ship.queuedAbility = null;
  ship.activeAbility =
    queued.duration > 0 ? { ...queued, startTime: sim.time } : null;
};

const activeRocketOf = (sim: AirCaptureSim, controllerId: string) => {
  for (const rocket of sim.rockets.values())
    if (rocket.controllerId === controllerId) return rocket;
  return null;
};

/** Ends a timed ability once its time is up. */
export const expireAbility = (sim: AirCaptureSim, ship: ShipSim): void => {
  const active = ship.activeAbility;
  if (
    active &&
    active.startTime !== null &&
    sim.time - active.startTime >= active.duration
  )
    deactivateAbility(ship);
};

/** Flies one live ship for one step from its input. */
export const flyShip = (
  sim: AirCaptureSim,
  ship: ShipSim,
  input: GameLoopInput,
  delta: number,
  emit: Emit,
): void => {
  const linearVelocity = ship.body.linvel();
  ship.smoothedInput = smoothShipInput(ship.smoothedInput, input.vector, delta);
  const controls = resolveShipControls(
    ship.position.y,
    linearVelocity.y,
    ship.smoothedInput,
    ship.flight,
  );
  ship.thrusting = controls.isThrusting;

  stepShipAbility({
    controllerId: ship.controllerId,
    abilityPressed: input.ability,
    wasAbilityPressed: ship.lastAbilityPressed,
    currentAbility: ship.activeAbility ?? ship.queuedAbility,
    delta,
    activateAbility: (_controllerId, abilityId) =>
      activateAbility(sim, ship, abilityId),
    getActiveRocketId: (controllerId) =>
      activeRocketOf(sim, controllerId)?.id ?? null,
    requestDetonateRocket: (id) => {
      const rocket = sim.rockets.get(id);
      if (rocket) rocket.detonate = true;
    },
    updateActiveAbilities: () => {},
    playSound: (sound) => emit({ type: "sound", sound }),
    sendHaptic: (pattern, controllerId) =>
      emit({ type: "haptic", controllerId, pattern }),
  });
  ship.lastAbilityPressed = input.ability;

  if (
    shouldFireShipWeapons({
      actionPressed: input.action,
      wasActionPressed: ship.lastActionPressed,
      time: sim.time,
      lastShotAt: ship.lastShotAt,
    })
  ) {
    ship.lastShotAt = sim.time;
    emit({ type: "sound", sound: "laser_fire" });
    emit({ type: "haptic", controllerId: ship.controllerId, pattern: "light" });
    for (const shot of buildShipLaserShots({
      controllerId: ship.controllerId,
      shipWorldPosition: ship.position,
      shipRotation: ship.rotation,
      time: sim.time,
    })) {
      const id = nextEntityId(sim, `${ship.controllerId}-laser`);
      const position = new Vector3(...shot.position);
      sim.lasers.set(id, {
        id,
        controllerId: ship.controllerId,
        previousPosition: position.clone(),
        position,
        direction: shot.direction,
        age: 0,
      });
    }
  }
  ship.lastActionPressed = input.action;

  const forward = new Vector3(0, 0, -1).applyQuaternion(ship.rotation);
  const velocity = calculateShipVelocity(
    new Vector3(linearVelocity.x, linearVelocity.y, linearVelocity.z),
    forward,
    controls.thrustInput,
    ship.speedMultiplier,
    delta,
    controls.isInAir,
  );
  ship.angularVelocity = calculateShipYawVelocity(
    ship.angularVelocity,
    controls.turnInput,
    delta,
  );
  ship.pitchAngularVelocity = calculateShipPitchVelocity(
    controls.isInAir,
    ship.position.y,
    ship.rotation,
    ship.pitchAngularVelocity,
    controls.pitchInput,
    delta,
  );
  ship.rotation.copy(
    advanceShipRotation(
      ship.rotation,
      ship.angularVelocity,
      ship.pitchAngularVelocity,
      controls.isInAir,
      delta,
    ),
  );
  const pitch = new Euler().setFromQuaternion(ship.rotation, "YXZ").x;
  ship.flight = stepAirControlEnergy(ship.flight, controls, pitch, delta);
  velocity.y += calculateShipVerticalVelocityDelta(
    controls.isInAir,
    ship.position.y,
    velocity.y,
    pitch,
    Math.max(0, velocity.dot(forward)),
    delta,
  );
  ship.body.setLinvel(velocity, true);
  ship.body.setRotation(ship.rotation, true);
  ship.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

  ship.wingRoll = calculateShipWingRoll(
    ship.wingRoll,
    controls.turnInput,
    delta,
  );
  ship.thrustVisual = MathUtils.lerp(
    ship.thrustVisual,
    controls.targetThrustVisual,
    0.15,
  );
};

/** Ships at zero health explode, drop any flag, and come back at their base. */
export const resolveDeathsAndRespawns = (
  sim: AirCaptureSim,
  emit: Emit,
): void => {
  for (const ship of sim.ships.values()) {
    if (!ship.dead && ship.health <= 0) {
      ship.dead = true;
      ship.thrusting = false;
      ship.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ship.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      ship.body.setEnabled(false);
      const position = getShipDeathPosition(ship.position);
      sim.ctf = reduceDropFlagAtPosition(sim.ctf, ship.controllerId, position);
      ship.respawnAt = scheduleShipRespawn(sim.time);
      emit({ type: "ship-destroyed", position });
      emit({ type: "sound", sound: "explosion" });
    } else if (ship.dead && shouldRespawnShip(sim.time, ship.respawnAt)) {
      const team = sim.ctf.playerTeams[ship.controllerId] ?? ship.teamId;
      const position = buildShipRespawnPosition(sim.ctf.basePositions[team]);
      teleportShip(ship.body, position);
      ship.position.set(...position);
      ship.previousPosition.copy(ship.position);
      resetShipMotion(ship);
      ship.health = MAX_HEALTH;
      ship.dead = false;
      ship.respawnAt = 0;
    }
  }
};

/** Where a ship hovers when it first appears at its base. */
export const spawnPositionAt = (
  base: [number, number, number],
  index: number,
): [number, number, number] => {
  const angle = (index / 4) * Math.PI * 2;
  return [
    base[0] + Math.cos(angle) * 8,
    SHIP_ENGINE_CONFIG.HOVER_HEIGHT,
    base[2] + Math.sin(angle) * 8,
  ];
};
