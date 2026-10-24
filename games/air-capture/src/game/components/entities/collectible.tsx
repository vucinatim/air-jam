import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Vector3,
} from "three";
import {
  getAbilityDefinition,
  RARITY_INFO,
  type AbilityId,
} from "../../abilities/definitions";
import type { CollectibleSim } from "../../simulation/state";

interface CollectibleProps {
  collectible: CollectibleSim;
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  size: number;
}

const PARTICLE_COUNT = 30;
export const COLLECTIBLE_BURST_SECONDS = 0.8;
const EXPLOSION_LIFETIME = COLLECTIBLE_BURST_SECONDS;
const EXPLOSION_SPEED = 8;

/** The burst a pickup leaves when a ship takes it. */
export function CollectibleBurst({
  position,
  abilityId,
}: {
  position: [number, number, number];
  abilityId: AbilityId;
}) {
  const color = RARITY_INFO[getAbilityDefinition(abilityId).rarity].color;
  const particlesRef = useRef<Group>(null);
  const particles = useRef<Particle[]>([]);
  const ageRef = useRef(0);

  // Particle material with rarity color
  const particleGeometry = useMemo(() => new BoxGeometry(0.4, 0.4, 0.4), []);
  const particleMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1,
      }),
    [color],
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
            Math.cos(phi) * speed,
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
      const mesh = particlesRef.current?.children[index] as Mesh;
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

// Light pillar fragment shader - color will be set dynamically
const createLightPillarFragment = (colorHex: number) => {
  const r = ((colorHex >> 16) & 0xff) / 255.0;
  const g = ((colorHex >> 8) & 0xff) / 255.0;
  const b = (colorHex & 0xff) / 255.0;

  return `
    varying vec2 vUv;
    void main() {
      // Simple vertical gradient - bright at base (vUv.y = 0), fading to transparent at tip (vUv.y = 1)
      float alpha = 1.0 - vUv.y;
      alpha = pow(alpha, 1.2); // Slight curve for smoother fade
      
      vec3 color = vec3(${r}, ${g}, ${b});
      
      gl_FragColor = vec4(color, alpha * 0.6);
    }
  `;
};

const CollectibleComponent = ({ collectible }: CollectibleProps) => {
  // Get ability definition to determine rarity and color
  const rarityColor =
    RARITY_INFO[getAbilityDefinition(collectible.abilityId).rarity].color;

  // OctahedronGeometry creates a proper diamond shape (8 triangular faces)
  const geometry = useMemo(() => new OctahedronGeometry(1.5, 0), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: rarityColor,
        roughness: 0.2,
        metalness: 0.1,
        emissive: rarityColor, // Same color as base for strong glow
        emissiveIntensity: 1.2, // High intensity for visible glow
      }),
    [rarityColor],
  );

  // Light pillar shader with rarity color
  const lightPillarFragment = useMemo(
    () => createLightPillarFragment(rarityColor),
    [rarityColor],
  );

  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const rotationRef = useRef(0);
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

  return (
    <>
      <group position={collectible.position}>
        <group ref={groupRef}>
          {/* Light pillar - cone shape extending upward from base to point */}
          <mesh position={[0, 4, 0]}>
            <primitive object={pillarGeometry} attach="geometry" />
            <shaderMaterial
              key={rarityColor} // Force re-create when color changes
              vertexShader={lightPillarVertex}
              fragmentShader={lightPillarFragment}
              transparent
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
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
      </group>
    </>
  );
};

// Memoize to prevent re-renders when parent (Collectibles) re-renders due to store updates
export const Collectible = memo(CollectibleComponent, (prev, next) => {
  // Only re-render if collectible data actually changed
  return prev.collectible.id === next.collectible.id;
});
