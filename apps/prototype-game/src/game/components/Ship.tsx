/* eslint-disable react-refresh/only-export-components */

import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";

import { useAirJamHost, useAudio, useConnectionStore } from "@air-jam/sdk";
import { getAbilityVisual, useAbilitiesStore } from "../abilities-store";
import { useCaptureTheFlagStore } from "../capture-the-flag-store";
import {
  MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  MAX_VELOCITY_CHANGE_PER_FRAME,
  PLAYER_ACCELERATION,
  PLAYER_ANGULAR_ACCELERATION,
  PLAYER_DECELERATION,
  PLAYER_INPUT_SMOOTH_TIME,
  PLAYER_MAX_ANGULAR_VELOCITY,
  PLAYER_MAX_SPEED,
} from "../constants";
import { useGameStore } from "../game-store";
import { useHealthStore } from "../health-store";
import { useGameInput } from "../hooks/useGameInput";
import { useLasersStore } from "../lasers-store";
import { usePlayerStatsStore } from "../player-stats-store";
import { SOUND_MANIFEST } from "../sounds";
import { ShipExplosion } from "./ShipExplosion";
import { ShipModel } from "./ShipModel";

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
  const respawnTimeRef = useRef(0);
  const pendingRespawnRef = useRef<[number, number, number] | null>(null);
  const RESPAWN_DELAY = 2.0; // Seconds to wait before respawning
  const engineIdleSoundIdRef = useRef<number | null>(null);
  const engineThrustSoundIdRef = useRef<number | null>(null);
  const [explosionPosition, setExplosionPosition] = useState<
    [number, number, number] | null
  >(null);

  // --- Store Access ---
  const addLaser = useLasersStore((state) => state.addLaser);
  const abilitiesStore = useAbilitiesStore.getState();
  const playerStatsStore = usePlayerStatsStore.getState();
  const healthStore = useHealthStore.getState();
  const ctfStore = useCaptureTheFlagStore.getState();

  // --- Audio ---
  const audio = useAudio(SOUND_MANIFEST);
  const { sendSignal } = useAirJamHost();

  // --- Input Hook (Zero re-renders, high-performance) ---
  const roomId = useConnectionStore((state) => state.roomId);
  const { popInput } = useGameInput({ roomId: roomId ?? undefined });

  // Visuals & Stats
  const currentAbility = useAbilitiesStore((state) =>
    state.getAbility(controllerId),
  );
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId),
  );
  const abilityVisual =
    currentAbility && !isAbilityActive
      ? getAbilityVisual(currentAbility.id, controllerId)
      : null;

  const playerColor =
    useGameStore(
      (state) =>
        state.players.find((p) => p.controllerId === controllerId)?.color,
    ) || "#ff4444";

  // Get death state for render (needed outside useFrame)
  const isDead = useHealthStore((state) => state.getIsDead(controllerId));

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

    // Check for death BEFORE accessing RigidBody to avoid conflicts
    const isDeadFrame = healthStore.getIsDead(controllerId);
    const justDied = healthStore.checkDeath(controllerId);

    // If dead, only handle death/respawn logic, don't access physics
    if (isDeadFrame && !justDied) {
      // Stop engine sounds while dead
      if (engineIdleSoundIdRef.current !== null) {
        audio.stop("engine_idle", engineIdleSoundIdRef.current);
        engineIdleSoundIdRef.current = null;
      }
      if (engineThrustSoundIdRef.current !== null) {
        audio.stop("engine_thrust", engineThrustSoundIdRef.current);
        engineThrustSoundIdRef.current = null;
      }

      // Handle respawn - schedule teleport for next frame
      if (time >= respawnTimeRef.current && respawnTimeRef.current > 0) {
        const playerTeam = ctfStore.getPlayerTeam(controllerId);
        if (playerTeam) {
          const basePos = ctfStore.basePositions[playerTeam];
          // Store respawn position to apply at start of next frame
          pendingRespawnRef.current = [basePos[0], basePos[1] + 5, basePos[2]];
          // Respawn player
          healthStore.respawn(controllerId);
          respawnTimeRef.current = 0;
          setExplosionPosition(null); // Clear explosion on respawn
          console.log(`[SHIP] ${controllerId} respawned at base`);
        }
      }
      return;
    }

    // Apply pending respawn teleport at the start of frame (before physics updates)
    if (pendingRespawnRef.current && rigidBodyRef.current) {
      try {
        const [x, y, z] = pendingRespawnRef.current;
        rigidBodyRef.current.setTranslation({ x, y, z }, true);
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        // Reset rotation
        currentRotationRef.current.setFromEuler(new Euler(0, 0, 0));
        currentVelocityRef.current.set(0, 0, 0);
        currentAngularVelocityRef.current = 0;
        currentPitchAngularVelocityRef.current = 0;
        pendingRespawnRef.current = null;
      } catch (error) {
        console.error(
          `[SHIP] Error applying respawn teleport for ${controllerId}:`,
          error,
        );
        pendingRespawnRef.current = null;
      }
    }

    // Now safe to access RigidBody physics
    let physicsPos, physicsVel, shipWorldPos;
    try {
      physicsPos = rigidBodyRef.current.translation();
      physicsVel = rigidBodyRef.current.linvel();
      shipWorldPos = new Vector3(physicsPos.x, physicsPos.y, physicsPos.z);
    } catch (error) {
      console.error(
        `[SHIP] Error accessing RigidBody for ${controllerId}:`,
        error,
      );
      return;
    }

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

    if (justDied) {
      // Stop engine sounds on death
      if (engineIdleSoundIdRef.current !== null) {
        audio.stop("engine_idle", engineIdleSoundIdRef.current);
        engineIdleSoundIdRef.current = null;
      }
      if (engineThrustSoundIdRef.current !== null) {
        audio.stop("engine_thrust", engineThrustSoundIdRef.current);
        engineThrustSoundIdRef.current = null;
      }

      // Player just died - drop flag at death position and trigger explosion
      // Set Y to ship's Y minus hover height so flag appears at ship's hover level
      const deathPosition: [number, number, number] = [
        shipWorldPos.x,
        shipWorldPos.y - SHIP_CONFIG.HOVER_HEIGHT,
        shipWorldPos.z,
      ];
      try {
        ctfStore.dropFlagAtPosition(controllerId, deathPosition);
        respawnTimeRef.current = time + RESPAWN_DELAY;
        setExplosionPosition(deathPosition);

        // Play explosion sound on host
        audio.play("explosion");

        console.log(
          `[SHIP] ${controllerId} died at (${deathPosition[0].toFixed(
            1,
          )}, ${deathPosition[1].toFixed(1)}, ${deathPosition[2].toFixed(1)})`,
        );
      } catch (error) {
        console.error(
          `[SHIP] Error handling death for ${controllerId}:`,
          error,
        );
      }
      // Return early after death - don't process physics
      return;
    }

    // If no input yet, skip input-dependent logic but continue with basic physics
    if (!input) {
      return;
    }

    // Smooth input
    const smoothAlpha = 1 - Math.exp(-delta / PLAYER_INPUT_SMOOTH_TIME);
    smoothedInputRef.current.x = MathUtils.lerp(
      smoothedInputRef.current.x,
      input.vector.x,
      smoothAlpha,
    );
    smoothedInputRef.current.y = MathUtils.lerp(
      smoothedInputRef.current.y,
      input.vector.y,
      smoothAlpha,
    );

    // Determine Mode
    const isInAir =
      physicsPos.y > SHIP_CONFIG.HOVER_HEIGHT + SHIP_CONFIG.AIR_MODE_THRESHOLD;

    // Control Mapping
    const thrustInput = isInAir ? 1.0 : smoothedInputRef.current.y;
    thrustInputRef.current = thrustInput; // Store for ShipModel
    const turnInput = smoothedInputRef.current.x;

    // Engine Sound Logic
    const isThrusting = thrustInput > 0.1; // Small threshold to avoid noise

    // Stop idle sound if thrusting
    if (isThrusting && engineIdleSoundIdRef.current !== null) {
      audio.stop("engine_idle", engineIdleSoundIdRef.current);
      engineIdleSoundIdRef.current = null;
    }

    // Start/stop thrust sound
    if (isThrusting && engineThrustSoundIdRef.current === null) {
      engineThrustSoundIdRef.current = audio.play("engine_thrust");
    } else if (!isThrusting && engineThrustSoundIdRef.current !== null) {
      audio.stop("engine_thrust", engineThrustSoundIdRef.current);
      engineThrustSoundIdRef.current = null;
    }

    // Start idle sound if not thrusting and not already playing
    if (!isThrusting && engineIdleSoundIdRef.current === null && !isDeadFrame) {
      engineIdleSoundIdRef.current = audio.play("engine_idle");
    }

    // 2. LOGIC PHASE: ABILITIES
    handleAbilities(
      input,
      abilitiesStore,
      controllerId,
      delta,
      audio,
      sendSignal,
    );
    const speedMultiplier = playerStatsStore.getSpeedMultiplier(controllerId);

    // 3. LOGIC PHASE: SHOOTING
    handleShooting({
      input,
      time,
      lastShootTimeRef,
      lastActionRef,
      controllerId,
      shipWorldPos,
      shipRotation: currentRotationRef.current,
      addLaser,
      audio,
      sendSignal,
    });

    // 3. CALCULATION PHASE: VELOCITY
    const shipQuaternion = currentRotationRef.current.clone();
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);

    const newVelocity = calculateVelocity(
      currentVelocityRef.current,
      forward,
      thrustInput,
      speedMultiplier,
      delta,
    );
    currentVelocityRef.current.copy(newVelocity);

    // Calculate forward speed for pitch calculation
    const currentForwardSpeed = newVelocity.dot(forward);

    // 4. CALCULATION PHASE: ROTATION (YAW & PITCH)
    // Yaw (Left/Right)
    const newYawVel = calculateYaw(
      currentAngularVelocityRef.current,
      turnInput,
      delta,
    );
    currentAngularVelocityRef.current = newYawVel;

    // Pitch (Up/Down) - Flight path alignment based on velocity vector
    const newPitchVel = calculatePitchVelocity(
      isInAir,
      physicsPos.y,
      physicsVel.y,
      currentForwardSpeed,
      currentRotationRef.current,
      currentPitchAngularVelocityRef.current,
      delta,
    );
    currentPitchAngularVelocityRef.current = newPitchVel;

    // Apply Rotations to internal Quaternion
    const euler = new Euler().setFromQuaternion(
      currentRotationRef.current,
      "YXZ",
    );
    euler.y += newYawVel * delta;

    if (isInAir) {
      euler.x += newPitchVel * delta;
      euler.x = MathUtils.clamp(
        euler.x,
        -SHIP_CONFIG.MAX_PITCH,
        SHIP_CONFIG.MAX_PITCH,
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
      newVelocity.z,
    ); // Start with X/Z calculated, Y from physics

    // Apply Custom Gravity / Hover Physics
    const verticalForce = calculateVerticalPhysics(
      isInAir,
      physicsPos.y,
      physicsVel.y,
      euler.x,
      delta,
    );
    finalVelocity.y += verticalForce; // Add the calculated Y change

    // Apply to Body - wrap in try-catch to catch physics conflicts
    try {
      rigidBodyRef.current.setLinvel(finalVelocity, true);
      rigidBodyRef.current.setRotation(currentRotationRef.current, true);
      rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true); // Kill physics rotation, we control it manually
    } catch (error) {
      console.error(`[SHIP] Error applying physics to ${controllerId}:`, error);
      // If we get an error, the RigidBody might be in an invalid state
      // Don't crash, just skip this frame
      return;
    }

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
      audio,
    });

    // 7. VISUALS PHASE
    // Banking
    const targetRoll = -turnInput * SHIP_CONFIG.BANKING_ANGLE;
    currentWingRollRef.current = MathUtils.lerp(
      currentWingRollRef.current,
      targetRoll,
      Math.min(1, delta * 8),
    );
    if (planeGroupRef.current) {
      planeGroupRef.current.rotation.z = currentWingRollRef.current;
    }

    // Thrust Visual
    const targetThrustVis = isInAir ? 1.0 : Math.abs(thrustInput);
    currentThrustRef.current = MathUtils.lerp(
      currentThrustRef.current,
      targetThrustVis,
      0.15,
    );
  });

  return (
    <>
      {!isDead && (
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
      )}
      {explosionPosition && (
        <ShipExplosion
          position={explosionPosition}
          onComplete={() => {
            setExplosionPosition(null);
          }}
        />
      )}
    </>
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
  delta: number,
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
  delta: number,
): number {
  const target = -input * PLAYER_MAX_ANGULAR_VELOCITY;
  const diff = target - currentYawVel;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  );

  if (Math.abs(diff) <= maxChange) return target;
  return currentYawVel + (diff > 0 ? 1 : -1) * maxChange;
}

