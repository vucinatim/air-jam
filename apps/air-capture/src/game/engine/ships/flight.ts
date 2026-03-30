import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import {
  MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  MAX_VELOCITY_CHANGE_PER_FRAME,
  PLAYER_ACCELERATION,
  PLAYER_ANGULAR_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_INPUT_SMOOTH_TIME,
  PLAYER_MAX_ANGULAR_VELOCITY,
  PLAYER_MAX_SPEED,
} from "../../constants";

export const SHIP_ENGINE_CONFIG = {
  HOVER_HEIGHT: 5,
  AIR_MODE_THRESHOLD: 0.5,
  MAX_PITCH: Math.PI / 4,
  MAX_VERTICAL_VEL: 30,
  BASE_GRAVITY: -5,
  MAX_DIVE_GRAVITY: -15,
  MAX_LIFT: 3,
  BANKING_ANGLE: Math.PI / 6,
  SHOOT_INTERVAL: 0.2,
  UPWARD_VELOCITY_THRESHOLD: 10,
  RESTORE_FORCE: 20,
  PITCH_RESET_SPEED: 5.0,
  PITCH_RESPONSIVENESS: 2.0,
  LEVELING_START_HEIGHT: 6,
  LEVELING_COMPLETE_HEIGHT: 1.0,
} as const;

export interface ShipInputVector {
  x: number;
  y: number;
}

export interface ShipControlState {
  isInAir: boolean;
  thrustInput: number;
  turnInput: number;
  isThrusting: boolean;
  targetThrustVisual: number;
}

export function smoothShipInput(
  currentInput: ShipInputVector,
  targetInput: ShipInputVector,
  delta: number,
): ShipInputVector {
  const smoothAlpha = 1 - Math.exp(-delta / PLAYER_INPUT_SMOOTH_TIME);

  return {
    x: MathUtils.lerp(currentInput.x, targetInput.x, smoothAlpha),
    y: MathUtils.lerp(currentInput.y, targetInput.y, smoothAlpha),
  };
}

export function resolveShipControls(
  positionY: number,
  smoothedInput: ShipInputVector,
): ShipControlState {
  const isInAir =
    positionY >
    SHIP_ENGINE_CONFIG.HOVER_HEIGHT + SHIP_ENGINE_CONFIG.AIR_MODE_THRESHOLD;
  const thrustInput = isInAir ? 1.0 : smoothedInput.y;
  const turnInput = smoothedInput.x;

  return {
    isInAir,
    thrustInput,
    turnInput,
    isThrusting: thrustInput > 0.1,
    targetThrustVisual: isInAir ? 1.0 : Math.abs(thrustInput),
  };
}

export function calculateShipVelocity(
  currentVelocity: Vector3,
  forward: Vector3,
  thrustInput: number,
  speedMultiplier: number,
  delta: number,
): Vector3 {
  const targetSpeed = thrustInput * PLAYER_MAX_SPEED * speedMultiplier;
  const currentSpeed = currentVelocity.dot(forward);
  const speedDiff = targetSpeed - currentSpeed;

  const isAccelerating =
    Math.abs(targetSpeed) > Math.abs(currentSpeed) ||
    targetSpeed * currentSpeed < 0;
  const rate = isAccelerating ? PLAYER_ACCELERATION : PLAYER_DECELERATION;
  const maxChange = Math.min(rate * delta, MAX_VELOCITY_CHANGE_PER_FRAME);

  if (Math.abs(speedDiff) <= maxChange) {
    return forward.clone().multiplyScalar(targetSpeed);
  }

  const nextSpeed = currentSpeed + Math.sign(speedDiff) * maxChange;
  return forward.clone().multiplyScalar(nextSpeed);
}

export function calculateShipYawVelocity(
  currentYawVelocity: number,
  turnInput: number,
  delta: number,
): number {
  const targetVelocity = -turnInput * PLAYER_MAX_ANGULAR_VELOCITY;
  const velocityDiff = targetVelocity - currentYawVelocity;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  );

  if (Math.abs(velocityDiff) <= maxChange) {
    return targetVelocity;
  }

  return currentYawVelocity + Math.sign(velocityDiff) * maxChange;
}

