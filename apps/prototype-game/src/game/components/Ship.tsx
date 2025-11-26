/* eslint-disable react-refresh/only-export-components */

import { useFrame } from "@react-three/fiber";
import { useRef, memo, useEffect } from "react";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";

import {
  PLAYER_MAX_SPEED,
  PLAYER_ACCELERATION,
  PLAYER_DECELERATION,
  MAX_VELOCITY_CHANGE_PER_FRAME,
  PLAYER_MAX_ANGULAR_VELOCITY,
  PLAYER_ANGULAR_ACCELERATION,
  MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  PLAYER_INPUT_SMOOTH_TIME,
} from "../constants";
import { useGameStore } from "../game-store";
import { useLasersStore } from "../lasers-store";
import { useAbilitiesStore, getAbilityVisual } from "../abilities-store";
import { usePlayerStatsStore } from "../player-stats-store";
import { ShipModel } from "./ShipModel";
import { useAirJamInput } from "@air-jam/sdk";
import { useConnectionStore } from "@air-jam/sdk";

// --- Global Tracking ---
export const shipPositions = new Map<string, Vector3>();
export const shipRotations = new Map<string, Quaternion>();

// --- Configuration Constants ---
const SHIP_CONFIG = {
  HOVER_HEIGHT: 5,
  AIR_MODE_THRESHOLD: 0.5,
  MAX_PITCH: Math.PI / 4, // 45 degrees
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
  LEVELING_COMPLETE_HEIGHT: 0.5 + 0.5, // AIR_MODE_THRESHOLD + 0.5
};

interface ShipProps {
  controllerId: string;
  position: [number, number, number];
}

