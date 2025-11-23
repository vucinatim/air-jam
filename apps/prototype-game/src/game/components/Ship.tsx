/* eslint-disable react-refresh/only-export-components */

import { useFrame } from "@react-three/fiber";

import { useRef, memo, useMemo } from "react";

import { RigidBody, type RapierRigidBody } from "@react-three/rapier";

import * as THREE from "three";

import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
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
  const currentAngularVelocityRef = useRef(0);
  // We track rotation manually because we want "Arcade" turning, not "Physics" turning
  const currentRotationRef = useRef(new Quaternion());

  // Shooting state
  const lastActionRef = useRef(false);
  const lastShootTimeRef = useRef(0);
  const SHOOT_COOLDOWN = 0.1; // 100ms between shots
  const addLaser = useLasersStore((state) => state.addLaser);

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
    const thrust = smoothedInputRef.current.y;
    const turnInput = smoothedInputRef.current.x;

    // --- Velocity Math (Identical to your code) ---
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
    const targetVelocity = forward
      .clone()
      .multiplyScalar(thrust * PLAYER_MAX_SPEED);

    // Note: We read current velocity from our ref for calculation continuity
    const currentVelocity = currentVelocityRef.current.clone();
    const currentSpeed = currentVelocity.dot(forward);
    const targetSpeed = thrust * PLAYER_MAX_SPEED;
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

    // --- Angular Math (Identical to your code) ---
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

    // Update our internal Rotation Ref
    const rotationDelta = newAngVel * delta;
    const rotationQuaternion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      rotationDelta
    );
    currentRotationRef.current.premultiply(rotationQuaternion).normalize();

    // --- 2. APPLY TO PHYSICS (The Key Change) ---

    // Apply Velocity directly to the physics engine
    rigidBodyRef.current.setLinvel(newVelocity, true);

    // Force Rotation: We use setRotation because we don't want physics torques spinning the ship.
    // We want the ship to face exactly where we tell it to.
    rigidBodyRef.current.setRotation(currentRotationRef.current, true);

    // Reset Angular Velocity to 0 so collisions don't make the ship spin out of control
    rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // --- 3. SYNC CAMERA & GAME STATE ---
    // Use the actual Physics position for the camera now, so it respects walls
    const physicsPos = rigidBodyRef.current.translation();
    const shipWorldPos = new Vector3(physicsPos.x, physicsPos.y, physicsPos.z);
    shipPositions.set(controllerId, shipWorldPos);
    shipRotations.set(controllerId, currentRotationRef.current.clone());

    // --- 3.5. SHOOTING LOGIC ---
    const actionPressed = currentInput.action && !lastActionRef.current;
    const canShoot = time - lastShootTimeRef.current > SHOOT_COOLDOWN;

    if (actionPressed && canShoot) {
      lastShootTimeRef.current = time;

      // Gun barrel positions in local space (gun is 1.5 units long, tip is at z = 0.2 + 0.75 = 0.95)
      const gunTipOffset = 0.95;
      const leftGunLocal = new Vector3(-1.6, 0.0, gunTipOffset);
      const rightGunLocal = new Vector3(1.6, 0.0, gunTipOffset);

      // Transform to world space
      const leftGunWorld = leftGunLocal
        .applyQuaternion(shipQuaternion)
        .add(shipWorldPos);
      const rightGunWorld = rightGunLocal
        .applyQuaternion(shipQuaternion)
        .add(shipWorldPos);

      // Forward direction (ship's forward is -Z)
      const forwardDir = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);

      // Offset laser spawn position forward to ensure it's outside ship's collider
      // Ship body is 3.0 units long, offset by 2 units forward to be safe and prevent sticking
      const spawnOffset = forwardDir.clone().multiplyScalar(2.0);
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
    const targetThrust = Math.abs(thrust);
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
