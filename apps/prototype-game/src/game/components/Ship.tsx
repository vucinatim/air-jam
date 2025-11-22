/* eslint-disable react-refresh/only-export-components */
import { useFrame } from "@react-three/fiber";
import { useRef, useEffect, memo, useMemo } from "react";
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
import type { InputState } from "../game-store";
import { PhysicsRecorder } from "./PhysicsRecorder";

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
  input: InputState;
  position: [number, number, number];
}

function ShipComponent({
  controllerId,
  input,
  position: initialPosition,
}: ShipProps) {
  const spawnPosition = useMemo(() => initialPosition, [initialPosition]);

  // Visual Refs
  const visualGroupRef = useRef<THREE.Group>(null); // The Visible Ship
  const planeGroupRef = useRef<THREE.Group>(null); // Inner rotation group

  // Physics Refs
  const rigidBodyRef = useRef<RapierRigidBody>(null); // The Invisible Collider

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
  const inputRef = useRef<InputState>(input);

  // "God Mode" State Refs (Logic Source of Truth)
  const currentPositionRef = useRef(new Vector3(...spawnPosition));
  const currentRotationRef = useRef(new Quaternion());
  const currentVelocityRef = useRef(new Vector3(0, 0, 0));
  const currentAngularVelocityRef = useRef(0);

  const debugDataRef = useRef({
    smoothedInput: { x: 0, y: 0 },
    velocityChange: { x: 0, y: 0, z: 0 },
    angularVelocityChange: { x: 0, y: 0, z: 0 },
  });

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

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
    // 1. Logic Updates (Exactly like Code B)
    const time = state.clock.elapsedTime;
    const currentInput = inputRef.current;

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

    const shipQuaternion = currentRotationRef.current.clone();
    const thrust = smoothedInputRef.current.y;
    const turnInput = smoothedInputRef.current.x;

    // Velocity Math
    const forward = new Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
    const targetVelocity = forward
      .clone()
      .multiplyScalar(thrust * PLAYER_MAX_SPEED);
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

      // Re-add your smooth lateral logic here if desired
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

    currentVelocityRef.current.copy(newVelocity);

    // Angular Math
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

    // 2. Apply Updates to State Refs
    const rotationDelta = newAngVel * delta;
    const rotationQuaternion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      rotationDelta
    );
    currentRotationRef.current.premultiply(rotationQuaternion).normalize();

    const positionDelta = newVelocity.clone().multiplyScalar(delta);
    currentPositionRef.current.add(positionDelta);

    // 3. VISUAL UPDATE (The "Code B" part)
    // We move the visual group directly. This guarantees 144hz smoothness.
    if (visualGroupRef.current) {
      visualGroupRef.current.position.copy(currentPositionRef.current);
      visualGroupRef.current.quaternion.copy(currentRotationRef.current);
    }

    // 4. PHYSICS UPDATE (The Shadow)
    // We tell the invisible collider to chase the visual ship.
    // It might lag slightly behind or jitter internally, but the user won't see it.
    if (rigidBodyRef.current) {
      rigidBodyRef.current.setNextKinematicTranslation(
        currentPositionRef.current
      );
      rigidBodyRef.current.setNextKinematicRotation(currentRotationRef.current);
    }

    // 5. Camera Tracking & FX
    shipPositions.set(controllerId, currentPositionRef.current.clone());
    shipRotations.set(controllerId, currentRotationRef.current.clone());

    // ... (Visual FX Logic stays exactly the same) ...
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

    // Plane roll animation
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
  });

  return (
    <>
      {/* 1. The Visual Ship (No RigidBody wrapper) */}
      <group ref={visualGroupRef} position={spawnPosition}>
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
      </group>

      {/* 2. The Shadow Physics Body (Invisible) */}
      <RigidBody
        ref={rigidBodyRef}
        type="kinematicPosition"
        position={spawnPosition}
        colliders="cuboid"
        args={[0.6, 0.4, 1.5]}
        linearDamping={0}
        angularDamping={0}
        userData={{ controllerId }}
        // We don't need children here, the Collider generates automatically from 'args' if colliders="cuboid"
        // If you need precise mesh colliders, you can put invisible Geometry here.
      >
        {/* Optional: Debug mesh to see where physics thinks you are (remove in prod) */}
        {/* <mesh><boxGeometry args={[0.8, 0.4, 1.4]} /><meshBasicMaterial color="red" wireframe /></mesh> */}
        <PhysicsRecorder
          rigidBodyRef={rigidBodyRef as React.RefObject<RapierRigidBody>}
          inputRef={inputRef}
          debugDataRef={debugDataRef}
        />
      </RigidBody>
    </>
  );
}

export const Ship = memo(ShipComponent, (prevProps, nextProps) => {
  const propsEqual =
    prevProps.controllerId === nextProps.controllerId &&
    prevProps.input.vector.x === nextProps.input.vector.x &&
    prevProps.input.vector.y === nextProps.input.vector.y &&
    prevProps.position[0] === nextProps.position[0] &&
    prevProps.position[1] === nextProps.position[1] &&
    prevProps.position[2] === nextProps.position[2];
  return propsEqual;
});