function ShipComponent({ controllerId, position: initialPosition }: ShipProps) {
  // --- Refs & State ---
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const planeGroupRef = useRef<THREE.Group>(null);

  // Physics Logic Refs
  const currentThrustRef = useRef(0);
  const thrustInputRef = useRef(0); // Store thrustInput for ShipModel
  const smoothedInputRef = useRef({ x: 0, y: 0 });
  const currentWingRollRef = useRef(0);
  const currentVelocityRef = useRef(new Vector3(0, 0, 0));
  const currentAngularVelocityRef = useRef(0);
  const currentPitchAngularVelocityRef = useRef(0);
  const currentRotationRef = useRef(new Quaternion()); // Manual rotation tracking

  // Gameplay Refs
  const lastActionRef = useRef(false);
  const lastShootTimeRef = useRef(0);

  // --- Store Access ---
  const addLaser = useLasersStore((state) => state.addLaser);
  const abilitiesStore = useAbilitiesStore.getState();
  const playerStatsStore = usePlayerStatsStore.getState();

  // --- Input Hook (Zero re-renders, high-performance) ---
  const roomId = useConnectionStore((state) => state.roomId);
  const { popInput } = useAirJamInput({ roomId: roomId ?? undefined });

  // Visuals & Stats
  const currentAbility = useAbilitiesStore((state) =>
    state.getAbility(controllerId)
  );
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId)
  );
  const abilityVisual =
    currentAbility && !isAbilityActive
      ? getAbilityVisual(currentAbility.id, controllerId)
      : null;

  const playerColor =
    useGameStore(
      (state) =>
        state.players.find((p) => p.controllerId === controllerId)?.color
    ) || "#ff4444";

  // Init Stats
  useEffect(() => {
    playerStatsStore.initializeStats(controllerId);
    return () => playerStatsStore.removeStats(controllerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerId]);

  // --- THE LOOP ---
  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;

    const time = state.clock.elapsedTime;
    const physicsPos = rigidBodyRef.current.translation();
    const physicsVel = rigidBodyRef.current.linvel();
    const shipWorldPos = new Vector3(physicsPos.x, physicsPos.y, physicsPos.z);

    // 1. INPUT PHASE
    // Use the dedicated input hook for high-performance, zero-render input processing
    // This automatically handles latch pattern to ensure rapid taps are never missed
    const input = popInput(controllerId);

    // Always update position/rotation tracking for camera (even without input)
    // This ensures camera can follow the player immediately when they connect
    // The rotation ref is initialized and maintained by the physics system,
    // so it will have valid data even when there's no input
    shipPositions.set(controllerId, shipWorldPos);
    shipRotations.set(controllerId, currentRotationRef.current.clone());

    // If no input yet, skip input-dependent logic but continue with basic physics
    if (!input) {
      return;
    }

    // Smooth input
    const smoothAlpha = 1 - Math.exp(-delta / PLAYER_INPUT_SMOOTH_TIME);
    smoothedInputRef.current.x = MathUtils.lerp(
      smoothedInputRef.current.x,
      input.vector.x,
      smoothAlpha
    );
    smoothedInputRef.current.y = MathUtils.lerp(
      smoothedInputRef.current.y,
      input.vector.y,
      smoothAlpha
    );

    // Determine Mode
    const isInAir =
      physicsPos.y > SHIP_CONFIG.HOVER_HEIGHT + SHIP_CONFIG.AIR_MODE_THRESHOLD;

    // Control Mapping
    const thrustInput = isInAir ? 1.0 : smoothedInputRef.current.y;
    thrustInputRef.current = thrustInput; // Store for ShipModel
    const turnInput = smoothedInputRef.current.x;

    // 2. LOGIC PHASE: ABILITIES
    handleAbilities(input, abilitiesStore, controllerId, delta);
    const speedMultiplier = playerStatsStore.getSpeedMultiplier(controllerId);

    // 3. CALCULATION PHASE: VELOCITY
    const shipQuaternion = currentRotationRef.current.clone();
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);

    const newVelocity = calculateVelocity(
      currentVelocityRef.current,
      forward,
      thrustInput,
      speedMultiplier,
      delta
    );
    currentVelocityRef.current.copy(newVelocity);

    // 4. CALCULATION PHASE: ROTATION (YAW & PITCH)
    // Yaw (Left/Right)
    const newYawVel = calculateYaw(
      currentAngularVelocityRef.current,
      turnInput,
      delta
    );
    currentAngularVelocityRef.current = newYawVel;

    // Pitch (Up/Down) - The complex parabolic math
    const newPitchVel = calculatePitchVelocity(
      isInAir,
      physicsPos.y,
      physicsVel.y,
      currentRotationRef.current,
      currentPitchAngularVelocityRef.current,
      delta
    );
    currentPitchAngularVelocityRef.current = newPitchVel;

    // Apply Rotations to internal Quaternion
    const euler = new Euler().setFromQuaternion(
      currentRotationRef.current,
      "YXZ"
    );
    euler.y += newYawVel * delta;

    if (isInAir) {
      euler.x += newPitchVel * delta;
      euler.x = MathUtils.clamp(
        euler.x,
        -SHIP_CONFIG.MAX_PITCH,
        SHIP_CONFIG.MAX_PITCH
      );
    } else {
      // Ground reset
      const resetSpeed = SHIP_CONFIG.PITCH_RESET_SPEED * delta;
      if (Math.abs(euler.x) <= resetSpeed) {
        euler.x = 0;
      } else {
        euler.x += (euler.x > 0 ? -1 : 1) * resetSpeed;
      }
    }

    currentRotationRef.current.setFromEuler(euler).normalize();

    // 5. PHYSICS PHASE: APPLY TO RAPIER
    const finalVelocity = new Vector3(
      newVelocity.x,
      physicsVel.y,
      newVelocity.z
    ); // Start with X/Z calculated, Y from physics

    // Apply Custom Gravity / Hover Physics
    const verticalForce = calculateVerticalPhysics(
      isInAir,
      physicsPos.y,
      physicsVel.y,
      euler.x,
      delta
    );
    finalVelocity.y += verticalForce; // Add the calculated Y change

    // Apply to Body
    rigidBodyRef.current.setLinvel(finalVelocity, true);
    rigidBodyRef.current.setRotation(currentRotationRef.current, true);
    rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true); // Kill physics rotation, we control it manually

    // Update position/rotation tracking again after physics update
    shipPositions.set(controllerId, shipWorldPos);
    shipRotations.set(controllerId, currentRotationRef.current.clone());

    // 6. GAMEPLAY PHASE: SHOOTING
    handleShooting({
      input,
      time,
      lastShootTimeRef,
      lastActionRef,
      controllerId,
      shipWorldPos,
      shipRotation: currentRotationRef.current,
      addLaser,
    });

    // 7. VISUALS PHASE
    // Banking
    const targetRoll = -turnInput * SHIP_CONFIG.BANKING_ANGLE;
    currentWingRollRef.current = MathUtils.lerp(
      currentWingRollRef.current,
      targetRoll,
      Math.min(1, delta * 8)
    );
    if (planeGroupRef.current) {
      planeGroupRef.current.rotation.z = currentWingRollRef.current;
    }

    // Thrust Visual
    const targetThrustVis = isInAir ? 1.0 : Math.abs(thrustInput);
    currentThrustRef.current = MathUtils.lerp(
      currentThrustRef.current,
      targetThrustVis,
      0.15
    );
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={initialPosition}
      lockRotations
      linearDamping={0.5}
      colliders="cuboid"
      userData={{ controllerId }}
    >
      <ShipModel
        playerColor={playerColor}
        thrustRef={currentThrustRef}
        thrustInputRef={thrustInputRef}
        abilityVisual={abilityVisual}
        planeGroupRef={planeGroupRef}
      />
    </RigidBody>
  );
}

