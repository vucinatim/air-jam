import { useMemo, useRef, useEffect } from "react";
import { useFrame, createPortal, useThree } from "@react-three/fiber";
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
  Color,
  Float32BufferAttribute,
  Mesh,
  Points,
  ShaderMaterial,
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
  PARTICLES: {
    maxParticles: 150,
    color: new Color("#00ffff"),
    size: 1.5,
    sizeVariance: 0.5,
    opacity: 0.6,
    lifetime: 0.1,
    baseEmissionRate: 10.0,
    boostEmissionRate: 20.0,
    baseVelocity: -5.0,
    boostVelocity: -10.0,
    turbulence: 0.4,
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
    gl_FragColor = vec4(finalColor, alpha * alpha * (0.5 + uThrust) * 0.5);
  }
`;

// --- PARTICLE SHADER ---
const ParticleShaderMaterial = new ShaderMaterial({
  uniforms: {
    color: { value: new Color("cyan") },
    pointSize: { value: 1.0 },
    dpr: { value: 1.0 },
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
    varying float vAge;

    void main() {
      // Circular particle
      vec2 cxy = 2.0 * gl_PointCoord - 1.0;
      float r = dot(cxy, cxy);
      if (r > 1.0) discard;
      
      // Soft glow
      float glow = 1.0 - r;
      glow = pow(glow, 2.0);
      
      float alpha = 1.0 - vAge; // Fade out
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
  objectRef: React.RefObject<Mesh | null>;
  thrustRef: React.MutableRefObject<number>;
}) {
  const shaderRef = useRef<ShaderMaterial>(ParticleShaderMaterial.clone());
  const meshRef = useRef<Points>(null);
  const emissionTimer = useRef(0);
  const scene = useThree((state) => state.scene);

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

    const thrust = Math.max(0, thrustRef.current);

    // Update Uniforms
    if (shaderRef.current) {
      shaderRef.current.uniforms.color.value.set(config.color);
      shaderRef.current.uniforms.pointSize.value = 1.0; // Base multiplier, actual size comes from particleSize attribute
      shaderRef.current.uniforms.dpr.value = state.viewport.dpr;
      shaderRef.current.opacity = config.opacity;
    }

    // Get Object Transforms (World Space)
    const worldPos = new Vector3();
    const worldQuat = new THREE.Quaternion();
    objectRef.current.getWorldPosition(worldPos);
    objectRef.current.getWorldQuaternion(worldQuat);

    const positionsArray = meshRef.current.geometry.attributes.position
      .array as Float32Array;
    const agesArray = meshRef.current.geometry.attributes.age
      .array as Float32Array;

    // Emission Logic
    if (thrust > 0.05) {
      const currentEmissionRate =
        config.baseEmissionRate + thrust * config.boostEmissionRate;
      emissionTimer.current += delta * currentEmissionRate;
    } else {
      emissionTimer.current = 0;
    }

    let emitCount = Math.floor(emissionTimer.current);
    emissionTimer.current -= emitCount;

    const currentVelocity = config.baseVelocity + thrust * config.boostVelocity;

    // Update Loop
    for (let i = 0; i < config.maxParticles; i++) {
      if (agesArray[i] >= 1.0) {
        // Respawn dead particles
        if (emitCount > 0) {
          agesArray[i] = 0;

          // Set Position to Nozzle (World Space)
          positionsArray[i * 3] = worldPos.x;
          positionsArray[i * 3 + 1] = worldPos.y;
          positionsArray[i * 3 + 2] = worldPos.z;

          // Velocity Direction - exhaust goes backward from nozzle
          // Get the backward direction in world space (negative local Z axis)
          const dir = new Vector3(0, 0, -1); // Local backward direction
          dir.applyQuaternion(worldQuat); // Transform to world space

          // Spread
          const spread = 0.3;
          dir.x += (Math.random() - 0.5) * spread;
          dir.y += (Math.random() - 0.5) * spread;
          dir.z += (Math.random() - 0.5) * spread;
          dir.normalize().multiplyScalar(currentVelocity);

          velocities[i].copy(dir);
          emitCount--;
        } else {
          // Keep dead particles hidden
          positionsArray[i * 3] = 0;
          positionsArray[i * 3 + 1] = 10000;
          positionsArray[i * 3 + 2] = 0;
        }
      } else {
        // Update living particles
        agesArray[i] += delta / config.lifetime;
        positionsArray[i * 3] += velocities[i].x * delta;
        positionsArray[i * 3 + 1] += velocities[i].y * delta;
        positionsArray[i * 3 + 2] += velocities[i].z * delta;
      }
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.attributes.age.needsUpdate = true;
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

function EngineExhaust({
  position,
  thrustRef,
  thrustInputRef,
  nozzleRef,
}: {
  position: [number, number, number];
  thrustRef: React.MutableRefObject<number>;
  thrustInputRef: React.MutableRefObject<number>;
  nozzleRef?: React.MutableRefObject<Mesh | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  useMemo(() => {
    if (nozzleRef && meshRef.current) nozzleRef.current = meshRef.current;
  }, [nozzleRef]);

  // Fix for ref late binding
  useFrame(() => {
    if (nozzleRef && meshRef.current && nozzleRef.current !== meshRef.current) {
      nozzleRef.current = meshRef.current;
    }
  });

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

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

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
      lightRef.current.intensity =
        config.intensityBase + thrust * config.intensityGrowth;
      lightRef.current.distance =
        config.distanceBase + thrust * config.distanceGrowth;
      targetRef.current.position.set(0, -5, 2);
      targetRef.current.updateMatrixWorld();
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
      <primitive object={targetRef.current} />
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
  const leftNozzleRef = useRef<Mesh | null>(null);
  const rightNozzleRef = useRef<Mesh | null>(null);

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

      {/* Flames + Particles (Mirrored) */}
      <EngineExhaust
        position={[
          -SHIP_DESIGN.ENGINE.position[0],
          SHIP_DESIGN.ENGINE.position[1],
          SHIP_DESIGN.ENGINE.position[2],
        ]}
        thrustRef={thrustRef}
        thrustInputRef={thrustInputRef}
        nozzleRef={leftNozzleRef}
      />
      <EngineExhaust
        position={SHIP_DESIGN.ENGINE.position}
        thrustRef={thrustRef}
        thrustInputRef={thrustInputRef}
        nozzleRef={rightNozzleRef}
      />

      {/* Render particles via Portal (they will be children of Scene, not Ship) */}
      <EngineParticles objectRef={leftNozzleRef} thrustRef={thrustRef} />
      <EngineParticles objectRef={rightNozzleRef} thrustRef={thrustRef} />

      {/* Ability Visuals */}
      {abilityVisual}
    </group>
  );
}
