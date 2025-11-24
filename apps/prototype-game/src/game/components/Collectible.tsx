import { RigidBody, type CollisionPayload } from "@react-three/rapier";
import {
  OctahedronGeometry,
  MeshStandardMaterial,
  ConeGeometry,
  AdditiveBlending,
  BoxGeometry,
  Vector3,
} from "three";
import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { CollectibleData, useCollectiblesStore } from "../collectibles-store";
import { useAbilitiesStore } from "../abilities-store";
import * as THREE from "three";

interface CollectibleProps {
  collectible: CollectibleData;
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  size: number;
}

const PARTICLE_COUNT = 30;
const EXPLOSION_LIFETIME = 0.8;
const EXPLOSION_SPEED = 8;

function ExplosionParticles({
  position,
}: {
  position: [number, number, number];
}) {
  const particlesRef = useRef<THREE.Group>(null);
  const particles = useRef<Particle[]>([]);
  const ageRef = useRef(0);

  const particleGeometry = useMemo(() => new BoxGeometry(0.4, 0.4, 0.4), []);
  const particleMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1,
      }),
    []
  );

  // Initialize particles once on mount
  useEffect(() => {
    if (particles.current.length === 0) {
      particles.current = Array.from({ length: PARTICLE_COUNT }, () => {
        // Random direction in sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = EXPLOSION_SPEED * (0.7 + Math.random() * 0.6);

        return {
          position: new Vector3(0, 0, 0),
          velocity: new Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
          ),
          age: 0,
          lifetime: EXPLOSION_LIFETIME * (0.8 + Math.random() * 0.4),
          size: 0.4 + Math.random() * 0.5, // Bigger base size with more variation (0.4 to 0.9)
        };
      });
    }
  }, []);

  useFrame((_state, delta) => {
    if (!particlesRef.current) return;

    ageRef.current += delta;

    // Update particles
    particles.current.forEach((particle, index) => {
      particle.age += delta;

      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));

      // Apply gravity
      particle.velocity.y -= 5 * delta;

      // Update mesh
      const mesh = particlesRef.current?.children[index] as THREE.Mesh;
      if (mesh) {
        const progress = particle.age / particle.lifetime;
        const fadeOut = 1 - progress;

        mesh.position.copy(particle.position);
        mesh.scale.setScalar(particle.size * fadeOut);

        const material = mesh.material as MeshStandardMaterial;
        material.opacity = fadeOut;
        material.emissiveIntensity = 2 * fadeOut;
      }
    });

    // Remove after lifetime
    if (ageRef.current > EXPLOSION_LIFETIME) {
      particlesRef.current.visible = false;
    }
  });

  return (
    <group ref={particlesRef} position={position}>
      {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
        <mesh
          key={index}
          geometry={particleGeometry}
          material={particleMaterial.clone()}
        />
      ))}
    </group>
  );
}

const lightPillarVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lightPillarFragment = `
  varying vec2 vUv;
  void main() {
    // Simple vertical gradient - bright at base (vUv.y = 0), fading to transparent at tip (vUv.y = 1)
    float alpha = 1.0 - vUv.y;
    alpha = pow(alpha, 1.2); // Slight curve for smoother fade
    
    vec3 color = vec3(0.0, 1.0, 0.53); // Match collectible color #00ff88
    
    gl_FragColor = vec4(color, alpha * 0.6);
  }
`;

export function Collectible({ collectible }: CollectibleProps) {
  // OctahedronGeometry creates a proper diamond shape (8 triangular faces)
  const geometry = useMemo(() => new OctahedronGeometry(1.5, 0), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x00ff88,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0x00ff88, // Same color as base for strong glow
        emissiveIntensity: 1.2, // High intensity for visible glow
      }),
    []
  );

  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const collectedRef = useRef(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [explosionPosition, setExplosionPosition] = useState<
    [number, number, number]
  >([0, 0, 0]);
  const removeCollectible = useCollectiblesStore(
    (state) => state.removeCollectible
  );
  const collectAbility = useAbilitiesStore((state) => state.collectAbility);

  // Light pillar geometry - cone shape, wide at base, point at top
  const pillarGeometry = useMemo(() => {
    const geo = new ConeGeometry(0.5, 8, 8); // radius at base, height, radial segments
    return geo;
  }, []);

  useFrame((_state, delta) => {
    if (groupRef.current && meshRef.current) {
      rotationRef.current += delta * 2;
      // Rotate diamond around Y axis
      meshRef.current.rotation.y = rotationRef.current;
      // Floating animation
      const floatOffset = Math.sin(rotationRef.current * 0.5) * 0.3;
      groupRef.current.position.y = floatOffset;
    }
  });

  const handleIntersection = (payload: CollisionPayload) => {
    if (collectedRef.current) return;
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (userData?.controllerId) {
      const controllerId = userData.controllerId;
      console.log(
        `Collision detected! Player ${controllerId} collected ${collectible.id}`
      );
      collectedRef.current = true;

      // Collect ability if collectible contains one (adds to slot, doesn't activate)
      if (collectible.abilityId) {
        collectAbility(controllerId, collectible.abilityId);
        console.log(
          `Player ${controllerId} collected ability: ${collectible.abilityId}`
        );
      }

      // Store position for explosion
      if (groupRef.current) {
        const worldPos = new Vector3();
        groupRef.current.getWorldPosition(worldPos);
        setExplosionPosition([worldPos.x, worldPos.y, worldPos.z]);
      } else {
        setExplosionPosition([...collectible.position]);
      }

      // Trigger explosion
      setShowExplosion(true);

      // Hide collectible immediately
      if (groupRef.current) {
        groupRef.current.visible = false;
      }

      // Remove after a short delay to allow explosion to render
      setTimeout(() => {
        removeCollectible(collectible.id);
      }, EXPLOSION_LIFETIME * 1000);
    }
  };

  return (
    <>
      <RigidBody
        type="fixed"
        position={collectible.position}
        colliders="cuboid"
        sensor
        onIntersectionEnter={handleIntersection}
      >
        <group ref={groupRef}>
          {/* Light pillar - cone shape extending upward from base to point */}
          <mesh position={[0, 4, 0]}>
            <primitive object={pillarGeometry} attach="geometry" />
            <shaderMaterial
              vertexShader={lightPillarVertex}
              fragmentShader={lightPillarFragment}
              transparent
              blending={AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Collectible mesh */}
          <mesh
            ref={meshRef}
            geometry={geometry}
            material={material}
            castShadow
            receiveShadow
          />
        </group>
      </RigidBody>

      {/* Explosion particles */}
      {showExplosion && <ExplosionParticles position={explosionPosition} />}
    </>
  );
}