export function calculateShipPitchVelocity(
  isInAir: boolean,
  positionY: number,
  verticalVelocity: number,
  currentForwardSpeed: number,
  currentRotation: Quaternion,
  currentPitchVelocity: number,
  delta: number,
): number {
  let targetPitchVelocity = 0;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  );

  if (isInAir) {
    const safeForwardSpeed = Math.max(Math.abs(currentForwardSpeed), 1.0);
    let targetAngle = Math.atan2(verticalVelocity, safeForwardSpeed);
    targetAngle *= 1.2;
    targetAngle = MathUtils.clamp(
      targetAngle,
      -SHIP_ENGINE_CONFIG.MAX_PITCH,
      SHIP_ENGINE_CONFIG.MAX_PITCH,
    );

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

    const currentAngle = new Euler().setFromQuaternion(currentRotation, "YXZ").x;
    const angleDiff = targetAngle - currentAngle;
    targetPitchVelocity = MathUtils.clamp(
      angleDiff * SHIP_ENGINE_CONFIG.PITCH_RESPONSIVENESS,
      -PLAYER_MAX_ANGULAR_VELOCITY,
      PLAYER_MAX_ANGULAR_VELOCITY,
    );
  }

  const velocityDiff = targetPitchVelocity - currentPitchVelocity;
  if (Math.abs(velocityDiff) <= maxChange) {
    return targetPitchVelocity;
  }

  return currentPitchVelocity + Math.sign(velocityDiff) * maxChange;
}

export function advanceShipRotation(
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
      -SHIP_ENGINE_CONFIG.MAX_PITCH,
      SHIP_ENGINE_CONFIG.MAX_PITCH,
    );
  } else {
    const resetSpeed = SHIP_ENGINE_CONFIG.PITCH_RESET_SPEED * delta;
    if (Math.abs(euler.x) <= resetSpeed) {
      euler.x = 0;
    } else {
      euler.x += (euler.x > 0 ? -1 : 1) * resetSpeed;
    }
  }

  return new Quaternion().setFromEuler(euler).normalize();
}

export function calculateShipVerticalVelocityDelta(
  isInAir: boolean,
  positionY: number,
  verticalVelocity: number,
  pitchAngle: number,
  delta: number,
): number {
  if (verticalVelocity > SHIP_ENGINE_CONFIG.UPWARD_VELOCITY_THRESHOLD) {
    return 0;
  }

  if (isInAir) {
    const pitchNormalized = pitchAngle / SHIP_ENGINE_CONFIG.MAX_PITCH;
    let gravity = SHIP_ENGINE_CONFIG.BASE_GRAVITY;

    if (pitchNormalized < 0) {
      gravity -= pitchNormalized * SHIP_ENGINE_CONFIG.MAX_DIVE_GRAVITY;
    } else {
      gravity += pitchNormalized * SHIP_ENGINE_CONFIG.MAX_LIFT;
    }

    const deltaY = gravity * delta;
    const nextVelocity = verticalVelocity + deltaY;

    if (nextVelocity < -40) {
      return -40 - verticalVelocity;
    }

    if (nextVelocity > SHIP_ENGINE_CONFIG.MAX_VERTICAL_VEL) {
      return SHIP_ENGINE_CONFIG.MAX_VERTICAL_VEL - verticalVelocity;
    }

    return deltaY;
  }

  const hoverOffset = positionY - SHIP_ENGINE_CONFIG.HOVER_HEIGHT;
  if (hoverOffset < 0) {
    return -verticalVelocity;
  }

  if (Math.abs(hoverOffset) > 0.01) {
    const restoreVelocity =
      -hoverOffset * SHIP_ENGINE_CONFIG.RESTORE_FORCE * delta;
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
