import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import {
  buildShipLaserShots,
  shouldFireShipWeapons,
} from "../../../../src/game/engine/ships/weapons";

describe("air-capture ship weapon engine", () => {
  it("fires on edge press and on held repeat cadence", () => {
    expect(
      shouldFireShipWeapons({
        actionPressed: true,
        wasActionPressed: false,
        time: 1,
        lastShotAt: 0.95,
      }),
    ).toBe(true);

    expect(
      shouldFireShipWeapons({
        actionPressed: true,
        wasActionPressed: true,
        time: 1,
        lastShotAt: 0.95,
      }),
    ).toBe(false);

    expect(
      shouldFireShipWeapons({
        actionPressed: true,
        wasActionPressed: true,
        time: 1.3,
        lastShotAt: 1,
      }),
    ).toBe(true);
  });

  it("builds mirrored laser shots from the ship transform", () => {
    const shots = buildShipLaserShots({
      controllerId: "pilot-1",
      shipWorldPosition: new Vector3(10, 5, 0),
      shipRotation: new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0)),
      time: 42,
    });

    expect(shots).toHaveLength(2);
    expect(shots[0]?.id).toBe("pilot-1-42-L");
    expect(shots[1]?.id).toBe("pilot-1-42-R");
    expect(shots[0]?.position[2]).toBeGreaterThan(shots[1]?.position[2]);
    expect(shots[0]?.direction.x).toBeCloseTo(-1, 5);
    expect(shots[1]?.direction.x).toBeCloseTo(-1, 5);
  });
});
