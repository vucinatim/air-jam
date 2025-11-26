import { useMemo, useRef } from "react";
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
  Vector3,
} from "three";

// ==========================================
// 1. DESIGN CONFIGURATION (TWEAK VISUALS HERE)
// ==========================================
const SHIP_DESIGN = {
  BODY: {
    size: [1.2, 0.8, 3.0] as [number, number, number],
    color: 0x8899aa,
    roughness: 0.4,
  },
  NOSE: {
    args: [0, 1, 1.5, 4, 1, false, Math.PI / 4] as const,
    position: [0, 0, -2.25] as [number, number, number],
    scale: [0.6, 1, 0.4] as [number, number, number],
  },
  WING: {
    position: [0.6, 0.1, -0.2] as [number, number, number],
    depth: 0.1,
  },
  FIN: {
    position: [0.3, 0.4, 1.4] as [number, number, number],
    rotationZ: 0.8,
    depth: 0.1,
  },
  COCKPIT: {
    size: [0.9, 0.4, 1.2] as [number, number, number],
    position: [0, 0.45, -0.5] as [number, number, number],
    color: 0x111111,
  },
  GUNS: {
    position: [1.6, 0.0, 0.2] as [number, number, number],
    size: [0.1, 0.1, 1.5, 6] as const,
    color: 0x222222,
  },
  ENGINE: {
    position: [0.5, 0, 1.8] as [number, number, number],
    nozzleSize: [0.35, 0.25, 0.8, 8] as const,
    color: 0x333333,
  },
  // NEW: ALL EXHAUST SETTINGS CENTRALIZED
  EXHAUST: {
    // Colors
    flameColor: new Vector3(0.0, 0.8, 1.0), // RGB for Shader (Cyan)
    lightColor: 0x00ffff, // Hex for PointLight (Cyan)

    // Flame Geometry
    // How long the flame is when idle (thrust = 0) vs max (thrust = 1)
    flameLengthBase: 0.5,
    flameLengthGrowth: 2.0, // length = base + (thrust * growth)

    // Light Intensity
    // Brightness when idle vs max thrust
    intensityBase: 2.0,
    intensityGrowth: 10.0, // intensity = base + (thrust * growth)

    // Light Range (Distance)
    // How far the light reaches
    distanceBase: 5.0,
    distanceGrowth: 2.0,
  },
};

// ==========================================
// 2. SHADERS & SHAPES
// ==========================================

const createWingShape = () => {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.0, -1.0);
  shape.lineTo(2.0, -2.0);
  shape.lineTo(0, -1.5);
  return shape;
};

const createFinShape = () => {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 1.0);
  shape.lineTo(-0.5, 1.0);
  shape.lineTo(-1.0, 0.0);
  shape.lineTo(0, 0);
  return shape;
};

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
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float alpha = smoothstep(0.0, 1.0, 1.0 - vUv.y);
    float noise = sin(vUv.y * 20.0 - uTime * 15.0) * 0.5 + 0.5;
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 finalColor = mix(uColor, coreColor, noise * uThrust);
    gl_FragColor = vec4(finalColor, alpha * alpha * (0.5 + uThrust));
  }