// ------------------------------------------------------------------
// --- HELPER LOGIC (Moved outside to clean up the Component) ---
// ------------------------------------------------------------------

function calculateVelocity(
  currentVel: Vector3,
  forward: Vector3,
  thrust: number,
  multiplier: number,
  delta: number
): Vector3 {
  const targetSpeed = thrust * PLAYER_MAX_SPEED * multiplier;
  const currentSpeed = currentVel.dot(forward);
  const speedDiff = targetSpeed - currentSpeed;

  const isAccelerating =
    Math.abs(targetSpeed) > Math.abs(currentSpeed) ||
    targetSpeed * currentSpeed < 0;
  const rate = isAccelerating ? PLAYER_ACCELERATION : PLAYER_DECELERATION;
  const maxChange = Math.min(rate * delta, MAX_VELOCITY_CHANGE_PER_FRAME);

  if (Math.abs(speedDiff) <= maxChange) {
    return forward.clone().multiplyScalar(targetSpeed);
  }
  const newSpeed = currentSpeed + (speedDiff > 0 ? 1 : -1) * maxChange;
  return forward.clone().multiplyScalar(newSpeed);
}

function calculateYaw(
  currentYawVel: number,
  input: number,
  delta: number
): number {
  const target = -input * PLAYER_MAX_ANGULAR_VELOCITY;
  const diff = target - currentYawVel;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME
  );

  if (Math.abs(diff) <= maxChange) return target;
  return currentYawVel + (diff > 0 ? 1 : -1) * maxChange;
}

// The complex pitch logic preserved exactly
function calculatePitchVelocity(
  isInAir: boolean,
  posY: number,
  velY: number,
  rotation: Quaternion,
  currentPitchVel: number,
  delta: number
): number {
  let targetPitchAngVel = 0;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME
  );

  if (isInAir) {
    // Calculate target angle based on vertical velocity
    const clampedVel = MathUtils.clamp(
      velY,
      -SHIP_CONFIG.MAX_VERTICAL_VEL,
      SHIP_CONFIG.MAX_VERTICAL_VEL
    );
    const normVel = clampedVel / SHIP_CONFIG.MAX_VERTICAL_VEL;
    const curvedVel = Math.sign(normVel) * Math.pow(Math.abs(normVel), 0.6); // Steepness factor
    let targetAngle = curvedVel * SHIP_CONFIG.MAX_PITCH;

    // Leveling out logic
    const heightAboveHover = posY - SHIP_CONFIG.HOVER_HEIGHT;

    if (
      heightAboveHover <= SHIP_CONFIG.LEVELING_START_HEIGHT &&
      heightAboveHover > SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT
    ) {
      const t =
        (heightAboveHover - SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT) /
        (SHIP_CONFIG.LEVELING_START_HEIGHT -
          SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT);
      const smooth = t * t * (3 - 2 * t);
      targetAngle *= smooth;
    } else if (heightAboveHover <= SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT) {
      targetAngle = 0;
    }

    const currentAngle = new Euler().setFromQuaternion(rotation, "YXZ").x;
    const diff = targetAngle - currentAngle;
    targetPitchAngVel = MathUtils.clamp(
      diff * SHIP_CONFIG.PITCH_RESPONSIVENESS,
      -PLAYER_MAX_ANGULAR_VELOCITY,
      PLAYER_MAX_ANGULAR_VELOCITY
    );
  }

  const diff = targetPitchAngVel - currentPitchVel;
  if (Math.abs(diff) <= maxChange) return targetPitchAngVel;
  return currentPitchVel + (diff > 0 ? 1 : -1) * maxChange;
}

