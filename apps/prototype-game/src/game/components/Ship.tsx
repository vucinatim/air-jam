/* eslint-disable react-refresh/only-export-components */
import { useFrame } from "@react-three/fiber";
import { useRef, useEffect, memo } from "react";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useMemo } from "react";
import {
  AdditiveBlending,
  CylinderGeometry,
  MathUtils,
  Quaternion,
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
import type { InputState } from "../game-store";
import { PhysicsRecorder } from "./PhysicsRecorder";

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
  input: InputState;
  position: [number, number, number];
}

function ShipComponent({
  controllerId,
  input,
  position: initialPosition,
}: ShipProps) {
  const spawnPosition = useMemo(() => initialPosition, [initialPosition]);
  const flameLRef = useRef<THREE.Mesh>(null);
  const flameRRef = useRef<THREE.Mesh>(null);
  const lightLRef = useRef<THREE.PointLight>(null);
  const lightRRef = useRef<THREE.PointLight>(null);
  const exhaustMaterialLRef = useRef<THREE.ShaderMaterial>(null);
  const exhaustMaterialRRef = useRef<THREE.ShaderMaterial>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const planeGroupRef = useRef<THREE.Group>(null);
  const currentThrustRef = useRef(0);
  const smoothedInputRef = useRef({ x: 0, y: 0 });
  const currentWingRollRef = useRef(0);
  // Store input in ref to avoid re-renders on input prop changes
  const inputRef = useRef<InputState>(input);
  // Ref for passing debug data to recorder
  const debugDataRef = useRef({
    smoothedInput: { x: 0, y: 0 },
    velocityChange: { x: 0, y: 0, z: 0 },
    angularVelocityChange: { x: 0, y: 0, z: 0 },
  });

  // Update input ref when prop changes (without causing re-render)
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Create exhaust geometry once
  const exhaustGeometry = useMemo(() => {
    const geo = new CylinderGeometry(0.0, 0.2, 2, 12, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 1);
    return geo;
  }, []);

  // Create exhaust uniforms
  const exhaustUniformsL = useMemo(
    () => ({
      uTime: { value: 0 },
      uThrust: { value: 0.0 },
    }),
    []
  );
  const exhaustUniformsR = useMemo(
    () => ({
      uTime: { value: 0 },
      uThrust: { value: 0.0 },
    }),
    []
  );

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;

    const body = rigidBodyRef.current;
    const time = state.clock.elapsedTime;

    // Read input from ref to avoid closure issues and re-renders
    const currentInput = inputRef.current;

    // Smooth input values using exponential decay (frame-rate independent)
    // Uses time constant for consistent smoothing regardless of frame rate
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

    // Track position and rotation for camera following
    const pos = body.translation();
    const rot = body.rotation();
    shipPositions.set(controllerId, new Vector3(pos.x, pos.y, pos.z));
    shipRotations.set(controllerId, new Quaternion(rot.x, rot.y, rot.z, rot.w));

    // Get current rotation from physics body
    const bodyRotation = body.rotation();
    const shipQuaternion = new Quaternion(
      bodyRotation.x,
      bodyRotation.y,
      bodyRotation.z,
      bodyRotation.w
    );

    body.wakeUp();

    // ===== VELOCITY-BASED CONTROLLER WITH SMOOTH ACCELERATION/DECELERATION =====
    const thrust = smoothedInputRef.current.y;
    const turnInput = smoothedInputRef.current.x;

    // Forward direction
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);

    // Target velocity in world space
    const targetVelocity = forward
      .clone()
      .multiplyScalar(thrust * PLAYER_MAX_SPEED);

    // Current velocity
    const currentVel = body.linvel();
    const currentVelocity = new Vector3(
      currentVel.x,
      currentVel.y,
      currentVel.z
    );

    // Project current velocity onto forward direction
    const currentSpeed = currentVelocity.dot(forward);
    const targetSpeed = thrust * PLAYER_MAX_SPEED;
    const speedDifference = targetSpeed - currentSpeed;

    // Choose acceleration or deceleration rate based on whether we're speeding up or slowing down
    // We're accelerating if moving toward the target speed or if changing direction
    const isAccelerating =
      Math.abs(targetSpeed) > Math.abs(currentSpeed) ||
      (targetSpeed > 0 && currentSpeed < 0) ||
      (targetSpeed < 0 && currentSpeed > 0);
    const accelerationRate = isAccelerating
      ? PLAYER_ACCELERATION
      : PLAYER_DECELERATION;

    // Calculate maximum velocity change this frame (frame-rate independent acceleration)
    // Cap it to prevent large jumps at low frame rates
    const maxVelocityChange = Math.min(
      accelerationRate * delta,
      MAX_VELOCITY_CHANGE_PER_FRAME
    );

    // Apply acceleration/deceleration smoothly along forward direction
    let newVelocity: Vector3;
    if (Math.abs(speedDifference) <= maxVelocityChange) {
      // We can reach target velocity this frame
      newVelocity = targetVelocity.clone();
    } else {
      // Gradually accelerate/decelerate toward target
      const direction = speedDifference > 0 ? 1 : -1;
      const speedChange = direction * maxVelocityChange;
      const newSpeed = currentSpeed + speedChange;
      newVelocity = forward.clone().multiplyScalar(newSpeed);

      // Decelerate any perpendicular velocity component (sideways drift when turning)
      // This ensures smooth direction changes
      const perpendicularVelocity = new Vector3().subVectors(
        currentVelocity,
        forward.clone().multiplyScalar(currentSpeed)
      );
      if (perpendicularVelocity.lengthSq() > 0.001) {
        const perpendicularDecel = Math.min(
          maxVelocityChange,
          perpendicularVelocity.length()
        );
        perpendicularVelocity.normalize().multiplyScalar(-perpendicularDecel);
        newVelocity.add(perpendicularVelocity);
      }
    }

    // Apply velocity
    body.setLinvel({ x: newVelocity.x, y: 0, z: newVelocity.z }, true);

    // Angular acceleration/deceleration (frame-rate independent)
    const targetAngVel = -turnInput * PLAYER_MAX_ANGULAR_VELOCITY;
    const currentAngVel = body.angvel();
    const angVelDifference = targetAngVel - currentAngVel.y;
    // Cap it to prevent large jumps at low frame rates
    const maxAngVelChange = Math.min(
      PLAYER_ANGULAR_ACCELERATION * delta,
      MAX_ANGULAR_VELOCITY_CHANGE_PER_FRAME
    );

    let newAngVel: number;
    if (Math.abs(angVelDifference) <= maxAngVelChange) {
      // We can reach target angular velocity this frame
      newAngVel = targetAngVel;
    } else {
      // Gradually accelerate/decelerate toward target
      const direction = angVelDifference > 0 ? 1 : -1;
      newAngVel = currentAngVel.y + direction * maxAngVelChange;
    }

    body.setAngvel({ x: 0, y: newAngVel, z: 0 }, true);

    // Debug data - track velocity changes per frame (velocity-based system)
    debugDataRef.current = {
      smoothedInput: { ...smoothedInputRef.current },
      velocityChange: {
        x: newVelocity.x - currentVelocity.x,
        y: 0,
        z: newVelocity.z - currentVelocity.z,
      },
      angularVelocityChange: { x: 0, y: newAngVel - currentAngVel.y, z: 0 },
    };

    // Update visual effects - rotate thrusters based on direction
    const thrustInput = smoothedInputRef.current.y;
    const targetThrust = Math.abs(thrustInput);
    const newThrust = MathUtils.lerp(
      currentThrustRef.current,
      targetThrust,
      0.15
    );
    currentThrustRef.current = newThrust;

    // Determine rotation based on direction (0 for forward, PI for backward)
    // Instant rotation - no animation
    const isMovingBackward = thrustInput < 0;
    const flameRotation = isMovingBackward ? Math.PI : 0;

    // Update exhaust uniforms
    if (exhaustMaterialLRef.current) {
      exhaustMaterialLRef.current.uniforms.uTime.value = time;
      exhaustMaterialLRef.current.uniforms.uThrust.value = newThrust;
    }
    if (exhaustMaterialRRef.current) {
      exhaustMaterialRRef.current.uniforms.uTime.value = time;
      exhaustMaterialRRef.current.uniforms.uThrust.value = newThrust;
    }

    // Update flame scales and rotation (instant, no animation)
    if (flameLRef.current) {
      flameLRef.current.scale.z = newThrust > 0 ? 0.5 + newThrust * 2.0 : 0.5;
      // Rotate flames instantly to fire in opposite direction when moving backward
      flameLRef.current.rotation.y = flameRotation;
    }
    if (flameRRef.current) {
      flameRRef.current.scale.z = newThrust > 0 ? 0.5 + newThrust * 2.0 : 0.5;
      // Rotate flames instantly to fire in opposite direction when moving backward
      flameRRef.current.rotation.y = flameRotation;
    }

    // Update light intensities
    if (lightLRef.current) {
      lightLRef.current.intensity = 2 + newThrust * 10;
      lightLRef.current.distance = 5 + newThrust * 2;
    }
    if (lightRRef.current) {
      lightRRef.current.intensity = 2 + newThrust * 10;
      lightRRef.current.distance = 5 + newThrust * 2;
    }

    // Plane roll animation - tilt entire plane left/right when turning
    const maxWingRoll = Math.PI / 6; // 30 degrees max roll
    const targetWingRoll = -turnInput * maxWingRoll; // Negative for proper banking
    const wingRollSmoothFactor = Math.min(1, delta * 8); // Smooth wing movement
    currentWingRollRef.current = MathUtils.lerp(
      currentWingRollRef.current,
      targetWingRoll,
      wingRollSmoothFactor
    );

    // Apply roll rotation to entire plane group (around Z axis for banking)
    if (planeGroupRef.current) {
      planeGroupRef.current.rotation.z = currentWingRollRef.current;
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={spawnPosition}
      colliders="cuboid"
      args={[0.8, 0.4, 1.4]}
      linearDamping={0.3}
      angularDamping={1.5}
      enabledTranslations={[true, false, true]}
      enabledRotations={[false, true, false]}
      ccd
      canSleep={false}
      userData={{ controllerId }}
    >
      <group ref={planeGroupRef}>
        {/* Ship body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 0.6, 2.5]} />
          <meshStandardMaterial
            color={0xaaaaaa}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>

        {/* Wings */}
        <mesh position={[0, 0, 0.5]} castShadow receiveShadow>
          <boxGeometry args={[4, 0.1, 1.5]} />
          <meshStandardMaterial
            color={0xff3333}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>

        {/* Cockpit */}
        <mesh position={[0, 0.5, -0.2]}>
          <boxGeometry args={[0.7, 0.4, 1]} />
          <meshStandardMaterial
            color={0x111111}
            roughness={0.0}
            metalness={0.9}
          />
        </mesh>

        {/* Nozzles */}
        <mesh position={[-0.8, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.2, 0.5, 12]} />
          <meshStandardMaterial color={0x333333} roughness={0.5} />
        </mesh>
        <mesh position={[0.8, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.2, 0.5, 12]} />
          <meshStandardMaterial color={0x333333} roughness={0.5} />
        </mesh>

        {/* Exhaust flames */}
        <mesh ref={flameLRef} position={[-0.8, 0, 1.5]}>
          <primitive object={exhaustGeometry} attach="geometry" />
          <shaderMaterial
            ref={exhaustMaterialLRef}
            uniforms={exhaustUniformsL}
            vertexShader={exhaustVertex}
            fragmentShader={exhaustFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={flameRRef} position={[0.8, 0, 1.5]}>
          <primitive object={exhaustGeometry} attach="geometry" />
          <shaderMaterial
            ref={exhaustMaterialRRef}
            uniforms={exhaustUniformsR}
            vertexShader={exhaustVertex}
            fragmentShader={exhaustFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Hover lights */}
        <pointLight
          ref={lightLRef}
          position={[-1.5, -0.5, 0.5]}
          color={0x00ffff}
          intensity={2}
          distance={5}
        />
        <pointLight
          ref={lightRRef}
          position={[1.5, -0.5, 0.5]}
          color={0x00ffff}
          intensity={2}
          distance={5}
        />
        <PhysicsRecorder
          rigidBodyRef={rigidBodyRef as React.RefObject<RapierRigidBody>}
          inputRef={inputRef}
          debugDataRef={debugDataRef}
        />
      </group>
    </RigidBody>
  );
}

// Memoize Ship to prevent re-renders when only non-movement input changes
// Returns true if props are equal (skip re-render), false if different (re-render)
export const Ship = memo(ShipComponent, (prevProps, nextProps) => {
  // Only re-render if movement input (vector) or position changes, ignore action/ability
  const propsEqual =
    prevProps.controllerId === nextProps.controllerId &&
    prevProps.input.vector.x === nextProps.input.vector.x &&
    prevProps.input.vector.y === nextProps.input.vector.y &&
    prevProps.position[0] === nextProps.position[0] &&
    prevProps.position[1] === nextProps.position[1] &&
    prevProps.position[2] === nextProps.position[2];

  // Return true to skip re-render when props are equal
  return propsEqual;
});
