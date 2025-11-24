/* eslint-disable react-refresh/only-export-components */

import { useFrame } from "@react-three/fiber";

import { useRef, memo, useMemo, useEffect } from "react";

import { RigidBody, type RapierRigidBody } from "@react-three/rapier";

import * as THREE from "three";

import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  MathUtils,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
} from "three";

// Track ship positions for camera following
export const shipPositions = new Map<string, Vector3>();
export const shipRotations = new Map<string, Quaternion>();

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

// ... Shaders omitted for brevity (keep them as is) ...
const exhaustVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const exhaustFragment = `
  uniform float uTime;
  uniform float uThrust;
  varying vec2 vUv;
  void main() {
    float alpha = smoothstep(0.0, 1.0, 1.0 - vUv.y);
    float noise = sin(vUv.y * 20.0 - uTime * 15.0) * 0.5 + 0.5;
    vec3 baseColor = vec3(0.0, 0.8, 1.0);
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 finalColor = mix(baseColor, coreColor, noise * uThrust);
    gl_FragColor = vec4(finalColor, alpha * alpha * (0.5 + uThrust));
  }
`;

interface ShipProps {
  controllerId: string;
  position: [number, number, number];
}

function ShipComponent({ controllerId, position: initialPosition }: ShipProps) {
  const spawnPosition = useMemo(() => initialPosition, [initialPosition]);

  // Refs
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const planeGroupRef = useRef<THREE.Group>(null); // Inner rotation (banking)

  // FX Refs
  const flameLRef = useRef<THREE.Mesh>(null);
  const flameRRef = useRef<THREE.Mesh>(null);
  const lightLRef = useRef<THREE.PointLight>(null);
  const lightRRef = useRef<THREE.PointLight>(null);
  const exhaustMaterialLRef = useRef<THREE.ShaderMaterial>(null);
  const exhaustMaterialRRef = useRef<THREE.ShaderMaterial>(null);

  // Logic State
  const currentThrustRef = useRef(0);
  const smoothedInputRef = useRef({ x: 0, y: 0 });
  const currentWingRollRef = useRef(0);
  // Use the ref passed from parent - no need to sync, it's already a ref!

  // We track velocity/rotation in Refs to preserve your math logic
  const currentVelocityRef = useRef(new Vector3(0, 0, 0));
  const currentAngularVelocityRef = useRef(0); // Yaw (rotation around Y axis)
  const currentPitchAngularVelocityRef = useRef(0); // Pitch (rotation around X axis)
  // We track rotation manually because we want "Arcade" turning, not "Physics" turning
  const currentRotationRef = useRef(new Quaternion());

  // Shooting state
  const lastActionRef = useRef(false);
  const lastShootTimeRef = useRef(0);
  const lastAbilityRef = useRef(false);
  const HOLD_SHOOT_INTERVAL = 0.2; // 50ms between shots when button is held
  const addLaser = useLasersStore((state) => state.addLaser);

  // Ability state
  const abilitiesStore = useAbilitiesStore.getState();
  const playerStatsStore = usePlayerStatsStore.getState();
  // Get ability for rendering visual components
  const currentAbility = useAbilitiesStore((state) =>
    state.getAbility(controllerId)
  );
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId)
  );
  // Get ability visual component if ability is equipped but not activated
  const abilityVisual =
    currentAbility && !isAbilityActive
      ? getAbilityVisual(currentAbility.id, controllerId)
      : null;

  // Initialize player stats
  useEffect(() => {
    playerStatsStore.initializeStats(controllerId);
    return () => {
      playerStatsStore.removeStats(controllerId);
    };
  }, [controllerId, playerStatsStore]);

  // Shape functions for wings and fins
  const createWingShape = useMemo(() => {
    return () => {
      const shape = new Shape();
      shape.moveTo(0, 0);
      shape.lineTo(2.0, -1.0);
      shape.lineTo(2.0, -2.0);
      shape.lineTo(0, -1.5);
      return shape;
    };
  }, []);

  const createFinShape = useMemo(() => {
    return () => {
      const shape = new Shape();
      shape.moveTo(0, 0); // Bottom Rear
      shape.lineTo(0, 1.0); // Top Rear (Vertical edge)
      shape.lineTo(-0.5, 1.0); // Top Flat
      shape.lineTo(-1.0, 0.0); // Bottom Front (Sloped leading edge)
      shape.lineTo(0, 0);
      return shape;
    };
  }, []);

  // Ship geometries
  const shipGeometries = useMemo(() => {
    return {
      body: new BoxGeometry(1.2, 0.8, 3.0),
      nose: new CylinderGeometry(0, 1, 1.5, 4, 1, false, Math.PI / 4),
      wing: new ExtrudeGeometry(createWingShape(), {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 1,
      }),
      fin: new ExtrudeGeometry(createFinShape(), {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 1,
      }),
      cockpit: new BoxGeometry(0.9, 0.4, 1.2),
      nozzle: new CylinderGeometry(0.35, 0.25, 0.8, 8),
      gun: new CylinderGeometry(0.1, 0.1, 1.5, 6),
    };
  }, [createWingShape, createFinShape]);

  // Ship materials
  const shipMaterials = useMemo(() => {
    return {
      playerBody: new MeshStandardMaterial({
        color: 0x8899aa,
        roughness: 0.4,
        metalness: 0.7,
        flatShading: true,
      }),
      playerWing: new MeshStandardMaterial({
        color: 0xff4444,
        roughness: 0.6,
        metalness: 0.2,
        flatShading: true,
      }),
      cockpit: new MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.1,
        metalness: 0.9,
      }),
      gun: new MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.7,
        metalness: 0.5,
      }),
      nozzle: new MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
      }),
    };
  }, []);

  // Geometry and Uniforms
  const exhaustGeometry = useMemo(() => {
    const geo = new CylinderGeometry(0.1, 0.4, 2.5, 12, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 1.2);
    return geo;
  }, []);

  const exhaustUniformsL = useMemo(
    () => ({ uTime: { value: 0 }, uThrust: { value: 0.0 } }),
    []
  );
  const exhaustUniformsR = useMemo(
    () => ({ uTime: { value: 0 }, uThrust: { value: 0.0 } }),
    []
  );

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;

    // --- 1. YOUR LOGIC (Keep the math, change the application) ---
    const time = state.clock.elapsedTime;
    // Read input directly from store (no rerenders needed!)
    const storeState = useGameStore.getState();
    const player = storeState.players.find(
      (p) => p.controllerId === controllerId
    );
    const currentInput = player?.input ?? {
      vector: { x: 0, y: 0 },
      action: false,
      ability: false,
      timestamp: 0,
    };

    // Smooth Input
    const inputSmoothAlpha = 1 - Math.exp(-delta / PLAYER_INPUT_SMOOTH_TIME);
    smoothedInputRef.current.x = MathUtils.lerp(
      smoothedInputRef.current.x,
      currentInput.vector.x,
      inputSmoothAlpha
    );
    smoothedInputRef.current.y = MathUtils.lerp(
      smoothedInputRef.current.y,
      currentInput.vector.y,
      inputSmoothAlpha
    );

    // NOTE: We read rotation from our manual ref, not the physics body, to keep control absolute
    const shipQuaternion = currentRotationRef.current.clone();

    // Get current physics position to determine control mode
    const physicsPos = rigidBodyRef.current.translation();
    const HOVER_HEIGHT = 5; // Minimum Y position (original spawn height)
    const AIR_MODE_THRESHOLD = 0.5; // Small threshold to avoid flickering
    const isInAir = physicsPos.y > HOVER_HEIGHT + AIR_MODE_THRESHOLD;

    // Determine control mode
    let thrust: number;
    let turnInput: number;

    if (isInAir) {
      // AIR MODE: Airplane-style controls
      thrust = 1.0; // Always max forward thrust
      turnInput = smoothedInputRef.current.x; // Left/right controls yaw (turning)
      // Pitch is now automatic - no player input
    } else {
      // GROUND MODE: Current controls
      thrust = smoothedInputRef.current.y; // Forward/backward controls thrust
      turnInput = smoothedInputRef.current.x; // Left/right controls yaw
    }

    // --- Ability handling (Simple - abilities modify store directly!) ---
    const abilityPressed = currentInput.ability && !lastAbilityRef.current;
    const currentAbility = abilitiesStore.getAbility(controllerId);
    const isAbilityActive = abilitiesStore.isAbilityActive(controllerId);
    const hasAbilityInSlot = currentAbility !== null;

    // Activate ability on button press (if ability is in slot but not yet activated)
    if (
      abilityPressed &&
      hasAbilityInSlot &&
      currentAbility.startTime === null
    ) {
      abilitiesStore.activateAbility(controllerId, currentAbility.id);
    }

    // Check if ability expired and clear it
    if (
      currentAbility &&
      !isAbilityActive &&
      currentAbility.startTime !== null
    ) {
      abilitiesStore.clearAbility(controllerId);
    }

    lastAbilityRef.current = currentInput.ability;

    // Read speed multiplier from store (abilities modify it directly!)
    const speedMultiplier = playerStatsStore.getSpeedMultiplier(controllerId);

    // --- Velocity Math (Identical to your code) ---
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
    const targetVelocity = forward
      .clone()
      .multiplyScalar(thrust * PLAYER_MAX_SPEED * speedMultiplier);

    // Note: We read current velocity from our ref for calculation continuity
    const currentVelocity = currentVelocityRef.current.clone();
    const currentSpeed = currentVelocity.dot(forward);
    const targetSpeed = thrust * PLAYER_MAX_SPEED * speedMultiplier;
    const speedDifference = targetSpeed - currentSpeed;

    const isAccelerating =
      Math.abs(targetSpeed) > Math.abs(currentSpeed) ||
      targetSpeed * currentSpeed < 0;
    const accelerationRate = isAccelerating
      ? PLAYER_ACCELERATION
      : PLAYER_DECELERATION;
    const maxVelocityChange = Math.min(
      accelerationRate * delta,
      MAX_VELOCITY_CHANGE_PER_FRAME
    );

    let newVelocity: Vector3;
    if (Math.abs(speedDifference) <= maxVelocityChange) {
      newVelocity = targetVelocity.clone();
    } else {
      const direction = speedDifference > 0 ? 1 : -1;
      const speedChange = direction * maxVelocityChange;
      const newSpeed = currentSpeed + speedChange;
      newVelocity = forward.clone().multiplyScalar(newSpeed);
    }

    currentVelocityRef.current.copy(newVelocity);

    // --- Angular Math (Yaw - rotation around Y axis) ---
    const targetAngVel = -turnInput * PLAYER_MAX_ANGULAR_VELOCITY;
    const currentAngVel = currentAngularVelocityRef.current;
    const angVelDifference = targetAngVel - currentAngVel;
    const maxAngVelChange = Math.min(
      PLAYER_ANGULAR_ACCELERATION * delta,
      MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME
    );

    let newAngVel = currentAngVel;
    if (Math.abs(angVelDifference) <= maxAngVelChange) {
      newAngVel = targetAngVel;
    } else {
      const direction = angVelDifference > 0 ? 1 : -1;
      newAngVel = currentAngVel + direction * maxAngVelChange;
    }
    currentAngularVelocityRef.current = newAngVel;

    // --- Pitch Math (rotation around X axis) - pitch follows derivative of parabola (vertical velocity) ---
    let targetPitchAngVel = 0;
    if (isInAir) {
      const MAX_PITCH_ANGLE = Math.PI / 4; // ±45 degrees
      const MAX_VERTICAL_VELOCITY = 30; // Maximum vertical velocity to map to max pitch

      // Get current vertical velocity (derivative of height - this is what we want!)
      const currentPhysicsVelForPitch = rigidBodyRef.current.linvel();
      const verticalVelocity = currentPhysicsVelForPitch.y;

      // Calculate height for leveling out near landing
      const heightAboveHover = physicsPos.y - HOVER_HEIGHT;
      const AIR_MODE_THRESHOLD = 0.5; // Same as used for isInAir check
      const LEVELING_START_HEIGHT = 6; // Height where leveling transition starts
      const LEVELING_COMPLETE_HEIGHT = AIR_MODE_THRESHOLD + 0.5; // Complete leveling just above air mode threshold (1.0 units above hover)

      // Pitch is proportional to vertical velocity (derivative of parabola)
      // Positive velocity (going up) = nose up, negative velocity (going down) = nose down
      let targetPitchAngle = 0;

      // Calculate velocity-based pitch
      const clampedVelocity = Math.max(
        -MAX_VERTICAL_VELOCITY,
        Math.min(MAX_VERTICAL_VELOCITY, verticalVelocity)
      );
      const normalizedVelocity = clampedVelocity / MAX_VERTICAL_VELOCITY;
      // Apply power curve to make it steeper at the ends (more extreme tilt)
      const steepnessFactor = 0.6; // Lower = steeper at ends
      const curvedVelocity =
        Math.sign(normalizedVelocity) *
        Math.pow(Math.abs(normalizedVelocity), steepnessFactor);
      const velocityBasedPitch = curvedVelocity * MAX_PITCH_ANGLE;

      // Smoothly transition to level pitch as ship approaches hover height
      if (heightAboveHover > LEVELING_START_HEIGHT) {
        // High up - use full velocity-based pitch
        targetPitchAngle = velocityBasedPitch;
      } else if (heightAboveHover > LEVELING_COMPLETE_HEIGHT) {
        // Transition zone - smoothly blend from velocity-based to level
        // Normalize height in transition zone: 1.0 = start, 0.0 = end (fully level)
        const transitionFactor =
          (heightAboveHover - LEVELING_COMPLETE_HEIGHT) /
          (LEVELING_START_HEIGHT - LEVELING_COMPLETE_HEIGHT);
        // Smooth interpolation (smoothstep) - ensures it reaches 0 at LEVELING_COMPLETE_HEIGHT
        const smoothFactor =
          transitionFactor * transitionFactor * (3 - 2 * transitionFactor);
        targetPitchAngle = velocityBasedPitch * smoothFactor;
      } else {
        // At or below completion height - fully level (no pitch)
        targetPitchAngle = 0;
      }

      // Get current pitch angle
      const euler = new Euler().setFromQuaternion(
        currentRotationRef.current,
        "YXZ"
      );
      const currentPitchAngle = euler.x;

      // Calculate desired pitch velocity to smoothly interpolate to target angle
      const pitchAngleDifference = targetPitchAngle - currentPitchAngle;

      // Calculate target angular velocity based on angle difference
      // Scale the difference to get a reasonable target velocity
      const PITCH_RESPONSIVENESS = 2.0; // How quickly pitch responds
      targetPitchAngVel = Math.max(
        -PLAYER_MAX_ANGULAR_VELOCITY,
        Math.min(
          PLAYER_MAX_ANGULAR_VELOCITY,
          pitchAngleDifference * PITCH_RESPONSIVENESS
        )
      );
    }

    const currentPitchAngVel = currentPitchAngularVelocityRef.current;
    const pitchAngVelDifference = targetPitchAngVel - currentPitchAngVel;

    let newPitchAngVel = currentPitchAngVel;
    if (Math.abs(pitchAngVelDifference) <= maxAngVelChange) {
      newPitchAngVel = targetPitchAngVel;
    } else {
      const direction = pitchAngVelDifference > 0 ? 1 : -1;
      newPitchAngVel = currentPitchAngVel + direction * maxAngVelChange;
    }
    currentPitchAngularVelocityRef.current = newPitchAngVel;

    // Update our internal Rotation Ref
    // For proper airplane controls:
    // - Yaw rotates around local Y axis (turning left/right)
    // - Pitch rotates around local X axis (nose up/down)
    //
    // Using Euler angles for clarity: YXZ order (yaw around Y, pitch around X, roll around Z)
    // This gives us the correct airplane control behavior

    // Convert current rotation to Euler angles
    const euler = new Euler().setFromQuaternion(
      currentRotationRef.current,
      "YXZ"
    );

    // Apply yaw rotation (around Y axis)
    euler.y += newAngVel * delta;

    // Apply pitch rotation (around X axis)
    if (isInAir) {
      euler.x += newPitchAngVel * delta;
      // Clamp pitch to ±45 degrees to prevent over-rotation
      euler.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, euler.x));
    } else {
      // Smoothly transition pitch to 0 when on ground (instead of instant snap)
      // This prevents the jump in tilt when transitioning from air to ground
      const PITCH_RESET_SPEED = 5.0; // How fast to reset pitch (radians per second)
      const targetPitch = 0;
      const pitchDifference = targetPitch - euler.x;
      const maxPitchChange = PITCH_RESET_SPEED * delta;

      if (Math.abs(pitchDifference) <= maxPitchChange) {
        euler.x = targetPitch;
      } else {
        const direction = pitchDifference > 0 ? 1 : -1;
        euler.x += direction * maxPitchChange;
      }
    }

    // Convert back to quaternion
    currentRotationRef.current.setFromEuler(euler);
    currentRotationRef.current.normalize();

    // --- 2. APPLY TO PHYSICS (The Key Change) ---

    // Get current physics velocity
    const currentPhysicsVel = rigidBodyRef.current.linvel();
    const finalVelocity = new Vector3(
      newVelocity.x,
      currentPhysicsVel.y, // Preserve Y velocity (allows jumps to work)
      newVelocity.z
    );

    // Check if ship has significant upward velocity (from jump pad launch)
    const UPWARD_VELOCITY_THRESHOLD = 10; // If moving up faster than this, assume launched
    const isBeingLaunched = currentPhysicsVel.y > UPWARD_VELOCITY_THRESHOLD;

    // Only apply gravity if ship is above hover height
    if (isInAir) {
      // Get pitch angle from current rotation (euler.x is pitch in YXZ order)
      const euler = new Euler().setFromQuaternion(
        currentRotationRef.current,
        "YXZ"
      );
      const pitchAngle = euler.x; // Positive = nose up, Negative = nose down

      // Base gravity - always pulls down
      const BASE_GRAVITY = -5;
      // Maximum additional gravity when diving (nose down)
      const MAX_DIVE_GRAVITY = -15;
      // Maximum lift when climbing (nose up) - reduced to prevent infinite upward flight
      const MAX_LIFT = 3;

      // Calculate gravity based on pitch:
      // - When pitch is negative (nose down), add more downward force
      // - When pitch is positive (nose up), reduce downward force (or add upward)
      // Pitch ranges from -PI/4 to PI/4 (±45 degrees)
      const pitchNormalized = pitchAngle / (Math.PI / 4); // Normalize to -1 to 1

      // When diving (pitch < 0), increase gravity
      // When climbing (pitch > 0), reduce gravity or add lift
      let gravityEffect = BASE_GRAVITY;
      if (pitchNormalized < 0) {
        // Nose down - subtract extra downward force (pitchNormalized is negative, so this adds more negative)
        gravityEffect = BASE_GRAVITY - pitchNormalized * MAX_DIVE_GRAVITY;
      } else {
        // Nose up - add lift (reduce downward force or make it upward)
        gravityEffect = BASE_GRAVITY + pitchNormalized * MAX_LIFT;
      }

      // Apply pitch-based gravity
      finalVelocity.y += gravityEffect * delta;
      // Clamp to prevent falling too fast or rising too fast
      finalVelocity.y = Math.max(finalVelocity.y, -40); // Allow faster diving
      finalVelocity.y = Math.min(finalVelocity.y, 30); // Allow climbing
    } else {
      // At or below hover height - but don't interfere if ship is being launched upward
      if (isBeingLaunched) {
        // Ship is being launched - let it go! Don't apply restoring force
        // The jump pad will handle the launch, we just preserve the velocity
      } else {
        // Not being launched - apply normal hover height restoration
        const heightDifference = physicsPos.y - HOVER_HEIGHT;

        // If ship is not at exact hover height, apply a restoring force
        if (Math.abs(heightDifference) > 0.01) {
          // Apply a strong restoring force to snap back to hover height
          const RESTORE_FORCE = 20; // Strong force to quickly restore position
          finalVelocity.y -= heightDifference * RESTORE_FORCE * delta;
          // Clamp velocity to prevent overshooting
          finalVelocity.y = Math.max(-10, Math.min(10, finalVelocity.y));
        } else {
          // Very close to hover height - just stop vertical movement
          finalVelocity.y = 0;
          // Snap to exact position if very close
          if (Math.abs(heightDifference) > 0.001) {
            rigidBodyRef.current.setTranslation(
              { x: physicsPos.x, y: HOVER_HEIGHT, z: physicsPos.z },
              true
            );
          }
        }
      }

      // If ship somehow got below hover height, push it back up immediately
      // But only if not being launched upward
      if (physicsPos.y < HOVER_HEIGHT && !isBeingLaunched) {
        rigidBodyRef.current.setTranslation(
          { x: physicsPos.x, y: HOVER_HEIGHT, z: physicsPos.z },
          true
        );
        finalVelocity.y = 0;
      }
    }

    // Apply Velocity directly to the physics engine
    rigidBodyRef.current.setLinvel(finalVelocity, true);

    // Force Rotation: We use setRotation because we don't want physics torques spinning the ship.
    // We want the ship to face exactly where we tell it to.
    rigidBodyRef.current.setRotation(currentRotationRef.current, true);

    // Reset Angular Velocity to 0 so collisions don't make the ship spin out of control
    rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // --- 3. SYNC CAMERA & GAME STATE ---
    // Use the actual Physics position for the camera now, so it respects walls
    const shipWorldPos = new Vector3(physicsPos.x, physicsPos.y, physicsPos.z);
    shipPositions.set(controllerId, shipWorldPos);
    shipRotations.set(controllerId, currentRotationRef.current.clone());

    // --- 3.5. SHOOTING LOGIC ---
    const actionPressed = currentInput.action && !lastActionRef.current;
    const actionHeld = currentInput.action;
    const timeSinceLastShot = time - lastShootTimeRef.current;

    // Shoot on click (no cooldown) or when held with fast interval
    const shouldShoot =
      actionPressed || (actionHeld && timeSinceLastShot >= HOLD_SHOOT_INTERVAL);

    if (shouldShoot) {
      lastShootTimeRef.current = time;

      // Gun barrel positions in local space (gun is 1.5 units long, tip is at z = 0.2 + 0.75 = 0.95)
      const gunTipOffset = 0.95;
      const leftGunLocal = new Vector3(-1.5, 0.0, gunTipOffset);
      const rightGunLocal = new Vector3(1.5, 0.0, gunTipOffset);

      // Use updated rotation for shooting (after rotation updates)
      const currentShipRotation = currentRotationRef.current;

      // Transform to world space
      const leftGunWorld = leftGunLocal
        .applyQuaternion(currentShipRotation)
        .add(shipWorldPos);
      const rightGunWorld = rightGunLocal
        .applyQuaternion(currentShipRotation)
        .add(shipWorldPos);

      // Forward direction (ship's forward is -Z)
      const forwardDir = new Vector3(0, 0, -1).applyQuaternion(
        currentShipRotation
      );
      // Up direction (ship's up is +Y)
      const upDir = new Vector3(0, 1, 0).applyQuaternion(currentShipRotation);

      // Offset laser spawn position forward and upward to ensure it's outside ship's collider
      // Increased forward offset to prevent clipping through ship, and added upward offset
      const forwardOffset = forwardDir.clone().multiplyScalar(3.5);
      const upwardOffset = upDir.clone().multiplyScalar(0.5);
      const spawnOffset = forwardOffset.add(upwardOffset);
      const leftGunSpawnPos = leftGunWorld.clone().add(spawnOffset);
      const rightGunSpawnPos = rightGunWorld.clone().add(spawnOffset);

      // Spawn lasers from both guns
      const laserId1 = `${controllerId}-${time}-L`;
      const laserId2 = `${controllerId}-${time}-R`;

      addLaser({
        id: laserId1,
        position: [leftGunSpawnPos.x, leftGunSpawnPos.y, leftGunSpawnPos.z],
        direction: forwardDir.clone(),
        controllerId,
        timestamp: time,
      });

      addLaser({
        id: laserId2,
        position: [rightGunSpawnPos.x, rightGunSpawnPos.y, rightGunSpawnPos.z],
        direction: forwardDir.clone(),
        controllerId,
        timestamp: time,
      });
    }

    lastActionRef.current = currentInput.action;

    // --- 4. VISUAL FX (Banking & Exhaust) ---
    // Plane roll animation (Banking)
    const maxWingRoll = Math.PI / 6;
    const targetWingRoll = -turnInput * maxWingRoll;
    const wingRollSmoothFactor = Math.min(1, delta * 8);
    currentWingRollRef.current = MathUtils.lerp(
      currentWingRollRef.current,
      targetWingRoll,
      wingRollSmoothFactor
    );

    if (planeGroupRef.current) {
      planeGroupRef.current.rotation.z = currentWingRollRef.current;
    }

    // ... [Keep your Exhaust/Flame/Light logic here exactly as is] ...
    // In air mode, always show max thrust visually
    const targetThrust = isInAir ? 1.0 : Math.abs(thrust);
    const newThrust = MathUtils.lerp(
      currentThrustRef.current,
      targetThrust,
      0.15
    );
    currentThrustRef.current = newThrust;
    const isMovingBackward = thrust < 0;
    const flameRotation = isMovingBackward ? Math.PI : 0;

    if (exhaustMaterialLRef.current) {
      exhaustMaterialLRef.current.uniforms.uTime.value = time;
      exhaustMaterialLRef.current.uniforms.uThrust.value = newThrust;
    }
    if (exhaustMaterialRRef.current) {
      exhaustMaterialRRef.current.uniforms.uTime.value = time;
      exhaustMaterialRRef.current.uniforms.uThrust.value = newThrust;
    }
    if (flameLRef.current) {
      flameLRef.current.scale.z = newThrust > 0 ? 0.5 + newThrust * 2.0 : 0.5;
      flameLRef.current.rotation.y = flameRotation;
    }
    if (flameRRef.current) {
      flameRRef.current.scale.z = newThrust > 0 ? 0.5 + newThrust * 2.0 : 0.5;
      flameRRef.current.rotation.y = flameRotation;
    }
    if (lightLRef.current) {
      lightLRef.current.intensity = 2 + newThrust * 10;
      lightLRef.current.distance = 5 + newThrust * 2;
    }
    if (lightRRef.current) {
      lightRRef.current.intensity = 2 + newThrust * 10;
      lightRRef.current.distance = 5 + newThrust * 2;
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      // DYNAMIC is crucial for collisions. It stops at walls.
      type="dynamic"
      position={spawnPosition}
      // Lock rotations so physics collisions don't spin the ship (we handle rotation manually)
      lockRotations
      // Add some damping so it doesn't feel like it's on ice if we stop applying velocity
      linearDamping={0.5}
      colliders="cuboid" // Or "hull" for tighter fit
      userData={{ controllerId }}
    >
      {/* The Visuals are now INSIDE the RigidBody.
         Because they are children, Rapier will automatically interpolate
         their position if you enable interpolate={true} in <Physics>
      */}
      <group ref={planeGroupRef}>
        {/* Main Body */}
        <mesh castShadow receiveShadow>
          <primitive object={shipGeometries.body} attach="geometry" />
          <primitive object={shipMaterials.playerBody} attach="material" />
        </mesh>

        {/* Nose Cone */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.6, 1, 0.4]}
          position={[0, 0, -2.25]}
          castShadow
        >
          <primitive object={shipGeometries.nose} attach="geometry" />
          <primitive object={shipMaterials.playerBody} attach="material" />
        </mesh>

        {/* Wings */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0.6, 0.1, -0.2]}
          castShadow
        >
          <primitive object={shipGeometries.wing} attach="geometry" />
          <primitive object={shipMaterials.playerWing} attach="material" />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[-1, 1, 1]}
          position={[-0.6, 0.1, -0.2]}
          castShadow
        >
          <primitive object={shipGeometries.wing} attach="geometry" />
          <primitive object={shipMaterials.playerWing} attach="material" />
        </mesh>

        {/* Tail Fins */}
        <group position={[-0.3, 0.4, 1.4]} rotation={[0, 0, 0.8]}>
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <primitive object={shipGeometries.fin} attach="geometry" />
            <primitive object={shipMaterials.playerWing} attach="material" />
          </mesh>
        </group>
        <group position={[0.3, 0.4, 1.4]} rotation={[0, 0, -0.8]}>
          <mesh rotation={[0, -Math.PI / 2, 0]} scale={[1, 1, -1]}>
            <primitive object={shipGeometries.fin} attach="geometry" />
            <primitive object={shipMaterials.playerWing} attach="material" />
          </mesh>
        </group>

        {/* Cockpit */}
        <mesh position={[0, 0.45, -0.5]}>
          <primitive object={shipGeometries.cockpit} attach="geometry" />
          <primitive object={shipMaterials.cockpit} attach="material" />
        </mesh>

        {/* Ability Visual Components - rendered by abilities themselves */}
        {abilityVisual}

        {/* Guns */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[-1.6, 0.0, 0.2]}>
          <primitive object={shipGeometries.gun} attach="geometry" />
          <primitive object={shipMaterials.gun} attach="material" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[1.6, 0.0, 0.2]}>
          <primitive object={shipGeometries.gun} attach="geometry" />
          <primitive object={shipMaterials.gun} attach="material" />
        </mesh>

        {/* Engines */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[-0.5, 0, 1.8]}>
          <primitive object={shipGeometries.nozzle} attach="geometry" />
          <primitive object={shipMaterials.nozzle} attach="material" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 1.8]}>
          <primitive object={shipGeometries.nozzle} attach="geometry" />
          <primitive object={shipMaterials.nozzle} attach="material" />
        </mesh>

        {/* Exhaust Flames */}
        <mesh ref={flameLRef} position={[-0.5, 0, 1.8]}>
          <primitive object={exhaustGeometry} attach="geometry" />
          <shaderMaterial
            ref={exhaustMaterialLRef}
            uniforms={exhaustUniformsL}
            vertexShader={exhaustVertex}
            fragmentShader={exhaustFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={flameRRef} position={[0.5, 0, 1.8]}>
          <primitive object={exhaustGeometry} attach="geometry" />
          <shaderMaterial
            ref={exhaustMaterialRRef}
            uniforms={exhaustUniformsR}
            vertexShader={exhaustVertex}
            fragmentShader={exhaustFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Engine Lights */}
        <pointLight
          ref={lightLRef}
          position={[-0.5, 0, 2.5]}
          color={0x00ffff}
          intensity={2}
          distance={4}
        />
        <pointLight
          ref={lightRRef}
          position={[0.5, 0, 2.5]}
          color={0x00ffff}
          intensity={2}
          distance={4}
        />
      </group>
    </RigidBody>
  );
}

export const Ship = memo(ShipComponent, (prevProps, nextProps) => {
  // Since we read input directly from store in useFrame, we don't need input as a prop
  // Component only rerenders if controllerId or position changes
  return (
    prevProps.controllerId === nextProps.controllerId &&
    prevProps.position[0] === nextProps.position[0] &&
    prevProps.position[1] === nextProps.position[1] &&
    prevProps.position[2] === nextProps.position[2]
  );
});
