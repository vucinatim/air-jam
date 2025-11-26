import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Shape,
  type Group,
} from "three";

// Exhaust shaders
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

interface ShipModelProps {
  /** Player color for wings and other colored parts */
  playerColor: string;
  /** Ref to current thrust value (0-1) for exhaust effects */
  thrustRef: React.MutableRefObject<number>;
  /** Ref to current input thrust value (can be negative for backward) */
  thrustInputRef: React.MutableRefObject<number>;
  /** Ability visual component to render */
  abilityVisual: React.ReactNode | null;
  /** Ref to the plane group for banking rotation (updated in Ship.tsx) */
  planeGroupRef: React.RefObject<Group | null>;
}

/**
 * Reusable ship model component
 * Contains all the visual 3D model parts (body, wings, fins, exhaust, etc.)
 */
export function ShipModel({
  playerColor,
  thrustRef,
  thrustInputRef,
  abilityVisual,
  planeGroupRef,
}: ShipModelProps) {
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
    // Convert hex color to number for Three.js
    const wingColor = parseInt(playerColor.replace("#", ""), 16);
    return {
      playerBody: new MeshStandardMaterial({
        color: 0x8899aa,
        roughness: 0.4,
        metalness: 0.7,
        flatShading: true,
      }),
      playerWing: new MeshStandardMaterial({
        color: wingColor,
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
  }, [playerColor]);

  // Update wing material color when player color changes
  useEffect(() => {
    if (shipMaterials.playerWing) {
      const wingColor = parseInt(playerColor.replace("#", ""), 16);
      shipMaterials.playerWing.color.setHex(wingColor);
    }
  }, [playerColor, shipMaterials.playerWing]);

  // Geometry and Uniforms for exhaust
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

  // Refs for exhaust effects
  const flameLRef = useRef<THREE.Mesh>(null);
  const flameRRef = useRef<THREE.Mesh>(null);
  const lightLRef = useRef<THREE.PointLight>(null);
  const lightRRef = useRef<THREE.PointLight>(null);
  const exhaustMaterialLRef = useRef<THREE.ShaderMaterial>(null);
  const exhaustMaterialRRef = useRef<THREE.ShaderMaterial>(null);

  // Update exhaust effects based on thrust
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const thrust = thrustRef.current; // Read current thrust value from ref
    const isMovingBackward = thrustInputRef.current < 0;
    const flameRotation = isMovingBackward ? Math.PI : 0;

    // Update exhaust shader uniforms
    if (exhaustMaterialLRef.current) {
      exhaustMaterialLRef.current.uniforms.uTime.value = time;
      exhaustMaterialLRef.current.uniforms.uThrust.value = thrust;
    }
    if (exhaustMaterialRRef.current) {
      exhaustMaterialRRef.current.uniforms.uTime.value = time;
      exhaustMaterialRRef.current.uniforms.uThrust.value = thrust;
    }

    // Update exhaust flame visuals
    if (flameLRef.current) {
      flameLRef.current.scale.z = thrust > 0 ? 0.5 + thrust * 2.0 : 0.5;
      flameLRef.current.rotation.y = flameRotation;
    }
    if (flameRRef.current) {
      flameRRef.current.scale.z = thrust > 0 ? 0.5 + thrust * 2.0 : 0.5;
      flameRRef.current.rotation.y = flameRotation;
    }

    // Update engine lights
    if (lightLRef.current) {
      lightLRef.current.intensity = 2 + thrust * 10;
      lightLRef.current.distance = 5 + thrust * 2;
    }
    if (lightRRef.current) {
      lightRRef.current.intensity = 2 + thrust * 10;
      lightRRef.current.distance = 5 + thrust * 2;
    }
    // Note: Wing roll (banking) is updated in Ship.tsx's useFrame because
    // it needs to read from a ref that changes every frame, and props don't update
  });

  return (
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
  );
}