function calculateVerticalPhysics(
  isInAir: boolean,
  posY: number,
  velY: number,
  pitchAngle: number,
  delta: number
): number {
  // Check if being launched by jump pad
  if (velY > SHIP_CONFIG.UPWARD_VELOCITY_THRESHOLD) return 0; // Let physics engine handle the launch

  if (isInAir) {
    // Air Physics
    const pitchNorm = pitchAngle / SHIP_CONFIG.MAX_PITCH;
    let gravity = SHIP_CONFIG.BASE_GRAVITY;

    if (pitchNorm < 0) {
      gravity -= pitchNorm * SHIP_CONFIG.MAX_DIVE_GRAVITY; // Diving
    } else {
      gravity += pitchNorm * SHIP_CONFIG.MAX_LIFT; // Climbing
    }

    // Return the CHANGE in velocity (acceleration * delta)
    const deltaY = gravity * delta;

    // Manual clamps based on original code logic
    const nextVel = velY + deltaY;
    if (nextVel < -40) return -40 - velY; // Clamp min
    if (nextVel > 30) return 30 - velY; // Clamp max
    return deltaY;
  } else {
    // Hover Physics
    const diff = posY - SHIP_CONFIG.HOVER_HEIGHT;

    // If ship somehow got below hover height, push it back up immediately
    if (diff < 0) {
      return -velY; // Stop and push up
    }

    if (Math.abs(diff) > 0.01) {
      const restore = -diff * SHIP_CONFIG.RESTORE_FORCE * delta;
      // Clamp result to prevent explosion
      const potentialVel = velY + restore; // Simplified approximation
      return MathUtils.clamp(potentialVel, -10, 10) - velY;
    }

    // Very close to hover height - just stop vertical movement
    // Snap to exact position if very close
    if (Math.abs(diff) > 0.001) {
      // This would need rigidBodyRef, but we'll handle it in the main loop
      // For now, just return the velocity change needed
      return -velY;
    }
    return -velY; // Stop movement
  }
}

function handleAbilities(
  input: { ability: boolean },
  store: ReturnType<typeof useAbilitiesStore.getState>,
  id: string,
  delta: number
) {
  // The input hook already handled the latch pattern and consumption
  // We just need to check if ability button is pressed and we have a queued ability
  const currentAbility = store.getAbility(id);
  const hasAbilityInSlot = currentAbility !== null;

  // Trigger Logic: Check if ability button is pressed and we have a queued ability
  // (startTime === null means queued, not yet activated)
  if (input.ability && hasAbilityInSlot && currentAbility.startTime === null) {
    // Activate the ability!
    store.activateAbility(id, currentAbility.id);

    console.log(
      `[SHIP] Ability activated for ${id}, ability: ${currentAbility.id}`
    );
  }

  // Update active abilities (for onUpdate hooks)
  store.updateActiveAbilities(id, delta);
}

interface HandleShootingParams {
  input: { action?: boolean };
  time: number;
  lastShootTimeRef: React.MutableRefObject<number>;
  lastActionRef: React.MutableRefObject<boolean>;
  controllerId: string;
  shipWorldPos: Vector3;
  shipRotation: Quaternion;
  addLaser: (laser: {
    id: string;
    position: [number, number, number];
    direction: Vector3;
    controllerId: string;
    timestamp: number;
  }) => void;
}

function handleShooting({
  input,
  time,
  lastShootTimeRef,
  lastActionRef,
  controllerId,
  shipWorldPos,
  shipRotation,
  addLaser,
}: HandleShootingParams) {
  const pressed = input.action && !lastActionRef.current;
  const held =
    input.action &&
    time - lastShootTimeRef.current >= SHIP_CONFIG.SHOOT_INTERVAL;

  if (pressed || held) {
    lastShootTimeRef.current = time;
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipRotation);
    const up = new Vector3(0, 1, 0).applyQuaternion(shipRotation);

    // Offset logic
    const offset = forward
      .clone()
      .multiplyScalar(3.5)
      .add(up.clone().multiplyScalar(0.5));

    // Calculate gun positions
    const guns = [new Vector3(-1.5, 0, 0.95), new Vector3(1.5, 0, 0.95)];

    guns.forEach((gunPos, i) => {
      const worldPos = gunPos
        .applyQuaternion(shipRotation)
        .add(shipWorldPos)
        .add(offset);
      addLaser({
        id: `${controllerId}-${time}-${i === 0 ? "L" : "R"}`,
        position: [worldPos.x, worldPos.y, worldPos.z],
        direction: forward.clone(),
        controllerId,
        timestamp: time,
      });
    });
  }
  lastActionRef.current = input.action ?? false;
}

export const Ship = memo(ShipComponent, (prev, next) => {
  return (
    prev.controllerId === next.controllerId &&
    prev.position.every((v, i) => v === next.position[i])
  );
});
