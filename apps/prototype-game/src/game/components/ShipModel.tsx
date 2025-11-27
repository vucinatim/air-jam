import { useMemo, useRef } from "react";
import { useFrame, createPortal, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Trail } from "./Trail";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Shape,
  type Group,
  Vector3,
  Color,
  Float32BufferAttribute,
  Mesh,
  Points,
  ShaderMaterial,
  Object3D,
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
    trailColor: new Color(0x00fff0), // neon cyan
    trailWidth: 0.8,
    trailLength: 0.1,

    // Light Intensity
    // Brightness when idle vs max thrust
    intensityBase: 2.0,
    intensityGrowth: 10.0, // intensity = base + (thrust * growth)

    // Light Range (Distance)
    // How far the light reaches
    distanceBase: 5.0,
    distanceGrowth: 2.0,
  },
  PARTICLES: {
    maxParticles: 150,
    color: new Color("#00ffff"),
    size: 1.2,
    sizeVariance: 0.2,
    opacity: 0.6,
    lifetime: 0.1,

    // Idle behavior
    idleEmissionRate: 10.0,
    idleVelocity: 1.0,

    // Thrust behavior
    baseEmissionRate: 30.0,
    boostEmissionRate: 50.0,
    baseVelocity: 5.0,
    boostVelocity: 15.0,
    turbulence: 0.6,
    spawnOffset: 0.08,
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

// --- PARTICLE SHADER ---
const ParticleShaderMaterial = new ShaderMaterial({
  uniforms: {
    color: { value: new Color("cyan") },
    pointSize: { value: 1.0 },
    dpr: { value: 1.0 },
    opacity: { value: 1.0 },
  },
  vertexShader: `
    uniform float pointSize;
    uniform float dpr;
    attribute float age;
    attribute float particleSize;
    varying float vAge;

    void main() {
      vAge = age;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      // Size attenuation: particles get smaller with distance
      float distance = length(mvPosition.xyz);
      gl_PointSize = particleSize * pointSize * dpr * (300.0 / max(distance, 1.0));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float opacity;
    varying float vAge;

    void main() {
      // Circular particle
      vec2 cxy = 2.0 * gl_PointCoord - 1.0;
      float r = dot(cxy, cxy);
      if (r > 1.0) discard;
      
      // Soft glow
      float glow = 1.0 - r;
      glow = pow(glow, 2.0);

      float alpha = (1.0 - vAge) * opacity;
      gl_FragColor = vec4(color, alpha * glow);
    }
  `,
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
});

// ==========================================
// 3. SUB-COMPONENTS
// ==========================================

// Helper function to initialize particle buffers (outside component to avoid render issues)
function initializeParticleBuffers(
  maxParticles: number,
  size: number,
  sizeVariance: number
) {
  const pos = new Float32Array(maxParticles * 3);
  const vel = [];
  const age = new Float32Array(maxParticles);
  const sizeArray = new Float32Array(maxParticles);

  for (let i = 0; i < maxParticles; i++) {
    pos[i * 3 + 1] = 10000; // Hide initially
    vel.push(new Vector3());
    age[i] = 1.1; // Mark as dead
    sizeArray[i] = size + sizeVariance * (Math.random() - 0.5);
  }

  return {
    positions: new Float32BufferAttribute(pos, 3),
    velocities: vel,
    ages: new Float32BufferAttribute(age, 1),
    sizes: new Float32BufferAttribute(sizeArray, 1),
  };
}

// ==========================================
// FIXED PARTICLE COMPONENT (WITH PORTAL)
// ==========================================
function EngineParticles({
  objectRef,
  thrustRef,
}: {
  objectRef: React.RefObject<Object3D | null>;
  thrustRef: React.MutableRefObject<number>;
}) {
  const shaderRef = useRef<ShaderMaterial>(ParticleShaderMaterial.clone());
  const meshRef = useRef<Points>(null);
  const emissionTimer = useRef(0);
  const scene = useThree((state) => state.scene);
  const prevPos = useRef(new Vector3());
  const isFirstFrame = useRef(true);
  const shipVelocity = useRef(new Vector3());

  const config = SHIP_DESIGN.PARTICLES;

  // Initialize buffers
  const { positions, velocities, ages, sizes } = useMemo(
    () =>
      initializeParticleBuffers(
        config.maxParticles,
        config.size,
        config.sizeVariance
      ),
    [config.maxParticles, config.size, config.sizeVariance]
  );

  useFrame((state, delta) => {
    if (!meshRef.current || !objectRef.current) return;

    const worldPos = new Vector3();
    const worldQuat = new THREE.Quaternion();
    objectRef.current.getWorldPosition(worldPos);
    objectRef.current.getWorldQuaternion(worldQuat);

    if (isFirstFrame.current) {
      prevPos.current.copy(worldPos);
      isFirstFrame.current = false;
    } else {
      shipVelocity.current
        .subVectors(worldPos, prevPos.current)
        .divideScalar(delta);
    }
    prevPos.current.copy(worldPos);

    const thrust = Math.max(0, thrustRef.current);
    const isIdle = thrust < 0.05;

    if (shaderRef.current) {
      shaderRef.current.uniforms.color.value.set(config.color);
      shaderRef.current.uniforms.pointSize.value = 1.0;
      shaderRef.current.uniforms.dpr.value = state.viewport.dpr;
      shaderRef.current.uniforms.opacity.value = config.opacity;
    }

    const currentEmissionRate = isIdle
      ? config.idleEmissionRate
      : config.baseEmissionRate + thrust * config.boostEmissionRate;

    const currentVelocity = isIdle
      ? config.idleVelocity
      : config.baseVelocity + thrust * config.boostVelocity;

    const backwardDir = new Vector3(0, 1, 0)
      .applyQuaternion(worldQuat)
      .normalize();
    const spawnPos = worldPos
      .clone()
      .addScaledVector(backwardDir, config.spawnOffset);

    const positionsArray = meshRef.current.geometry.attributes.position
      .array as Float32Array;
    const agesArray = meshRef.current.geometry.attributes.age
      .array as Float32Array;
    const sizesArray = meshRef.current.geometry.attributes.particleSize
      .array as Float32Array;

    emissionTimer.current += delta * currentEmissionRate;
    let emitCount = Math.floor(emissionTimer.current);
    emissionTimer.current -= emitCount;

    // Update Loop
    for (let i = 0; i < config.maxParticles; i++) {
      if (agesArray[i] >= 1.0) {
        // Respawn dead particles
        if (emitCount > 0) {
          agesArray[i] = 0;

          positionsArray[i * 3] = spawnPos.x;
          positionsArray[i * 3 + 1] = spawnPos.y;
          positionsArray[i * 3 + 2] = spawnPos.z;

          sizesArray[i] =
            config.size + config.sizeVariance * (Math.random() - 0.5);

          const blastVel = backwardDir.clone().multiplyScalar(currentVelocity);
          const spread = isIdle ? 0.5 : 0.2;
          blastVel.x += (Math.random() - 0.5) * spread;
          blastVel.y += (Math.random() - 0.5) * spread;
          blastVel.z += (Math.random() - 0.5) * spread;

          const inertiaVel = shipVelocity.current.clone().multiplyScalar(0.9);
          velocities[i].copy(blastVel.add(inertiaVel));
          emitCount--;
        } else {
          // Keep dead particles hidden
          positionsArray[i * 3] = 0;
          positionsArray[i * 3 + 1] = 10000;
          positionsArray[i * 3 + 2] = 0;
        }
      } else {
        // Update living particles
        const lifeSpeed = isIdle ? 1.5 : 1.0;
        agesArray[i] += (delta / config.lifetime) * lifeSpeed;
        positionsArray[i * 3] += velocities[i].x * delta;
        positionsArray[i * 3 + 1] += velocities[i].y * delta;
        positionsArray[i * 3 + 2] += velocities[i].z * delta;
      }
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.attributes.age.needsUpdate = true;
    meshRef.current.geometry.attributes.particleSize.needsUpdate = true;
  });

  // FIX: Use createPortal to render particles in the global scene
  return createPortal(
    <points ref={meshRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions.array, positions.itemSize]}
        />
        <bufferAttribute
          attach="attributes-age"
          args={[ages.array, ages.itemSize]}
        />
        <bufferAttribute
          attach="attributes-particleSize"
          args={[sizes.array, sizes.itemSize]}
        />
      </bufferGeometry>
      <primitive attach="material" object={shaderRef.current} />
    </points>,
    scene
  );
}

// Exhaust lights component (kept for glow effect)
function ExhaustLight({
  position,
  thrustRef,
}: {
  position: [number, number, number];
  thrustRef: React.RefObject<number>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const thrust = thrustRef.current;
    const config = SHIP_DESIGN.EXHAUST;

    // Light Updates
    if (lightRef.current) {
      lightRef.current.intensity =
        config.intensityBase + thrust * config.intensityGrowth;
      lightRef.current.distance =
        config.distanceBase + thrust * config.distanceGrowth;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.5]}
        color={SHIP_DESIGN.EXHAUST.trailColor}
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
  abilityVisual,
  planeGroupRef,
}: ShipModelProps) {
  const leftNozzleRef = useRef<Mesh | null>(null);
  const rightNozzleRef = useRef<Mesh | null>(null);
  const leftTrailTargetRef = useRef<THREE.Object3D | null>(null);
  const rightTrailTargetRef = useRef<THREE.Object3D | null>(null);

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
      <group
        rotation={[Math.PI / 2, 0, 0]}
        position={[
          -SHIP_DESIGN.ENGINE.position[0],
          SHIP_DESIGN.ENGINE.position[1],
          SHIP_DESIGN.ENGINE.position[2],
        ]}
      >
        <mesh
          ref={leftNozzleRef}
          geometry={geos.nozzle}
          material={mats.nozzle}
        />
        <group
          ref={leftTrailTargetRef}
          position={[0, SHIP_DESIGN.ENGINE.nozzleSize[2] / 2, 0]}
        />
      </group>
      <group
        rotation={[Math.PI / 2, 0, 0]}
        position={SHIP_DESIGN.ENGINE.position}
      >
        <mesh
          ref={rightNozzleRef}
          geometry={geos.nozzle}
          material={mats.nozzle}
        />
        <group
          ref={rightTrailTargetRef}
          position={[0, SHIP_DESIGN.ENGINE.nozzleSize[2] / 2, 0]}
        />
      </group>

      {/* Exhaust Trails (replacing straight exhausts) */}
      <Trail
        target={leftTrailTargetRef}
        thrustRef={thrustRef}
        color={SHIP_DESIGN.EXHAUST.trailColor}
        width={SHIP_DESIGN.EXHAUST.trailWidth}
        length={SHIP_DESIGN.EXHAUST.trailLength}
        maxPoints={150}
        interval={1}
      />
      <Trail
        target={rightTrailTargetRef}
        thrustRef={thrustRef}
        color={SHIP_DESIGN.EXHAUST.trailColor}
        width={SHIP_DESIGN.EXHAUST.trailWidth}
        length={SHIP_DESIGN.EXHAUST.trailLength}
        maxPoints={150}
        interval={1}
      />

      {/* Exhaust Lights (for glow effect) */}
      <ExhaustLight
        position={[
          -SHIP_DESIGN.ENGINE.position[0],
          SHIP_DESIGN.ENGINE.position[1],
          SHIP_DESIGN.ENGINE.position[2],
        ]}
        thrustRef={thrustRef}
      />
      <ExhaustLight
        position={SHIP_DESIGN.ENGINE.position}
        thrustRef={thrustRef}
      />

      {/* Render particles via Portal (they will be children of Scene, not Ship) */}
      <EngineParticles objectRef={leftTrailTargetRef} thrustRef={thrustRef} />
      <EngineParticles objectRef={rightTrailTargetRef} thrustRef={thrustRef} />

      {/* Ability Visuals */}
      {abilityVisual}
    </group>
  );
}
