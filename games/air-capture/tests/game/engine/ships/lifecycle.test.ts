import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  buildShipRespawnPosition,
  getShipDeathPosition,
  scheduleShipRespawn,
  shouldRespawnShip,
} from "../../../../src/game/engine/ships/lifecycle";

describe("air-capture ship lifecycle engine", () => {
  it("derives death position at hover level", () => {
    expect(getShipDeathPosition(new Vector3(10, 8, -2))).toEqual([10, 3, -2]);
  });

  it("builds respawn positions above the team base", () => {
    expect(buildShipRespawnPosition([1, 2, 3])).toEqual([1, 7, 3]);
  });

  it("keeps respawn timing explicit", () => {
    expect(scheduleShipRespawn(10)).toBe(12);
    expect(shouldRespawnShip(12, 12)).toBe(true);
    expect(shouldRespawnShip(11.9, 12)).toBe(false);
  });
});
