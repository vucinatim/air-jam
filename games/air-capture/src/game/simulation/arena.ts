/**
 * What ships touch in the arena: pickups, jump pads, flags and bases. Each
 * reacts once when a ship enters it, as the scene's sensors did.
 */
import { getRandomAbilityByRarity } from "../abilities/definitions";
import { ARENA_RADIUS, JUMP_FORCE, JUMP_PAD_RADIUS } from "../constants";
import { generateRandomBasePositions } from "../domain/capture-the-flag";
import { TEAM_IDS, type TeamId } from "../domain/team";
import { AIR_CAPTURE_ARENA_JUMP_PADS } from "../prefabs/arena/layout";
import {
  transitionHandleBaseEntry,
  transitionTryPickupFlag,
} from "../stores/match/capture-the-flag-store-state";
import { SHIP_COLLIDER_CENTER_Y } from "./physics";
import { collectAbility } from "./ships";
import {
  nextEntityId,
  type AirCaptureSim,
  type Emit,
  type ShipSim,
} from "./state";

const SHIP_RADIUS = 1.8;
const SHIP_REACH_BELOW = 3.3 - SHIP_COLLIDER_CENTER_Y;
const SHIP_REACH_ABOVE = SHIP_COLLIDER_CENTER_Y + 3.3;

const COLLECTIBLE = {
  interval: 3,
  max: 20,
  height: 5,
  minDistance: 20,
  maxDistance: ARENA_RADIUS - 10,
  halfWidth: 1.5,
  below: 1.5,
  above: 8,
};
const JUMP_PAD = { height: 8, cooldown: 0.5 };
const FLAG = { radius: 4.5, height: 6 };
const BASE = { radius: 10, height: 10 };

/** Whether a ship's body reaches into an upright cylinder. */
const touchesCylinder = (
  ship: ShipSim,
  [x, y, z]: [number, number, number],
  radius: number,
  height: number,
): boolean =>
  Math.hypot(ship.position.x - x, ship.position.z - z) < radius + SHIP_RADIUS &&
  ship.position.y + SHIP_REACH_ABOVE > y &&
  ship.position.y - SHIP_REACH_BELOW < y + height;

/** Calls `onEnter` for ships that started touching since the last step. */
const trackContacts = (
  contacts: Set<string>,
  ships: Iterable<ShipSim>,
  touches: (ship: ShipSim) => boolean,
  onEnter: (ship: ShipSim) => void,
): void => {
  for (const ship of ships) {
    const touching = !ship.dead && touches(ship);
    if (touching && !contacts.has(ship.controllerId)) {
      contacts.add(ship.controllerId);
      onEnter(ship);
    } else if (!touching) contacts.delete(ship.controllerId);
  }
};

const spawnCollectibles = (sim: AirCaptureSim, random: () => number) => {
  if (
    sim.collectibles.size >= COLLECTIBLE.max ||
    sim.time - sim.lastCollectibleSpawnAt < COLLECTIBLE.interval
  )
    return;
  const angle = random() * Math.PI * 2;
  const distance =
    COLLECTIBLE.minDistance +
    random() * (COLLECTIBLE.maxDistance - COLLECTIBLE.minDistance);
  const height = COLLECTIBLE.height + random() * 2;
  const ability = getRandomAbilityByRarity(random);
  if (!ability) return;
  const id = nextEntityId(sim, "collectible");
  sim.collectibles.set(id, {
    id,
    abilityId: ability.id,
    position: [Math.cos(angle) * distance, height, Math.sin(angle) * distance],
    spawnedAt: sim.time,
  });
  sim.lastCollectibleSpawnAt = sim.time;
};

const takeCollectibles = (sim: AirCaptureSim, emit: Emit) => {
  for (const collectible of sim.collectibles.values()) {
    const [x, y, z] = collectible.position;
    const taker = [...sim.ships.values()].find(
      (ship) =>
        !ship.dead &&
        Math.abs(ship.position.x - x) < COLLECTIBLE.halfWidth + SHIP_RADIUS &&
        Math.abs(ship.position.z - z) < COLLECTIBLE.halfWidth + SHIP_RADIUS &&
        ship.position.y + SHIP_REACH_ABOVE > y - COLLECTIBLE.below &&
        ship.position.y - SHIP_REACH_BELOW < y + COLLECTIBLE.above,
    );
    if (!taker) continue;
    collectAbility(taker, collectible.abilityId);
    sim.collectibles.delete(collectible.id);
    emit({ type: "sound", sound: "powerup" });
    emit({
      type: "haptic",
      controllerId: taker.controllerId,
      pattern: "success",
    });
    emit({
      type: "collectible-taken",
      abilityId: collectible.abilityId,
      position: collectible.position,
    });
  }
};

