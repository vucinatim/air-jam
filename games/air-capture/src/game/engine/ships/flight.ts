import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { AirCaptureSettings } from "../../contracts/settings";
export type FlightMode = "grounded" | "airborne";
export interface PlayerFlightState {
  mode: FlightMode;
  airControlEnergy: number;
  isAirControlDepleted: boolean;
}
export const createPlayerFlightState = (): PlayerFlightState => ({
  mode: "grounded",
  airControlEnergy: 1,
  isAirControlDepleted: false,
});
export const SHIP_ENGINE_CONFIG = {
  HOVER_HEIGHT: 5,
  MAX_DIVE_GRAVITY: -15,
  MAX_LIFT: 3,
  AIR_MODE_THRESHOLD: 0.5,
  MAX_PITCH_UP: Math.PI / 3.2,
  MAX_PITCH_DOWN: Math.PI / 3.4,
  BANKING_ANGLE: Math.PI / 6,
  LEVELING_START_HEIGHT: 6,
  LEVELING_COMPLETE_HEIGHT: 1.0,
  AIR_CONTROL_ENERGY_MAX: 1,
  AIR_CONTROL_DEPLETED_DIVE_INPUT: -0.55,
  AIR_CONTROL_DEADZONE: 0.1,
  GROUND_THRUST_ACTIVATION_THRESHOLD: 0.14,
} as const;
export interface ShipInputVector {
  x: number;
  y: number;
}
export interface ShipControlState {
  mode: "grounded" | "airborne";
  isInAir: boolean;
  thrustInput: number;
  turnInput: number;
  pitchInput: number;
  isThrusting: boolean;
  targetThrustVisual: number;
}
export interface AirControlEnergyState {
  currentEnergy: number;
}
export function smoothShipInput(
  settings: AirCaptureSettings,
  currentInput: ShipInputVector,
  targetInput: ShipInputVector,
  delta: number,
): ShipInputVector {
  const smoothAlpha = 1 - Math.exp(-delta / settings.playerInputSmoothTime);
  return {
    x: MathUtils.lerp(currentInput.x, targetInput.x, smoothAlpha),
    y: MathUtils.lerp(currentInput.y, targetInput.y, smoothAlpha),
  };
}
export function resolveShipControls(
  settings: AirCaptureSettings,
  positionY: number,
  verticalVelocity: number,
  smoothedInput: ShipInputVector,
  flightState: PlayerFlightState,
): ShipControlState {
  const isInAir =
    positionY >
      SHIP_ENGINE_CONFIG.HOVER_HEIGHT + SHIP_ENGINE_CONFIG.AIR_MODE_THRESHOLD ||
    verticalVelocity > settings.airborneLaunchVelocityThreshold;
  const mode = isInAir ? "airborne" : "grounded";
  const clampedPitchInput = applyInputDeadzone(
    smoothedInput.y,
    SHIP_ENGINE_CONFIG.AIR_CONTROL_DEADZONE,
  );
  const pitchInput = isInAir
    ? flightState.isAirControlDepleted
      ? SHIP_ENGINE_CONFIG.AIR_CONTROL_DEPLETED_DIVE_INPUT
      : clampedPitchInput
    : 0;
  const thrustInput = isInAir
    ? 1.0
    : smoothedInput.y >= SHIP_ENGINE_CONFIG.GROUND_THRUST_ACTIVATION_THRESHOLD
      ? 1.0
      : 0;
  const turnInput = smoothedInput.x;
  return {
    mode,
    isInAir,
    thrustInput,
    turnInput,
    pitchInput,
    isThrusting: thrustInput > 0.1,
    targetThrustVisual: thrustInput,
  };
}
export function stepAirControlEnergy(
  settings: AirCaptureSettings,
  flightState: PlayerFlightState,
  controlState: ShipControlState,
  pitchAngle: number,
  delta: number,
): PlayerFlightState {
  const clampedCurrentEnergy = MathUtils.clamp(
    flightState.airControlEnergy,
    0,
    SHIP_ENGINE_CONFIG.AIR_CONTROL_ENERGY_MAX,
  );
  if (!controlState.isInAir) {
    return {
      mode: "grounded",
      airControlEnergy: SHIP_ENGINE_CONFIG.AIR_CONTROL_ENERGY_MAX,
      isAirControlDepleted: false,
    };
  }
  if (flightState.isAirControlDepleted) {
    return {
      mode: "airborne",
      airControlEnergy: 0,
      isAirControlDepleted: true,
    };
  }
  const upwardPitchNormalized =
    pitchAngle > 0 ? pitchAngle / SHIP_ENGINE_CONFIG.MAX_PITCH_UP : 0;
  const effectiveDrain =
    settings.airControlBaseDrainPerSecond +
    upwardPitchNormalized * settings.airControlPitchDrainAtMaxPerSecond;
  const nextEnergy = Math.max(0, clampedCurrentEnergy - effectiveDrain * delta);
  return {
    mode: "airborne",
    airControlEnergy: nextEnergy,
    isAirControlDepleted: nextEnergy <= 0.001,
  };
}
export function calculateShipVelocity(
  settings: AirCaptureSettings,
  currentVelocity: Vector3,
  forward: Vector3,
  thrustInput: number,
  speedMultiplier: number,
  delta: number,
  isInAir: boolean,
): Vector3 {
  if (isInAir) {
    return calculateAirShipVelocity(
      settings,
      currentVelocity,
      forward,
      thrustInput,
      speedMultiplier,
      delta,
    );
  }
  return calculateGroundShipVelocity(
    settings,
    currentVelocity,
    forward,
    thrustInput,
    speedMultiplier,
    delta,
  );
}
function calculateGroundShipVelocity(
  settings: AirCaptureSettings,
  currentVelocity: Vector3,
  forward: Vector3,
  thrustInput: number,
  speedMultiplier: number,
  delta: number,
): Vector3 {
  const planarForward = forward.clone().setY(0);
  if (planarForward.lengthSq() < 0.0001) {
    planarForward.set(0, 0, -1);
  } else {
    planarForward.normalize();
  }
  const targetSpeed = thrustInput * settings.playerMaxSpeed * speedMultiplier;
  const currentSpeed = currentVelocity.dot(planarForward);
  const speedDiff = targetSpeed - currentSpeed;
  const isAccelerating =
    Math.abs(targetSpeed) > Math.abs(currentSpeed) ||
    targetSpeed * currentSpeed < 0;
  const rate = isAccelerating
    ? settings.playerAcceleration
    : settings.playerDeceleration;
  const maxChange = Math.min(rate * delta, settings.maxVelocityChangePerFrame);
  if (Math.abs(speedDiff) <= maxChange) {
    return planarForward.clone().multiplyScalar(targetSpeed);
  }
  const nextSpeed = currentSpeed + Math.sign(speedDiff) * maxChange;
  return planarForward.clone().multiplyScalar(nextSpeed);
}
function calculateAirShipVelocity(
  settings: AirCaptureSettings,
  currentVelocity: Vector3,
  forward: Vector3,
  thrustInput: number,
  speedMultiplier: number,
  delta: number,
): Vector3 {
  const forwardAxis = forward.clone().normalize();
  const worldUp = new Vector3(0, 1, 0);
  let rightAxis = new Vector3().crossVectors(forwardAxis, worldUp);
  if (rightAxis.lengthSq() < 0.0001) {
    rightAxis = new Vector3(1, 0, 0);
  } else {
    rightAxis.normalize();
  }
  const liftAxis = new Vector3()
    .crossVectors(rightAxis, forwardAxis)
    .normalize();
  let forwardSpeed = currentVelocity.dot(forwardAxis);
  let sideSlip = currentVelocity.dot(rightAxis);
  let liftSlip = currentVelocity.dot(liftAxis);
  const thrustAcceleration =
    settings.airThrustAcceleration * speedMultiplier * thrustInput;
  forwardSpeed += thrustAcceleration * delta;
  forwardSpeed *= Math.max(0, 1 - settings.airForwardDrag * delta);
  const lateralDamping = Math.min(1, settings.airLateralDamping * delta);
  sideSlip = MathUtils.lerp(sideSlip, 0, lateralDamping);
  liftSlip *= Math.max(0, 1 - settings.airLiftDrag * delta);
  const nextVelocity = new Vector3()
    .addScaledVector(forwardAxis, forwardSpeed)
    .addScaledVector(rightAxis, sideSlip)
    .addScaledVector(liftAxis, liftSlip);
  const maxAirSpeed =
    settings.playerMaxSpeed * speedMultiplier * settings.airMaxSpeedMultiplier;
  if (nextVelocity.length() > maxAirSpeed) {
    nextVelocity.setLength(maxAirSpeed);
  }
  return nextVelocity;
}
export function calculateShipYawVelocity(
  settings: AirCaptureSettings,
  currentYawVelocity: number,
  turnInput: number,
  delta: number,
): number {
  const targetVelocity = -turnInput * settings.playerMaxAngularVelocity;
  const velocityDiff = targetVelocity - currentYawVelocity;
  const maxChange = Math.min(
    settings.playerAngularAcceleration * delta,
    settings.maxAngularVelocityChangePerFrame,
  );
  if (Math.abs(velocityDiff) <= maxChange) {
    return targetVelocity;
  }
  return currentYawVelocity + Math.sign(velocityDiff) * maxChange;
}
export function calculateShipPitchVelocity(
  settings: AirCaptureSettings,
  isInAir: boolean,
  positionY: number,
  currentRotation: Quaternion,
  currentPitchVelocity: number,
  pitchInput: number,
  delta: number,
): number {
  let targetPitchVelocity = 0;
  const maxChange = Math.min(
    settings.playerAngularAcceleration * delta,
    settings.maxAngularVelocityChangePerFrame,
  );
  if (isInAir) {
    let targetAngle =
      pitchInput >= 0
        ? pitchInput * SHIP_ENGINE_CONFIG.MAX_PITCH_UP
        : pitchInput * SHIP_ENGINE_CONFIG.MAX_PITCH_DOWN;
    const heightAboveHover = positionY - SHIP_ENGINE_CONFIG.HOVER_HEIGHT;
    if (
      heightAboveHover <= SHIP_ENGINE_CONFIG.LEVELING_START_HEIGHT &&
      heightAboveHover > SHIP_ENGINE_CONFIG.LEVELING_COMPLETE_HEIGHT
    ) {
      const t =
        (heightAboveHover - SHIP_ENGINE_CONFIG.LEVELING_COMPLETE_HEIGHT) /
        (SHIP_ENGINE_CONFIG.LEVELING_START_HEIGHT -
          SHIP_ENGINE_CONFIG.LEVELING_COMPLETE_HEIGHT);
      const smoothBlend = t * t * (3 - 2 * t);
      targetAngle *= smoothBlend;
    } else if (
      heightAboveHover <= SHIP_ENGINE_CONFIG.LEVELING_COMPLETE_HEIGHT
    ) {
      targetAngle = 0;
    }
    const currentAngle = new Euler().setFromQuaternion(
      currentRotation,
      "YXZ",
    ).x;
    const angleDiff = targetAngle - currentAngle;
    targetPitchVelocity = MathUtils.clamp(
      angleDiff * settings.pitchResponsiveness -
        currentPitchVelocity * settings.pitchDamping,
      -settings.playerMaxAngularVelocity,
      settings.playerMaxAngularVelocity,
    );
  }
  const velocityDiff = targetPitchVelocity - currentPitchVelocity;
  if (Math.abs(velocityDiff) <= maxChange) {
    return targetPitchVelocity;
  }
  return currentPitchVelocity + Math.sign(velocityDiff) * maxChange;
}
export function advanceShipRotation(
  settings: AirCaptureSettings,
  currentRotation: Quaternion,
  yawVelocity: number,
  pitchVelocity: number,
  isInAir: boolean,
  delta: number,
): Quaternion {
  const euler = new Euler().setFromQuaternion(currentRotation, "YXZ");
  euler.y += yawVelocity * delta;
  if (isInAir) {
    euler.x += pitchVelocity * delta;
    euler.x = MathUtils.clamp(
      euler.x,
      -SHIP_ENGINE_CONFIG.MAX_PITCH_DOWN,
      SHIP_ENGINE_CONFIG.MAX_PITCH_UP,
    );
  } else {
    const resetSpeed = settings.pitchResetSpeed * delta;
    if (Math.abs(euler.x) <= resetSpeed) {
      euler.x = 0;
    } else {
      euler.x += (euler.x > 0 ? -1 : 1) * resetSpeed;
    }
  }
  return new Quaternion().setFromEuler(euler).normalize();
}
export function calculateShipVerticalVelocityDelta(
  settings: AirCaptureSettings,
  isInAir: boolean,
  positionY: number,
  verticalVelocity: number,
  pitchAngle: number,
  forwardSpeed: number,
  delta: number,
): number {
  if (isInAir) {
    const positivePitchNormalized =
      pitchAngle > 0 ? pitchAngle / SHIP_ENGINE_CONFIG.MAX_PITCH_UP : 0;
    const negativePitchNormalized =
      pitchAngle < 0 ? pitchAngle / SHIP_ENGINE_CONFIG.MAX_PITCH_DOWN : 0;
    const glideLift =
      Math.max(0, forwardSpeed) * settings.airGlideLiftCoefficient;
    const pitchLift =
      positivePitchNormalized *
      settings.airPitchLiftForce *
      Math.max(0, forwardSpeed / settings.playerMaxSpeed);
    const diveAcceleration =
      Math.max(0, -negativePitchNormalized) * settings.airDiveAcceleration;
    const verticalAcceleration =
      settings.baseGravity + glideLift + pitchLift - diveAcceleration;
    const deltaY = verticalAcceleration * delta;
    const nextVelocity = verticalVelocity + deltaY;
    if (nextVelocity < -40) {
      return -40 - verticalVelocity;
    }
    if (nextVelocity > settings.maxVerticalVel) {
      return settings.maxVerticalVel - verticalVelocity;
    }
    if (nextVelocity > settings.upwardVelocityThreshold && deltaY > 0) {
      return 0;
    }
    return deltaY;
  }
  const hoverOffset = positionY - SHIP_ENGINE_CONFIG.HOVER_HEIGHT;
  if (hoverOffset < 0) {
    return -verticalVelocity;
  }
  if (Math.abs(hoverOffset) > 0.01) {
    const restoreVelocity = -hoverOffset * settings.restoreForce * delta;
    const clampedVelocity = MathUtils.clamp(
      verticalVelocity + restoreVelocity,
      -10,
      10,
    );
    return clampedVelocity - verticalVelocity;
  }
  return -verticalVelocity;
}
export function calculateShipWingRoll(
  currentWingRoll: number,
  turnInput: number,
  delta: number,
): number {
  const targetRoll = -turnInput * SHIP_ENGINE_CONFIG.BANKING_ANGLE;
  return MathUtils.lerp(currentWingRoll, targetRoll, Math.min(1, delta * 8));
}
function applyInputDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) {
    return 0;
  }
  return value;
}
