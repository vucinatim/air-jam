import { Euler, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
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
  stepAirControlEnergy,
} from "../../../../src/game/engine/ships/flight";
import type { PlayerFlightState } from "../../../../src/game/stores/players/flight-state-store";

const AIRBORNE_FLIGHT_STATE: PlayerFlightState = {
  mode: "airborne",
  airControlEnergy: 1,
  isAirControlDepleted: false,
};

describe("air-capture ship flight engine", () => {
  it("smooths stick input without store coupling", () => {
    const result = smoothShipInput({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.05);

    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(1);
    expect(result.y).toBeLessThan(0);
    expect(result.y).toBeGreaterThan(-1);
  });

  it("switches control mapping between hover and flight modes", () => {
    expect(
      resolveShipControls(5, 0, { x: 0.25, y: -0.5 }, AIRBORNE_FLIGHT_STATE),
    ).toEqual({
      mode: "grounded",
      isInAir: false,
      thrustInput: 0,
      turnInput: 0.25,
      pitchInput: 0,
      isThrusting: false,
      targetThrustVisual: 0,
    });

    expect(
      resolveShipControls(5, 0, { x: 0.25, y: 0.5 }, AIRBORNE_FLIGHT_STATE),
    ).toEqual({
      mode: "grounded",
      isInAir: false,
      thrustInput: 1,
      turnInput: 0.25,
      pitchInput: 0,
      isThrusting: true,
      targetThrustVisual: 1,
    });

    expect(
      resolveShipControls(7, 0, { x: 0.25, y: -0.5 }, AIRBORNE_FLIGHT_STATE),
    ).toEqual({
      mode: "airborne",
      isInAir: true,
      thrustInput: 1,
      turnInput: 0.25,
      pitchInput: -0.5,
      isThrusting: true,
      targetThrustVisual: 1,
    });

    expect(
      resolveShipControls(5, 8, { x: 0.1, y: 0.25 }, AIRBORNE_FLIGHT_STATE),
    ).toEqual({
      mode: "airborne",
      isInAir: true,
      thrustInput: 1,
      turnInput: 0.1,
      pitchInput: 0.25,
      isThrusting: true,
      targetThrustVisual: 1,
    });

    expect(
      resolveShipControls(
        7,
        0,
        { x: 0.25, y: -0.5 },
        {
          mode: "airborne",
          airControlEnergy: 0,
          isAirControlDepleted: true,
        },
      ),
    ).toEqual({
      mode: "airborne",
      isInAir: true,
      thrustInput: 1,
      turnInput: 0.25,
      pitchInput: SHIP_ENGINE_CONFIG.AIR_CONTROL_DEPLETED_DIVE_INPUT,
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
      false,
    );

    expect(velocity.z).toBeLessThan(0);
    expect(calculateShipYawVelocity(0, 1, 1 / 60)).toBeLessThan(0);
    expect(calculateShipWingRoll(0, 1, 1 / 60)).toBeLessThan(0);
  });

  it("clamps pitch in air and levels on the ground", () => {
    const steepRotation = new Quaternion().setFromEuler(
      new Euler(SHIP_ENGINE_CONFIG.MAX_PITCH_UP, 0, 0),
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

    const airbornePitch = new Euler().setFromQuaternion(
      airborneRotation,
      "YXZ",
    ).x;
    const groundedPitch = new Euler().setFromQuaternion(
      groundedRotation,
      "YXZ",
    ).x;

    expect(airbornePitch).toBeCloseTo(SHIP_ENGINE_CONFIG.MAX_PITCH_UP, 10);
    expect(Math.abs(groundedPitch)).toBeLessThan(
      SHIP_ENGINE_CONFIG.MAX_PITCH_UP,
    );
  });

  it("keeps launch arcs and hover correction explicit", () => {
    expect(
      calculateShipVerticalVelocityDelta(true, 12, 11, 0, 20, 1 / 60),
    ).toBeLessThanOrEqual(0);

    expect(calculateShipVerticalVelocityDelta(false, 4, -3, 0, 0, 1 / 60)).toBe(
      3,
    );
  });

  it("derives pitch velocity from player air control intent", () => {
    const pitchVelocity = calculateShipPitchVelocity(
      true,
      12,
      new Quaternion(),
      0,
      0.75,
      1 / 60,
    );

    expect(pitchVelocity).toBeGreaterThan(0);
  });

  it("drains upward air control and recharges when grounded", () => {
    const airborneEnergy = stepAirControlEnergy(
      {
        mode: "airborne",
        airControlEnergy: 1,
        isAirControlDepleted: false,
      },
      {
        mode: "airborne",
        isInAir: true,
        thrustInput: 1,
        turnInput: 0,
        pitchInput: 1,
        isThrusting: true,
        targetThrustVisual: 1,
      },
      SHIP_ENGINE_CONFIG.MAX_PITCH_UP,
      1,
    );

    const groundedEnergy = stepAirControlEnergy(
      {
        mode: "airborne",
        airControlEnergy: 0.2,
        isAirControlDepleted: true,
      },
      {
        mode: "grounded",
        isInAir: false,
        thrustInput: 0,
        turnInput: 0,
        pitchInput: 0,
        isThrusting: false,
        targetThrustVisual: 0,
      },
      0,
      1,
    );

    expect(airborneEnergy.airControlEnergy).toBeLessThan(1);
    expect(groundedEnergy.airControlEnergy).toBe(1);
    expect(groundedEnergy.isAirControlDepleted).toBe(false);
  });

  it("depletes fully under sustained nose-up flight", () => {
    const depletedEnergy = stepAirControlEnergy(
      {
        mode: "airborne",
        airControlEnergy: 0.1,
        isAirControlDepleted: false,
      },
      {
        mode: "airborne",
        isInAir: true,
        thrustInput: 1,
        turnInput: 0,
        pitchInput: 0.8,
        isThrusting: true,
        targetThrustVisual: 1,
      },
      SHIP_ENGINE_CONFIG.MAX_PITCH_UP,
      1,
    );

    expect(depletedEnergy.airControlEnergy).toBe(0);
    expect(depletedEnergy.isAirControlDepleted).toBe(true);
  });

  it("lets upward pitch feed thrust into a climbing arc", () => {
    const upwardForward = new Vector3(0, 0.45, -0.89).normalize();
    const airborneVelocity = calculateShipVelocity(
      new Vector3(0, 0, -12),
      upwardForward,
      1,
      1,
      1 / 60,
      true,
    );

    expect(airborneVelocity.y).toBeGreaterThan(0);
  });

  it("adds glide lift from forward speed while still allowing descent", () => {
    const climbDelta = calculateShipVerticalVelocityDelta(
      true,
      12,
      0,
      SHIP_ENGINE_CONFIG.MAX_PITCH_UP * 0.8,
      24,
      1 / 60,
    );
    const diveDelta = calculateShipVerticalVelocityDelta(
      true,
      12,
      0,
      -SHIP_ENGINE_CONFIG.MAX_PITCH_DOWN * 0.8,
      24,
      1 / 60,
    );

    expect(climbDelta).toBeGreaterThan(diveDelta);
    expect(diveDelta).toBeLessThan(0);
  });
});
