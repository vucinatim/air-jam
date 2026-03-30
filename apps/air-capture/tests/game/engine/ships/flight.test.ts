import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import {
  SHIP_ENGINE_CONFIG,
  advanceShipRotation,
  calculateShipPitchVelocity,
  calculateShipVelocity,
  calculateShipVerticalVelocityDelta,
  calculateShipWingRoll,
  calculateShipYawVelocity,
  resolveShipControls,
  smoothShipInput,
} from "../../../../src/game/engine/ships/flight";

describe("air-capture ship flight engine", () => {
  it("smooths stick input without store coupling", () => {
    const result = smoothShipInput({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.05);

    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(1);
    expect(result.y).toBeLessThan(0);
    expect(result.y).toBeGreaterThan(-1);
  });

  it("switches control mapping between hover and flight modes", () => {
    expect(resolveShipControls(5, { x: 0.25, y: -0.5 })).toEqual({
      isInAir: false,
      thrustInput: -0.5,
      turnInput: 0.25,
      isThrusting: false,
      targetThrustVisual: 0.5,
    });

    expect(resolveShipControls(7, { x: 0.25, y: -0.5 })).toEqual({
      isInAir: true,
      thrustInput: 1,
      turnInput: 0.25,
      isThrusting: true,
      targetThrustVisual: 1,
    });
  });

  it("keeps flight stepping pure and bounded", () => {
    const forward = new Vector3(0, 0, -1);
    const velocity = calculateShipVelocity(
      new Vector3(),
      forward,
      1,
      1,
      1 / 60,
    );

    expect(velocity.z).toBeLessThan(0);
    expect(calculateShipYawVelocity(0, 1, 1 / 60)).toBeLessThan(0);
    expect(calculateShipWingRoll(0, 1, 1 / 60)).toBeLessThan(0);
  });

  it("clamps pitch in air and levels on the ground", () => {
    const steepRotation = new Quaternion().setFromEuler(
      new Euler(SHIP_ENGINE_CONFIG.MAX_PITCH, 0, 0),
    );
    const airborneRotation = advanceShipRotation(
      steepRotation,
      0,
      100,
      true,
      1 / 60,
    );
    const groundedRotation = advanceShipRotation(
      steepRotation,
      0,
      0,
      false,
      1 / 10,
    );

    const airbornePitch = new Euler().setFromQuaternion(airborneRotation, "YXZ").x;
    const groundedPitch = new Euler().setFromQuaternion(groundedRotation, "YXZ").x;

    expect(airbornePitch).toBeCloseTo(SHIP_ENGINE_CONFIG.MAX_PITCH, 10);
    expect(Math.abs(groundedPitch)).toBeLessThan(SHIP_ENGINE_CONFIG.MAX_PITCH);
  });

  it("keeps launch arcs and hover correction explicit", () => {
    expect(
      calculateShipVerticalVelocityDelta(true, 12, 11, 0, 1 / 60),
    ).toBe(0);

    expect(
      calculateShipVerticalVelocityDelta(false, 4, -3, 0, 1 / 60),
    ).toBe(3);
  });

  it("derives pitch from actual flight path instead of component state", () => {
    const pitchVelocity = calculateShipPitchVelocity(
      true,
      12,
      -5,
      20,
      new Quaternion(),
      0,
      1 / 60,
    );

    expect(pitchVelocity).toBeLessThan(0);
  });
});