// Flight path alignment: ship's nose points in the direction it's actually moving
function calculatePitchVelocity(
  isInAir: boolean,
  posY: number,
  velY: number,
  currentForwardSpeed: number,
  rotation: Quaternion,
  currentPitchVel: number,
  delta: number,
): number {
  let targetPitchAngVel = 0;
  const maxChange = Math.min(
    PLAYER_ANGULAR_ACCELERATION * delta,
    MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME,
  );

  if (isInAir) {
    // --- 1. NATURAL FLIGHT PATH LOGIC ---
    // Instead of arbitrary curves, we align the nose with the actual velocity vector.
    // atan2(y, x) gives the exact angle of the vector.

    // We clamp forward speed to a small min value to prevent divide-by-zero or weird flipping when stopped
    const safeForwardSpeed = Math.max(Math.abs(currentForwardSpeed), 1.0);

    // Calculate the "Flight Path Angle"
    // This is the angle the ship is actually moving through 3D space
    let targetAngle = Math.atan2(velY, safeForwardSpeed);

    // --- 2. ARCADE TWEAKS ---
    // Pure physics can feel a bit "laggy" visually. We amplify the look
    // just a bit to make it feel responsive, but clamp it so it doesn't look broken.
    const PITCH_AMPLIFIER = 1.2;
    targetAngle *= PITCH_AMPLIFIER;

    // Clamp total angle to ±45 degrees (or whatever MAX_PITCH you want)
    // to prevent the ship from doing loops or looking broken
    targetAngle = MathUtils.clamp(
      targetAngle,
      -SHIP_CONFIG.MAX_PITCH,
      SHIP_CONFIG.MAX_PITCH,
    );

    // --- 3. LEVELING OUT LOGIC (Landing Assist) ---
    // As we get close to the ground, force the nose level so we don't crash nose-first.
    const heightAboveHover = posY - SHIP_CONFIG.HOVER_HEIGHT;

    if (
      heightAboveHover <= SHIP_CONFIG.LEVELING_START_HEIGHT &&
      heightAboveHover > SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT
    ) {
      // Smoothly blend from "Flight Angle" to "0 Angle"
      const t =
        (heightAboveHover - SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT) /
        (SHIP_CONFIG.LEVELING_START_HEIGHT -
          SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT);
      // Smoothstep function for organic transition
      const smooth = t * t * (3 - 2 * t);
      targetAngle *= smooth;
    } else if (heightAboveHover <= SHIP_CONFIG.LEVELING_COMPLETE_HEIGHT) {
      targetAngle = 0;
    }

    // --- 4. CALCULATE ANGULAR VELOCITY ---
    const currentAngle = new Euler().setFromQuaternion(rotation, "YXZ").x;
    const diff = targetAngle - currentAngle;

    // PITCH_RESPONSIVENESS controls how "heavy" the nose feels.
    // Higher = Snaps to vector instantly. Lower = Drifts into alignment.
    targetPitchAngVel = MathUtils.clamp(
      diff * SHIP_CONFIG.PITCH_RESPONSIVENESS,
      -PLAYER_MAX_ANGULAR_VELOCITY,
      PLAYER_MAX_ANGULAR_VELOCITY,
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
  delta: number,
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
  delta: number,
  audio: ReturnType<typeof useAudio>,
  sendSignal: ReturnType<typeof useAirJamHost>["sendSignal"],
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

    // Play ability sound on host
    if (currentAbility.id === "speed_boost") {
      audio.play("speed_boost");
      sendSignal("HAPTIC", { pattern: "medium" }, id);
    } else if (currentAbility.id === "health_pack") {
      audio.play("health_pack");
      sendSignal("HAPTIC", { pattern: "success" }, id);
    } else if (currentAbility.id === "rocket") {
      audio.play("rocket_launch");
      sendSignal("HAPTIC", { pattern: "heavy" }, id);
    }

    console.log(
      `[SHIP] Ability activated for ${id}, ability: ${currentAbility.id}`,
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
  audio: ReturnType<typeof useAudio>;
  sendSignal: ReturnType<typeof useAirJamHost>["sendSignal"];
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
  audio,
  sendSignal,
}: HandleShootingParams) {
  const pressed = input.action && !lastActionRef.current;
  const held =
    input.action &&
    time - lastShootTimeRef.current >= SHIP_CONFIG.SHOOT_INTERVAL;

  if (pressed || held) {
    lastShootTimeRef.current = time;
    // Play laser fire sound on host
    audio.play("laser_fire");
    // Send light haptic feedback to controller
    sendSignal("HAPTIC", { pattern: "light" }, controllerId);

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