const launchFromJumpPads = (sim: AirCaptureSim, emit: Emit) => {
  for (const pad of AIR_CAPTURE_ARENA_JUMP_PADS) {
    let contacts = sim.jumpPadContacts.get(pad.id);
    if (!contacts) sim.jumpPadContacts.set(pad.id, (contacts = new Set()));
    trackContacts(
      contacts,
      sim.ships.values(),
      (ship) =>
        touchesCylinder(ship, pad.position, JUMP_PAD_RADIUS, JUMP_PAD.height),
      (ship) => {
        if (sim.time < (sim.jumpPadCooldownUntil.get(pad.id) ?? 0)) return;
        const velocity = ship.body.linvel();
        ship.body.setLinvel(
          { x: velocity.x, y: JUMP_FORCE, z: velocity.z },
          true,
        );
        sim.jumpPadCooldownUntil.set(pad.id, sim.time + JUMP_PAD.cooldown);
        emit({ type: "sound", sound: "jump_pad" });
        emit({ type: "jump-pad", padId: pad.id });
      },
    );
  }
};

const touchFlags = (sim: AirCaptureSim, emit: Emit) => {
  for (const teamId of TEAM_IDS) {
    trackContacts(
      sim.flagContacts[teamId],
      sim.ships.values(),
      (ship) => {
        const flag = sim.ctf.flags[teamId];
        return (
          flag.status !== "carried" &&
          touchesCylinder(ship, flag.position, FLAG.radius, FLAG.height)
        );
      },
      (ship) => {
        const result = transitionTryPickupFlag(
          sim.ctf,
          ship.controllerId,
          teamId,
        );
        sim.ctf = result.state;
        if (result.outcome === "returnedFriendlyFlag") {
          emit({ type: "sound", sound: "success" });
          emit({
            type: "haptic",
            controllerId: ship.controllerId,
            pattern: "success",
          });
        } else if (result.outcome === "pickedUpEnemyFlag") {
          emit({ type: "sound", sound: "pickup_flag" });
          emit({
            type: "haptic",
            controllerId: ship.controllerId,
            pattern: "medium",
          });
        }
        if (result.outcome !== "none") emit({ type: "flag-touched", teamId });
      },
    );
  }
};

const enterBases = (sim: AirCaptureSim, random: () => number, emit: Emit) => {
  for (const teamId of TEAM_IDS) {
    trackContacts(
      sim.baseOccupants[teamId],
      sim.ships.values(),
      (ship) =>
        touchesCylinder(
          ship,
          sim.ctf.basePositions[teamId],
          BASE.radius,
          BASE.height,
        ),
      (ship) => {
        emit({ type: "sound", sound: "touch_base" });
        const result = transitionHandleBaseEntry(
          sim.ctf,
          ship.controllerId,
          teamId,
          generateRandomBasePositions(random),
        );
        sim.ctf = result.state;
        if (result.outcome === "scoredPoint")
          emit({ type: "sound", sound: "score_point" });
        else if (result.outcome === "returnedFriendlyFlag")
          emit({ type: "sound", sound: "success" });
        else if (result.outcome === "pickedUpEnemyFlag")
          emit({ type: "sound", sound: "pickup_flag" });
      },
    );
  }
};

export const stepArena = (
  sim: AirCaptureSim,
  random: () => number,
  emit: Emit,
): void => {
  spawnCollectibles(sim, random);
  takeCollectibles(sim, emit);
  launchFromJumpPads(sim, emit);
  touchFlags(sim, emit);
  enterBases(sim, random, emit);
};

export const emptyTeamSets = (): Record<TeamId, Set<string>> =>
  Object.fromEntries(
    TEAM_IDS.map((teamId) => [teamId, new Set<string>()]),
  ) as Record<TeamId, Set<string>>;