`;

// ==========================================
// 3. SUB-COMPONENTS
// ==========================================

function EngineExhaust({
  position,
  thrustRef,
  thrustInputRef,
}: {
  position: [number, number, number];
  thrustRef: React.MutableRefObject<number>;
  thrustInputRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const geometry = useMemo(() => {
    const geo = new CylinderGeometry(0.1, 0.4, 2.5, 12, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 1.2);
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uThrust: { value: 0.0 },
      uColor: { value: SHIP_DESIGN.EXHAUST.flameColor },
    }),
    []
  );

  useFrame((state) => {
    const thrust = thrustRef.current;
    const config = SHIP_DESIGN.EXHAUST;

    // Shader Updates
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uThrust.value = thrust;
    }

    // Mesh Updates
    if (meshRef.current) {
      const isMovingBackward = thrustInputRef.current < 0;
      meshRef.current.rotation.y = isMovingBackward ? Math.PI : 0;

      // Calculate Length based on Config
      // If thrust > 0, grow. If backward, keep small.
      const targetScale =
        thrust > 0
          ? config.flameLengthBase + thrust * config.flameLengthGrowth
          : config.flameLengthBase;

      meshRef.current.scale.z = targetScale;
    }

    // Light Updates
    if (lightRef.current) {
      // Calculate Intensity based on Config
      lightRef.current.intensity =
        config.intensityBase + thrust * config.intensityGrowth;
      // Calculate Distance based on Config
      lightRef.current.distance =
        config.distanceBase + thrust * config.distanceGrowth;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <primitive object={geometry} attach="geometry" />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={exhaustVertex}
          fragmentShader={exhaustFragment}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.5]}
        color={SHIP_DESIGN.EXHAUST.lightColor}
        // Defaults, updated in useFrame
        intensity={SHIP_DESIGN.EXHAUST.intensityBase}
        distance={SHIP_DESIGN.EXHAUST.distanceBase}
      />
    </group>
  );
}

// ==========================================
// 4. MAIN COMPONENT
// ==========================================

interface ShipModelProps {
  playerColor: string;
  thrustRef: React.MutableRefObject<number>;
  thrustInputRef: React.MutableRefObject<number>;
  abilityVisual: React.ReactNode | null;
  planeGroupRef: React.RefObject<Group | null>;
}

export function ShipModel({
  playerColor,
  thrustRef,
  thrustInputRef,
  abilityVisual,
  planeGroupRef,
}: ShipModelProps) {
  // --- Geometries ---
  const geos = useMemo(
    () => ({
      body: new BoxGeometry(...SHIP_DESIGN.BODY.size),
      nose: new CylinderGeometry(...SHIP_DESIGN.NOSE.args),
      wing: new ExtrudeGeometry(createWingShape(), {
        depth: SHIP_DESIGN.WING.depth,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 1,
      }),
      fin: new ExtrudeGeometry(createFinShape(), {
        depth: SHIP_DESIGN.FIN.depth,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 1,
      }),
      cockpit: new BoxGeometry(...SHIP_DESIGN.COCKPIT.size),
      nozzle: new CylinderGeometry(...SHIP_DESIGN.ENGINE.nozzleSize),
      gun: new CylinderGeometry(...SHIP_DESIGN.GUNS.size),
    }),
    []
  );

  // --- Materials ---
  const mats = useMemo(() => {
    const wingColorInt = parseInt(playerColor.replace("#", ""), 16);
    return {
      body: new MeshStandardMaterial({
        color: SHIP_DESIGN.BODY.color,
        roughness: SHIP_DESIGN.BODY.roughness,
        metalness: 0.7,
        flatShading: true,
      }),
      wing: new MeshStandardMaterial({
        color: wingColorInt,
        roughness: 0.6,
        metalness: 0.2,
        flatShading: true,
      }),
      cockpit: new MeshStandardMaterial({
        color: SHIP_DESIGN.COCKPIT.color,
        roughness: 0.1,
        metalness: 0.9,
      }),
      gun: new MeshStandardMaterial({
        color: SHIP_DESIGN.GUNS.color,
        roughness: 0.7,
        metalness: 0.5,
      }),
      nozzle: new MeshStandardMaterial({
        color: SHIP_DESIGN.ENGINE.color,
        roughness: 0.5,
      }),
    };
  }, [playerColor]);

  return (
    <group ref={planeGroupRef}>
      {/* --- Body Group --- */}
      <mesh
        castShadow
        receiveShadow
        geometry={geos.body}
        material={mats.body}
      />

      {/* --- Nose --- */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        scale={SHIP_DESIGN.NOSE.scale}
        position={SHIP_DESIGN.NOSE.position}
        castShadow
        geometry={geos.nose}
        material={mats.body}
      />

      {/* --- Wings (Mirrored) --- */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={SHIP_DESIGN.WING.position}
        castShadow
        geometry={geos.wing}
        material={mats.wing}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[-1, 1, 1]}
        position={[
          -SHIP_DESIGN.WING.position[0],
          SHIP_DESIGN.WING.position[1],
          SHIP_DESIGN.WING.position[2],
        ]}
        castShadow
        geometry={geos.wing}
        material={mats.wing}
      />

      {/* --- Fins (Mirrored) --- */}
      <group
        position={[
          -SHIP_DESIGN.FIN.position[0],
          SHIP_DESIGN.FIN.position[1],
          SHIP_DESIGN.FIN.position[2],
        ]}
        rotation={[0, 0, SHIP_DESIGN.FIN.rotationZ]}
      >
        <mesh
          rotation={[0, -Math.PI / 2, 0]}
          geometry={geos.fin}
          material={mats.wing}
        />
      </group>
      <group
        position={SHIP_DESIGN.FIN.position}
        rotation={[0, 0, -SHIP_DESIGN.FIN.rotationZ]}
      >
        <mesh
          rotation={[0, -Math.PI / 2, 0]}
          scale={[1, 1, -1]}
          geometry={geos.fin}
          material={mats.wing}
        />
      </group>

      {/* --- Cockpit --- */}
      <mesh
        position={SHIP_DESIGN.COCKPIT.position}
        geometry={geos.cockpit}
        material={mats.cockpit}
      />

      {/* --- Guns (Mirrored) --- */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[
          -SHIP_DESIGN.GUNS.position[0],
          SHIP_DESIGN.GUNS.position[1],
          SHIP_DESIGN.GUNS.position[2],
        ]}
        geometry={geos.gun}
        material={mats.gun}
      />
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={SHIP_DESIGN.GUNS.position}
        geometry={geos.gun}
        material={mats.gun}
      />

      {/* --- Engines & Exhaust (Mirrored) --- */}
      {/* Nozzles */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[
          -SHIP_DESIGN.ENGINE.position[0],
          SHIP_DESIGN.ENGINE.position[1],
          SHIP_DESIGN.ENGINE.position[2],
        ]}
        geometry={geos.nozzle}
        material={mats.nozzle}
      />
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={SHIP_DESIGN.ENGINE.position}
        geometry={geos.nozzle}
        material={mats.nozzle}
      />

      {/* Flames */}
      <EngineExhaust
        position={[
          -SHIP_DESIGN.ENGINE.position[0],
          SHIP_DESIGN.ENGINE.position[1],
          SHIP_DESIGN.ENGINE.position[2],
        ]}
        thrustRef={thrustRef}
        thrustInputRef={thrustInputRef}
      />
      <EngineExhaust
        position={SHIP_DESIGN.ENGINE.position}
        thrustRef={thrustRef}
        thrustInputRef={thrustInputRef}
      />

      {/* Ability Visuals */}
      {abilityVisual}
    </group>
  );
}
